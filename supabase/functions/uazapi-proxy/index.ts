import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, companyId, instanceName } = body;

    // Get UAZAPI settings from platform_settings
    const { data: serverUrlSetting } = await supabaseClient
      .from("platform_settings")
      .select("value")
      .eq("key", "uazapi_server_url")
      .single();

    const { data: adminTokenSetting } = await supabaseClient
      .from("platform_settings")
      .select("value")
      .eq("key", "uazapi_admin_token")
      .single();

    const serverUrl = serverUrlSetting?.value as string;
    const adminToken = adminTokenSetting?.value as string;

    if (!serverUrl || !adminToken) {
      return new Response(
        JSON.stringify({ error: "UAZAPI não configurada. O superadmin precisa configurar a Server URL e Admin Token." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = (serverUrl as string).replace(/\/$/, "");

    // Get company whatsapp config
    const { data: companyWa } = await supabaseClient
      .from("company_whatsapp")
      .select("*")
      .eq("company_id", companyId)
      .single();

    const tryCreateInstance = async (name: string, token: string) => {
      const endpoints = ["/instance/create", "/instance/init"];
      const bodies = [
        { instanceName: name },
        { Name: name },
        { name: name },
        { instName: name },
        { instanceName: name, Name: name, name: name, instName: name },
      ];

      for (const endpoint of endpoints) {
        for (const bodyPayload of bodies) {
          console.log(`Trying ${endpoint} with body:`, JSON.stringify(bodyPayload));
          try {
            const response = await fetch(`${baseUrl}${endpoint}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "admintoken": token,
              },
              body: JSON.stringify(bodyPayload),
            });

            const contentType = response.headers.get("content-type") || "";
            const text = await response.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }

            console.log(`Response ${response.status}:`, text.substring(0, 200));

            if (response.ok) {
              return { response, data };
            }

            // If error is about missing name or 404, try next
            const errorStr = JSON.stringify(data).toLowerCase();
            if (errorStr.includes("missing") || response.status === 404) continue;

            // For other errors, return immediately
            return { response, data };
          } catch (fetchErr) {
            console.log(`Fetch error for ${endpoint}:`, fetchErr);
            continue;
          }
        }
      }

      return {
        response: new Response(null, { status: 400 }),
        data: { error: "Nenhum formato de payload aceito pela API UAZAPI" },
      };
    };

    if (action === "create_instance") {
      // Create a new instance for the company
      const name = instanceName || `company_${companyId.substring(0, 8)}`;
      const sanitizedAdminToken = String(adminToken).trim();

      const { response, data } = await tryCreateInstance(name, sanitizedAdminToken);

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "Erro ao criar instância", details: data }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save instance info
      const instanceToken = data?.token || data?.data?.token || "";
      await supabaseClient.from("company_whatsapp").upsert({
        company_id: companyId,
        instance_name: name,
        instance_token: instanceToken,
        status: "disconnected",
      }, { onConflict: "company_id" });

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_qrcode") {
      if (!companyWa?.instance_name) {
        return new Response(JSON.stringify({ error: "Instância não criada para esta empresa" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instToken = companyWa.instance_token || adminToken;
      const instName = companyWa.instance_name;
      
      // UAZAPI v2: GET /instance/connectionState/{instanceName} returns QR + state
      const qrEndpoints = [
        { url: `${baseUrl}/instance/connectionState/${instName}`, method: "GET" },
        { url: `${baseUrl}/instance/qrcode/${instName}`, method: "GET" },
        { url: `${baseUrl}/instance/connect/${instName}`, method: "GET" },
        { url: `${baseUrl}/instance/qrcode`, method: "GET" },
      ];

      let qrData: any = null;
      for (const ep of qrEndpoints) {
        try {
          const response = await fetch(ep.url, {
            method: ep.method,
            headers: {
              "Content-Type": "application/json",
              "token": String(instToken),
              "admintoken": String(adminToken),
            },
          });
          const text = await response.text();
          console.log(`QR ${ep.method} ${ep.url} -> ${response.status}: ${text.substring(0, 500)}`);
          
          if (response.ok) {
            try { qrData = JSON.parse(text); } catch { qrData = { raw: text }; }
            break;
          }
        } catch (err) {
          console.log(`QR fetch error for ${ep.url}:`, err);
        }
      }

      return new Response(JSON.stringify({ success: true, data: qrData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_status") {
      if (!companyWa?.instance_name) {
        return new Response(JSON.stringify({ status: "not_created" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instToken = companyWa.instance_token || adminToken;
      const response = await fetch(`${baseUrl}/instance/info`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "token": String(instToken),
          "instance_token": String(instToken),
        },
      });

      const data = await response.json();
      const connected = data?.instance?.state === "open" || data?.state === "open";

      // Update status in DB
      const newStatus = connected ? "connected" : "disconnected";
      const phoneNumber = data?.instance?.phoneNumber || data?.phoneNumber || companyWa.phone_number || "";
      
      await supabaseClient.from("company_whatsapp").update({
        status: newStatus,
        phone_number: phoneNumber,
      }).eq("company_id", companyId);

      return new Response(JSON.stringify({ success: true, status: newStatus, phone_number: phoneNumber, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "disconnect") {
      if (!companyWa?.instance_name) {
        return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instToken = companyWa.instance_token || adminToken;
      await fetch(`${baseUrl}/instance/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": String(instToken),
          "instance_token": String(instToken),
        },
      });

      await supabaseClient.from("company_whatsapp").update({
        status: "disconnected",
        phone_number: "",
      }).eq("company_id", companyId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_message") {
      const { phone, message } = body;
      if (!companyWa?.instance_token) {
        return new Response(JSON.stringify({ error: "WhatsApp não conectado para esta empresa" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const response = await fetch(`${baseUrl}/message/send-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": String(companyWa.instance_token),
          "instance_token": String(companyWa.instance_token),
        },
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();

      return new Response(JSON.stringify({ success: response.ok, data }), {
        status: response.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("uazapi-proxy error:", error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
