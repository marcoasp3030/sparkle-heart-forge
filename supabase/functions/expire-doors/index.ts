import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Expire active reservations past their expiry
    const { data: expiredReservations, error: err1 } = await supabase
      .from("locker_reservations")
      .update({ status: "expired", released_at: new Date().toISOString() })
      .eq("status", "active")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("id");

    // 2. Release occupied temporary doors past their expiry
    const { data: expiredDoors, error: err2 } = await supabase
      .from("locker_doors")
      .update({
        status: "available",
        occupied_by: null,
        occupied_by_person: null,
        occupied_at: null,
        expires_at: null,
        scheduled_reservation_id: null,
      })
      .eq("status", "occupied")
      .eq("usage_type", "temporary")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("id");

    // 3. Release hygienizing doors past their expiry
    const { data: hygienizingDoors, error: err3 } = await supabase
      .from("locker_doors")
      .update({
        status: "available",
        expires_at: null,
      })
      .eq("status", "hygienizing")
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .select("id");

    // 4. Activate scheduled reservations whose start time has arrived
    const { data: scheduledReservations } = await supabase
      .from("locker_reservations")
      .select("id, door_id, person_id, reserved_by, expires_at, usage_type")
      .eq("status", "scheduled")
      .lte("starts_at", new Date().toISOString());

    let activatedCount = 0;
    if (scheduledReservations && scheduledReservations.length > 0) {
      for (const res of scheduledReservations) {
        // Check if door still has this reservation scheduled
        const { data: door } = await supabase
          .from("locker_doors")
          .select("id, scheduled_reservation_id")
          .eq("id", res.door_id)
          .eq("scheduled_reservation_id", res.id)
          .single();

        if (door) {
          await supabase
            .from("locker_doors")
            .update({
              status: "occupied",
              occupied_by: res.reserved_by,
              occupied_by_person: res.person_id,
              occupied_at: new Date().toISOString(),
              expires_at: res.expires_at,
              usage_type: res.usage_type,
              scheduled_reservation_id: null,
            })
            .eq("id", res.door_id);

          await supabase
            .from("locker_reservations")
            .update({ status: "active" })
            .eq("id", res.id);

          activatedCount++;
        }
      }
    }

    const summary = {
      expired_reservations: expiredReservations?.length ?? 0,
      expired_doors: expiredDoors?.length ?? 0,
      hygienizing_released: hygienizingDoors?.length ?? 0,
      scheduled_activated: activatedCount,
      timestamp: new Date().toISOString(),
    };

    console.log("[expire-doors]", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[expire-doors] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
