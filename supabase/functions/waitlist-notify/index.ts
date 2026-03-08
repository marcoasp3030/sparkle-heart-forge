import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lockerId, companyId, doorLabel, doorNumber, lockerName } = await req.json();

    if (!lockerId || !companyId) {
      return new Response(JSON.stringify({ error: "lockerId and companyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if waitlist feature is enabled for this company
    const { data: permission } = await supabase
      .from("company_permissions")
      .select("enabled")
      .eq("company_id", companyId)
      .eq("permission", "waitlist_enabled")
      .single();

    if (!permission?.enabled) {
      return new Response(JSON.stringify({ success: false, reason: "waitlist_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get first person waiting for this locker
    const { data: waitEntry } = await supabase
      .from("locker_waitlist")
      .select("*, funcionarios_clientes(nome, telefone, email)")
      .eq("locker_id", lockerId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!waitEntry) {
      return new Response(JSON.stringify({ success: false, reason: "no_one_waiting" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as notified
    await supabase
      .from("locker_waitlist")
      .update({ status: "notified", notified_at: new Date().toISOString() })
      .eq("id", waitEntry.id);

    const person = waitEntry.funcionarios_clientes as any;
    const personName = person?.nome?.split(" ")[0] || "";
    const door = doorLabel || `Porta #${doorNumber}`;
    const locker = lockerName || "armário";

    // Send WhatsApp notification
    if (person?.telefone) {
      try {
        await supabase.functions.invoke("whatsapp-locker-notify", {
          body: {
            type: "waitlist_available",
            companyId,
            personId: waitEntry.person_id,
            personName: person.nome,
            doorLabel,
            doorNumber,
            lockerName,
          },
        });
      } catch (e) {
        console.log("WhatsApp waitlist notify failed:", e);
      }
    }

    // Send Email notification
    if (person?.email) {
      try {
        await supabase.functions.invoke("email-locker-notify", {
          body: {
            type: "waitlist_available",
            companyId,
            personId: waitEntry.person_id,
            personName: person.nome,
            doorLabel,
            doorNumber,
            lockerName,
          },
        });
      } catch (e) {
        console.log("Email waitlist notify failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifiedPerson: { id: waitEntry.person_id, name: person?.nome },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("waitlist-notify error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
