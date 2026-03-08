import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type NotificationType =
  | "reservation_confirmed"
  | "reservation_released"
  | "reservation_expiring"
  | "reservation_expired"
  | "reservation_renewed"
  | "scheduled_activated"
  | "scheduled_cancelled";

interface NotificationPayload {
  type: NotificationType;
  companyId: string;
  personId?: string;
  doorLabel?: string;
  doorNumber?: number;
  lockerName?: string;
  expiresAt?: string;
  minutesLeft?: number;
  renewedHours?: number;
}

function buildMessage(payload: NotificationPayload): string {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName ? ` (${payload.lockerName})` : "";
  const expiresTime = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";

  switch (payload.type) {
    case "reservation_confirmed":
      return `✅ *Reserva Confirmada*\n\n📦 ${door}${locker}\n⏰ Expira às ${expiresTime}\n\nSua porta foi reservada com sucesso!`;

    case "reservation_released":
      return `🔓 *Porta Liberada*\n\n📦 ${door}${locker}\n\nSua porta foi liberada e está disponível.`;

    case "reservation_expiring":
      return `⚠️ *Reserva Expirando*\n\n📦 ${door}${locker}\n⏳ Expira em ${payload.minutesLeft} minuto(s)\n\nRenove ou libere sua porta para evitar expiração automática.`;

    case "reservation_expired":
      return `❌ *Reserva Expirada*\n\n📦 ${door}${locker}\n\nSua reserva temporária expirou e a porta foi liberada automaticamente.`;

    case "reservation_renewed":
      return `🔄 *Reserva Renovada*\n\n📦 ${door}${locker}\n⏰ Novo prazo até ${expiresTime}\n\nSua reserva foi estendida por mais ${payload.renewedHours}h.`;

    case "scheduled_activated":
      return `🟢 *Agendamento Ativado*\n\n📦 ${door}${locker}\n⏰ Expira às ${expiresTime}\n\nSeu agendamento foi ativado e a porta está reservada.`;

    case "scheduled_cancelled":
      return `🚫 *Agendamento Cancelado*\n\n📦 ${door}${locker}\n\nSeu agendamento foi cancelado porque a porta não estava disponível no horário programado.`;

    default:
      return `📦 Notificação sobre ${door}${locker}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: NotificationPayload = await req.json();

    if (!payload.companyId || !payload.type) {
      return new Response(JSON.stringify({ error: "companyId e type são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if company has WhatsApp connected
    const { data: companyWa } = await supabase
      .from("company_whatsapp")
      .select("*")
      .eq("company_id", payload.companyId)
      .single();

    if (!companyWa || companyWa.status !== "connected" || !companyWa.instance_token) {
      console.log(`WhatsApp not connected for company ${payload.companyId}, skipping`);
      return new Response(JSON.stringify({ success: false, reason: "whatsapp_not_connected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get person's phone number
    let phone: string | null = null;

    if (payload.personId) {
      const { data: person } = await supabase
        .from("funcionarios_clientes")
        .select("telefone, nome")
        .eq("id", payload.personId)
        .single();

      phone = person?.telefone || null;
    }

    if (!phone) {
      console.log(`No phone number for person ${payload.personId}, skipping WhatsApp`);
      return new Response(JSON.stringify({ success: false, reason: "no_phone_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number (keep only digits, add country code if needed)
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Get UAZAPI server URL
    const { data: serverUrlSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "uazapi_server_url")
      .single();

    const serverUrl = serverUrlSetting?.value as string;
    if (!serverUrl) {
      console.log("UAZAPI server URL not configured, skipping");
      return new Response(JSON.stringify({ success: false, reason: "uazapi_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (serverUrl as string).replace(/\/$/, "");
    const message = buildMessage(payload);

    // Send via UAZAPI
    const response = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "token": String(companyWa.instance_token),
      },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    const data = await response.json();
    console.log(`WhatsApp sent to ${formattedPhone} (${payload.type}): ${response.status}`);

    return new Response(JSON.stringify({ success: response.ok, data }), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("whatsapp-locker-notify error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
