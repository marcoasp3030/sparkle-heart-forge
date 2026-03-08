import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find all temporary doors that have expired
    const now = new Date().toISOString();
    const { data: expiredDoors, error: fetchError } = await supabase
      .from("locker_doors")
      .select("id, door_number, label, locker_id, occupied_by_person")
      .eq("status", "occupied")
      .eq("usage_type", "temporary")
      .not("expires_at", "is", null)
      .lt("expires_at", now);

    if (fetchError) {
      console.error("Error fetching expired doors:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!expiredDoors || expiredDoors.length === 0) {
      return new Response(JSON.stringify({ message: "No expired doors found", released: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Release all expired doors
    const doorIds = expiredDoors.map((d) => d.id);
    const { error: updateError } = await supabase
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

    if (updateError) {
      console.error("Error releasing expired doors:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Released ${expiredDoors.length} expired door(s)`);

    return new Response(
      JSON.stringify({ message: `Released ${expiredDoors.length} expired door(s)`, released: expiredDoors.length }),
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
