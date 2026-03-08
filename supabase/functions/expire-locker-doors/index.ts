import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

      results.push(`Released ${expiredDoors.length} expired door(s)`);
    }

    // 2. Activate scheduled reservations whose start time has arrived
    const { data: scheduledReservations } = await supabase
      .from("locker_reservations")
      .select("id, door_id, locker_id, person_id, reserved_by, usage_type, expires_at")
      .eq("status", "scheduled")
      .lte("starts_at", now);

    if (scheduledReservations && scheduledReservations.length > 0) {
      for (const res of scheduledReservations) {
        // Check if door is still available
        const { data: door } = await supabase
          .from("locker_doors")
          .select("status")
          .eq("id", res.door_id)
          .single();

        if (door?.status === "available") {
          // Activate the door
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

          // Update reservation status
          await supabase
            .from("locker_reservations")
            .update({ status: "active" })
            .eq("id", res.id);

          results.push(`Activated scheduled reservation ${res.id}`);
        } else {
          // Door is no longer available, cancel reservation
          await supabase
            .from("locker_reservations")
            .update({ status: "cancelled", notes: "Porta indisponível no momento do agendamento" })
            .eq("id", res.id);

          // Notify the user
          if (res.reserved_by) {
            await supabase.from("notifications").insert({
              user_id: res.reserved_by,
              title: "Agendamento cancelado",
              message: "Sua reserva agendada foi cancelada porque a porta não estava disponível no horário programado.",
              type: "warning",
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
      .select("id, door_id, reserved_by, expires_at, person_id")
      .eq("status", "active")
      .eq("expiry_notified", false)
      .not("expires_at", "is", null)
      .lte("expires_at", oneHourFromNow)
      .gt("expires_at", now);

    if (soonExpiring && soonExpiring.length > 0) {
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
