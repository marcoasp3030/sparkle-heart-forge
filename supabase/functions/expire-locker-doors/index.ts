import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendWhatsAppNotify(supabaseUrl: string, anonKey: string, payload: Record<string, unknown>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-locker-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("WhatsApp notify failed (non-blocking):", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date().toISOString();
    const results: string[] = [];

    // 1. Release expired temporary doors
    const { data: expiredDoors } = await supabase
      .from("locker_doors")
      .select("id, door_number, label, locker_id, occupied_by_person")
      .eq("status", "occupied")
      .eq("usage_type", "temporary")
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    if (expiredDoors && expiredDoors.length > 0) {
      const doorIds = expiredDoors.map((d) => d.id);

      // Get locker info for notifications
      const lockerIds = [...new Set(expiredDoors.map((d) => d.locker_id))];
      const { data: lockers } = await supabase
        .from("lockers")
        .select("id, name, company_id")
        .in("id", lockerIds);
      const lockerMap = new Map(lockers?.map((l) => [l.id, l]) || []);

      // Update reservation records
      await supabase
        .from("locker_reservations")
        .update({ status: "expired", released_at: now })
        .in("door_id", doorIds)
        .eq("status", "active");

      // Release the doors
      await supabase
        .from("locker_doors")
        .update({
          status: "available",
          occupied_by: null,
          occupied_at: null,
          occupied_by_person: null,
          usage_type: "temporary",
          expires_at: null,
        })
        .in("id", doorIds);

      // Send WhatsApp notifications for expired doors
      for (const door of expiredDoors) {
        const locker = lockerMap.get(door.locker_id);
        if (door.occupied_by_person && locker?.company_id) {
          sendWhatsAppNotify(supabaseUrl, anonKey, {
            type: "reservation_expired",
            companyId: locker.company_id,
            personId: door.occupied_by_person,
            doorLabel: door.label,
            doorNumber: door.door_number,
            lockerName: locker.name,
          });
        }
      }

      results.push(`Released ${expiredDoors.length} expired door(s)`);
    }

    // 2. Activate scheduled reservations whose start time has arrived
    const { data: scheduledReservations } = await supabase
      .from("locker_reservations")
      .select("id, door_id, locker_id, person_id, reserved_by, usage_type, expires_at")
      .eq("status", "scheduled")
      .lte("starts_at", now);

    if (scheduledReservations && scheduledReservations.length > 0) {
      // Get locker info
      const lockerIds = [...new Set(scheduledReservations.map((r) => r.locker_id))];
      const { data: lockers } = await supabase
        .from("lockers")
        .select("id, name, company_id")
        .in("id", lockerIds);
      const lockerMap = new Map(lockers?.map((l) => [l.id, l]) || []);

      // Get door info
      const doorIds = scheduledReservations.map((r) => r.door_id);
      const { data: doors } = await supabase
        .from("locker_doors")
        .select("id, status, label, door_number")
        .in("id", doorIds);
      const doorMap = new Map(doors?.map((d) => [d.id, d]) || []);

      for (const res of scheduledReservations) {
        const door = doorMap.get(res.door_id);
        const locker = lockerMap.get(res.locker_id);

        if (door?.status === "available") {
          await supabase
            .from("locker_doors")
            .update({
              status: "occupied",
              occupied_by: res.reserved_by,
              occupied_by_person: res.person_id,
              occupied_at: now,
              usage_type: res.usage_type,
              expires_at: res.expires_at,
              scheduled_reservation_id: null,
            })
            .eq("id", res.door_id);

          await supabase
            .from("locker_reservations")
            .update({ status: "active" })
            .eq("id", res.id);

          // WhatsApp: scheduled activated
          if (res.person_id && locker?.company_id) {
            sendWhatsAppNotify(supabaseUrl, anonKey, {
              type: "scheduled_activated",
              companyId: locker.company_id,
              personId: res.person_id,
              doorLabel: door.label,
              doorNumber: door.door_number,
              lockerName: locker.name,
              expiresAt: res.expires_at,
            });
          }

          results.push(`Activated scheduled reservation ${res.id}`);
        } else {
          await supabase
            .from("locker_reservations")
            .update({ status: "cancelled", notes: "Porta indisponível no momento do agendamento" })
            .eq("id", res.id);

          if (res.reserved_by) {
            await supabase.from("notifications").insert({
              user_id: res.reserved_by,
              title: "Agendamento cancelado",
              message: "Sua reserva agendada foi cancelada porque a porta não estava disponível no horário programado.",
              type: "warning",
            });
          }

          // WhatsApp: scheduled cancelled
          if (res.person_id && locker?.company_id) {
            sendWhatsAppNotify(supabaseUrl, anonKey, {
              type: "scheduled_cancelled",
              companyId: locker.company_id,
              personId: res.person_id,
              doorLabel: door?.label,
              doorNumber: door?.door_number,
              lockerName: locker.name,
            });
          }

          results.push(`Cancelled scheduled reservation ${res.id} (door unavailable)`);
        }
      }
    }

    // 3. Send expiry alerts (1 hour before expiration)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: soonExpiring } = await supabase
      .from("locker_reservations")
      .select("id, door_id, locker_id, reserved_by, expires_at, person_id")
      .eq("status", "active")
      .eq("expiry_notified", false)
      .not("expires_at", "is", null)
      .lte("expires_at", oneHourFromNow)
      .gt("expires_at", now);

    if (soonExpiring && soonExpiring.length > 0) {
      // Get locker & door info
      const lockerIds = [...new Set(soonExpiring.map((r) => r.locker_id))];
      const doorIds = soonExpiring.map((r) => r.door_id);
      const { data: lockers } = await supabase.from("lockers").select("id, name, company_id").in("id", lockerIds);
      const { data: doors } = await supabase.from("locker_doors").select("id, label, door_number").in("id", doorIds);
      const lockerMap = new Map(lockers?.map((l) => [l.id, l]) || []);
      const doorMap = new Map(doors?.map((d) => [d.id, d]) || []);

      for (const res of soonExpiring) {
        if (res.reserved_by) {
          const expiresDate = new Date(res.expires_at!);
          const minutesLeft = Math.round((expiresDate.getTime() - Date.now()) / 60000);

          await supabase.from("notifications").insert({
            user_id: res.reserved_by,
            title: "Reserva prestes a expirar",
            message: `Sua reserva temporária expira em ${minutesLeft} minuto(s). Renove ou libere o armário.`,
            type: "warning",
          });

          await supabase
            .from("locker_reservations")
            .update({ expiry_notified: true })
            .eq("id", res.id);

          // WhatsApp: expiring
          const locker = lockerMap.get(res.locker_id);
          const door = doorMap.get(res.door_id);
          if (res.person_id && locker?.company_id) {
            sendWhatsAppNotify(supabaseUrl, anonKey, {
              type: "reservation_expiring",
              companyId: locker.company_id,
              personId: res.person_id,
              doorLabel: door?.label,
              doorNumber: door?.door_number,
              lockerName: locker.name,
              expiresAt: res.expires_at,
              minutesLeft,
            });
          }
        }
      }
      results.push(`Sent ${soonExpiring.length} expiry alert(s)`);
    }

    console.log("Cron results:", results.length > 0 ? results.join("; ") : "No actions needed");

    return new Response(
      JSON.stringify({ results, timestamp: now }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
