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

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function getDefaultButtons(type: NotificationType): Array<{ buttonId: string; buttonText: string }> {
  switch (type) {
    case "reservation_confirmed":
    case "scheduled_activated":
      return [
        { buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" },
        { buttonId: "btn_extend", buttonText: "⏰ Estender prazo" },
        { buttonId: "btn_release", buttonText: "🔓 Liberar porta" },
      ];
    case "reservation_released":
      return [
        { buttonId: "btn_new_reservation", buttonText: "📦 Nova reserva" },
        { buttonId: "btn_history", buttonText: "📊 Meu histórico" },
      ];
    case "reservation_expiring":
      return [
        { buttonId: "btn_renew_1h", buttonText: "🔄 Renovar +1h" },
        { buttonId: "btn_renew_2h", buttonText: "🔄 Renovar +2h" },
        { buttonId: "btn_release_now", buttonText: "🔓 Liberar agora" },
      ];
    case "reservation_expired":
    case "scheduled_cancelled":
      return [
        { buttonId: "btn_new_reservation", buttonText: "📦 Reservar novamente" },
        { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" },
      ];
    case "reservation_renewed":
      return [{ buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" }];
    case "welcome":
      return [
        { buttonId: "btn_see_lockers", buttonText: "📦 Ver armários" },
        { buttonId: "btn_how_it_works", buttonText: "❓ Como funciona" },
        { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" },
      ];
    default:
      return [];
  }
}

function buildMessageFromTemplate(
  template: string,
  footer: string,
  payload: NotificationPayload,
  personName: string | null
): MessageResult {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName || "seu armário";
  const name = personName ? personName.split(" ")[0] : "";

  const expiresTime = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";
  const expiresDate = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";

  const vars: Record<string, string> = {
    "{nome}": name,
    "{porta}": door,
    "{armario}": locker,
    "{data_expiracao}": expiresDate,
    "{hora_expiracao}": expiresTime,
    "{minutos_restantes}": String(payload.minutesLeft || 0),
    "{horas_renovadas}": String(payload.renewedHours || 0),
  };

  const text = replaceVariables(template, vars);
  const buttons = getDefaultButtons(payload.type);

  return { text, buttons, footer: replaceVariables(footer, vars) };
}

function buildDefaultMessage(payload: NotificationPayload, personName: string | null): MessageResult {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName || "seu armário";
  const name = personName ? personName.split(" ")[0] : "";
  const greeting = name ? `Olá, *${name}*! 👋` : "Olá! 👋";

  const expiresTime = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";
  const expiresDate = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";

  const buttons = getDefaultButtons(payload.type);
  const footer = "🔒 Sistema de Armários Inteligentes";

  switch (payload.type) {
    case "reservation_confirmed":
      return { text: `${greeting}\n\n✅ *Sua reserva foi confirmada!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n📅 *Válida até:* ${expiresDate} às ${expiresTime}\n\nDirija-se ao local e utilize sua porta normalmente.`, buttons, footer };
    case "reservation_released":
      return { text: `${greeting}\n\n🔓 *Porta liberada com sucesso!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n\nSua porta foi liberada. Obrigado! 🙏`, buttons, footer };
    case "reservation_expiring":
      return { text: `${greeting}\n\n⚠️ *Sua reserva está expirando.*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n⏳ *Tempo restante:* ${payload.minutesLeft} minuto(s)\n\nRenove agora para continuar usando!`, buttons, footer: "⏰ Ação necessária" };
    case "reservation_expired":
      return { text: `${greeting}\n\n❌ *Sua reserva expirou.*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n\nA porta foi liberada automaticamente. Faça uma nova reserva se precisar! 📲`, buttons, footer };
    case "reservation_renewed":
      return { text: `${greeting}\n\n🔄 *Reserva renovada!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n⏰ *Novo prazo:* ${expiresDate} às ${expiresTime}\n➕ *Estendida por:* ${payload.renewedHours}h`, buttons, footer };
    case "scheduled_activated":
      return { text: `${greeting}\n\n🟢 *Agendamento ativado!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n📅 *Válida até:* ${expiresDate} às ${expiresTime}\n\nSua porta está pronta! 🚀`, buttons, footer };
    case "scheduled_cancelled":
      return { text: `${greeting}\n\n🚫 *Agendamento cancelado*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n\nA porta não estava disponível. Tente outra! 💡`, buttons, footer };
    case "welcome":
      return { text: `${greeting}\n\n🎉 *Bem-vindo(a)!*\n\nVocê pode reservar portas, receber alertas e renovar reservas pelo celular. 🔐\n\nDúvidas? Estamos à disposição! 😊`, buttons, footer: "🔒 Sistema de Armários — Boas-vindas" };
    default:
      return { text: `📦 Notificação sobre ${door} — ${locker}`, buttons: [], footer };
  }
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  // Ensure country code 55
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  // Fix 12-digit numbers that should be 13 (add 9 for mobile)
  if (digits.length === 12) {
    const areaCode = digits.slice(2, 4);
    const number = digits.slice(4);
    // If it's a mobile number (starts with area code and 7-8 digits), add 9
    if (number.length === 8 && parseInt(number[0]) >= 6) {
      digits = `55${areaCode}9${number}`;
    }
  }
  return digits;
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

    // Get person's phone and name
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
      console.log(`No phone number for person ${payload.personId}, skipping`);
      return new Response(JSON.stringify({ success: false, reason: "no_phone_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formattedPhone = normalizePhone(phone);

    if (formattedPhone.length < 12 || formattedPhone.length > 13) {
      console.log(`Invalid phone: ${formattedPhone} (len=${formattedPhone.length}), skipping`);
      return new Response(JSON.stringify({ success: false, reason: "invalid_phone_format", phone: formattedPhone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load custom template if available
    const { data: customTemplate } = await supabase
      .from("company_notification_templates")
      .select("template_text, footer, active")
      .eq("company_id", payload.companyId)
      .eq("type", payload.type)
      .single();

    // Check if template is disabled
    if (customTemplate && !customTemplate.active) {
      console.log(`Template ${payload.type} disabled for company ${payload.companyId}, skipping`);
      return new Response(JSON.stringify({ success: false, reason: "template_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message from custom template or default
    let message: MessageResult;
    if (customTemplate?.template_text) {
      message = buildMessageFromTemplate(
        customTemplate.template_text,
        customTemplate.footer || "🔒 Sistema de Armários Inteligentes",
        payload,
        personName
      );
    } else {
      message = buildDefaultMessage(payload, personName);
    }

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
    const { text, buttons, footer } = message;
    const token = String(companyWa.instance_token);

    // Try sending with buttons first, fall back to plain text
    if (buttons && buttons.length > 0) {
      try {
        const btnResponse = await fetch(`${baseUrl}/send/buttons`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": token },
          body: JSON.stringify({ number: formattedPhone, title: "", message: text, footer: footer || "", buttons }),
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

    // Fallback: plain text with button labels as numbered options
    let fallbackText = text;
    if (buttons && buttons.length > 0) {
      fallbackText += "\n\n━━━━━━━━━━━━━━━━━━\n";
      fallbackText += buttons.map((b, i) => `*${i + 1}.* ${b.buttonText}`).join("\n");
      fallbackText += "\n\n_Responda com o número da opção desejada._";
    }
    if (footer) fallbackText += `\n\n_${footer}_`;

    const response = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": token },
      body: JSON.stringify({ number: formattedPhone, text: fallbackText }),
    });
    const data = await response.json();
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
