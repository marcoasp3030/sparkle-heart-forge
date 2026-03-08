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
  | "scheduled_cancelled"
  | "welcome";

interface NotificationPayload {
  type: NotificationType;
  companyId: string;
  personId?: string;
  personName?: string;
  doorLabel?: string;
  doorNumber?: number;
  lockerName?: string;
  expiresAt?: string;
  minutesLeft?: number;
  renewedHours?: number;
}

interface MessageResult {
  text: string;
  buttons?: Array<{ buttonId: string; buttonText: string }>;
  footer?: string;
}

function buildMessage(payload: NotificationPayload): MessageResult {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName ? `${payload.lockerName}` : "seu armário";
  const name = payload.personName ? payload.personName.split(" ")[0] : "";
  const greeting = name ? `Olá, *${name}*! 👋` : "Olá! 👋";

  const expiresTime = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  const expiresDate = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "";

  switch (payload.type) {
    case "reservation_confirmed":
      return {
        text: `${greeting}\n\n✅ *Sua reserva foi confirmada!*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n` +
          `📅 *Válida até:* ${expiresDate} às ${expiresTime}\n\n` +
          `Dirija-se ao local e utilize sua porta normalmente. Lembre-se de liberar ao finalizar o uso.`,
        buttons: [
          { buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" },
          { buttonId: "btn_extend", buttonText: "⏰ Estender prazo" },
          { buttonId: "btn_release", buttonText: "🔓 Liberar porta" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    case "reservation_released":
      return {
        text: `${greeting}\n\n🔓 *Porta liberada com sucesso!*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n\n` +
          `Sua porta foi liberada e já está disponível para outros usuários. Obrigado por utilizar nosso sistema! 🙏`,
        buttons: [
          { buttonId: "btn_new_reservation", buttonText: "📦 Nova reserva" },
          { buttonId: "btn_history", buttonText: "📊 Meu histórico" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    case "reservation_expiring":
      return {
        text: `${greeting}\n\n⚠️ *Atenção! Sua reserva está expirando.*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n` +
          `⏳ *Tempo restante:* ${payload.minutesLeft} minuto(s)\n\n` +
          `Sua reserva será encerrada automaticamente se não for renovada. Renove agora para continuar usando!`,
        buttons: [
          { buttonId: "btn_renew_1h", buttonText: "🔄 Renovar +1h" },
          { buttonId: "btn_renew_2h", buttonText: "🔄 Renovar +2h" },
          { buttonId: "btn_release_now", buttonText: "🔓 Liberar agora" },
        ],
        footer: "⏰ Ação necessária — Responda para renovar",
      };

    case "reservation_expired":
      return {
        text: `${greeting}\n\n❌ *Sua reserva expirou.*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n\n` +
          `O prazo da sua reserva terminou e a porta foi liberada automaticamente. ` +
          `Caso ainda precise de um espaço, faça uma nova reserva! 📲`,
        buttons: [
          { buttonId: "btn_new_reservation", buttonText: "📦 Reservar novamente" },
          { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    case "reservation_renewed":
      return {
        text: `${greeting}\n\n🔄 *Reserva renovada com sucesso!*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n` +
          `⏰ *Novo prazo:* ${expiresDate} às ${expiresTime}\n` +
          `➕ *Estendida por:* ${payload.renewedHours}h\n\n` +
          `Tudo certo! Continue utilizando sua porta tranquilamente. 😊`,
        buttons: [
          { buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    case "scheduled_activated":
      return {
        text: `${greeting}\n\n🟢 *Seu agendamento foi ativado!*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n` +
          `📅 *Válida até:* ${expiresDate} às ${expiresTime}\n\n` +
          `Sua porta está pronta para uso! Dirija-se ao armário e aproveite. 🚀`,
        buttons: [
          { buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" },
          { buttonId: "btn_extend", buttonText: "⏰ Estender prazo" },
          { buttonId: "btn_release", buttonText: "🔓 Liberar porta" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    case "scheduled_cancelled":
      return {
        text: `${greeting}\n\n🚫 *Agendamento cancelado*\n\n` +
          `📦 *Porta:* ${door}\n` +
          `🏢 *Armário:* ${locker}\n\n` +
          `Infelizmente, sua porta não estava disponível no horário programado e o agendamento foi cancelado. ` +
          `Que tal tentar outra porta? Temos opções disponíveis! 💡`,
        buttons: [
          { buttonId: "btn_new_reservation", buttonText: "📦 Nova reserva" },
          { buttonId: "btn_view_available", buttonText: "🔍 Ver disponíveis" },
          { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" },
        ],
        footer: "🔒 Sistema de Armários Inteligentes",
      };

    default:
      return {
        text: `📦 Notificação sobre ${door} — ${locker}`,
      };
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

    // Get person's phone number and name
    let phone: string | null = null;
    let personName: string | null = null;

    if (payload.personId) {
      const { data: person } = await supabase
        .from("funcionarios_clientes")
        .select("telefone, nome")
        .eq("id", payload.personId)
        .single();

      phone = person?.telefone || null;
      personName = person?.nome || null;
    }

    if (!phone) {
      console.log(`No phone number for person ${payload.personId}, skipping WhatsApp`);
      return new Response(JSON.stringify({ success: false, reason: "no_phone_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Clean phone number
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
    const { text, buttons, footer } = buildMessage({ ...payload, personName: personName || undefined });
    const token = String(companyWa.instance_token);

    let response: Response;
    let data: unknown;

    // Try sending with buttons first, fall back to plain text
    if (buttons && buttons.length > 0) {
      try {
        const btnResponse = await fetch(`${baseUrl}/send/buttons`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": token },
          body: JSON.stringify({
            number: formattedPhone,
            title: "",
            message: text,
            footer: footer || "",
            buttons: buttons,
          }),
        });

        const btnData = await btnResponse.json();

        if (btnResponse.ok) {
          console.log(`WhatsApp buttons sent to ${formattedPhone} (${payload.type}): ${btnResponse.status}`);
          return new Response(JSON.stringify({ success: true, method: "buttons", data: btnData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        console.log(`Buttons failed (${btnResponse.status}), falling back to text`);
      } catch (btnErr) {
        console.log("Buttons endpoint not available, falling back to text:", btnErr);
      }
    }

    // Fallback: send as plain text (append button labels as numbered options)
    let fallbackText = text;
    if (buttons && buttons.length > 0) {
      fallbackText += "\n\n━━━━━━━━━━━━━━━━━━\n";
      fallbackText += buttons.map((b, i) => `*${i + 1}.* ${b.buttonText}`).join("\n");
      fallbackText += "\n\n_Responda com o número da opção desejada._";
    }
    if (footer) {
      fallbackText += `\n\n_${footer}_`;
    }

    response = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": token },
      body: JSON.stringify({ number: formattedPhone, text: fallbackText }),
    });

    data = await response.json();
    console.log(`WhatsApp text sent to ${formattedPhone} (${payload.type}): ${response.status}`);

    return new Response(JSON.stringify({ success: response.ok, method: "text", data }), {
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
