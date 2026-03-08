import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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
  | "welcome"
  | "waitlist_available";

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

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}

function buildVars(payload: NotificationPayload, personName: string | null): Record<string, string> {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName || "seu armário";
  const name = personName ? personName.split(" ")[0] : "";
  const expiresTime = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "";
  const expiresDate = payload.expiresAt
    ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" })
    : "";

  return {
    "{nome}": name,
    "{nome_completo}": personName || "",
    "{porta}": door,
    "{armario}": locker,
    "{data_expiracao}": expiresDate,
    "{hora_expiracao}": expiresTime,
    "{minutos_restantes}": String(payload.minutesLeft || 0),
    "{horas_renovadas}": String(payload.renewedHours || 0),
  };
}

function getDefaultSubject(type: NotificationType): string {
  switch (type) {
    case "reservation_confirmed": return "✅ Reserva Confirmada";
    case "reservation_released": return "🔓 Porta Liberada";
    case "reservation_expiring": return "⚠️ Reserva Expirando";
    case "reservation_expired": return "❌ Reserva Expirada";
    case "reservation_renewed": return "🔄 Reserva Renovada";
    case "welcome": return "🎉 Bem-vindo(a) ao Sistema de Armários";
    default: return "Notificação - Sistema de Armários";
  }
}

function getDefaultHtmlTemplate(type: NotificationType): string {
  switch (type) {
    case "reservation_confirmed":
      return `<h2>Olá, {nome}! 👋</h2>
<p>Sua reserva foi <strong>confirmada</strong> com sucesso!</p>
<table style="margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Válida até:</td><td>{data_expiracao} às {hora_expiracao}</td></tr>
</table>
<p>Dirija-se ao local e utilize sua porta normalmente. Lembre-se de liberar ao finalizar o uso.</p>`;

    case "reservation_released":
      return `<h2>Olá, {nome}! 👋</h2>
<p>Sua porta foi <strong>liberada</strong> com sucesso!</p>
<table style="margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>
</table>
<p>A porta já está disponível para outros usuários. Obrigado por utilizar nosso sistema!</p>`;

    case "reservation_expiring":
      return `<h2>Olá, {nome}! ⚠️</h2>
<p><strong>Atenção!</strong> Sua reserva está expirando.</p>
<table style="margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tempo restante:</td><td>{minutos_restantes} minuto(s)</td></tr>
</table>
<p>Sua reserva será encerrada automaticamente se não for renovada. Entre no sistema para renovar.</p>`;

    case "reservation_expired":
      return `<h2>Olá, {nome}! 👋</h2>
<p>Sua reserva <strong>expirou</strong>.</p>
<table style="margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>
</table>
<p>A porta foi liberada automaticamente. Caso ainda precise de um espaço, faça uma nova reserva pelo sistema.</p>`;

    case "reservation_renewed":
      return `<h2>Olá, {nome}! 👋</h2>
<p>Sua reserva foi <strong>renovada</strong> com sucesso!</p>
<table style="margin:16px 0;border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Novo prazo:</td><td>{data_expiracao} às {hora_expiracao}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Estendida por:</td><td>{horas_renovadas}h</td></tr>
</table>
<p>Continue utilizando sua porta tranquilamente.</p>`;

    case "welcome":
      return `<h2>Olá, {nome}! 🎉</h2>
<p><strong>Bem-vindo(a) ao nosso sistema de armários inteligentes!</strong></p>
<p>É um prazer ter você conosco! A partir de agora, você pode:</p>
<ul>
  <li>Reservar portas disponíveis</li>
  <li>Receber alertas de expiração</li>
  <li>Renovar reservas pelo celular</li>
</ul>
<p>Caso tenha dúvidas, estamos à disposição!</p>`;

    default:
      return `<p>Notificação sobre {porta} — {armario}</p>`;
  }
}

function wrapInEmailLayout(bodyHtml: string, footerText: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;">🔒 Sistema de Armários</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#1f2937;font-size:14px;line-height:1.7;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">${footerText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

    // Check SMTP config
    const { data: smtpSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "smtp_config")
      .maybeSingle();

    const smtpConfig = smtpSetting?.value as Record<string, any> | null;
    if (!smtpConfig?.enabled || !smtpConfig?.host || !smtpConfig?.port) {
      console.log("SMTP not configured, skipping email notification");
      return new Response(JSON.stringify({ success: false, reason: "smtp_not_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get person's email and name
    let email: string | null = null;
    let personName: string | null = null;

    if (payload.personId) {
      const { data: person } = await supabase
        .from("funcionarios_clientes")
        .select("email, nome")
        .eq("id", payload.personId)
        .single();
      email = person?.email || null;
      personName = person?.nome || null;
    }

    if (!email) {
      console.log(`No email for person ${payload.personId}, skipping`);
      return new Response(JSON.stringify({ success: false, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load custom email template
    const { data: customTemplate } = await supabase
      .from("company_notification_templates")
      .select("template_text, footer, active")
      .eq("company_id", payload.companyId)
      .eq("type", payload.type)
      .eq("channel", "email")
      .single();

    if (customTemplate && !customTemplate.active) {
      console.log(`Email template ${payload.type} disabled for company ${payload.companyId}`);
      return new Response(JSON.stringify({ success: false, reason: "template_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars = buildVars(payload, personName);
    const bodyHtml = customTemplate?.template_text
      ? replaceVariables(customTemplate.template_text, vars)
      : replaceVariables(getDefaultHtmlTemplate(payload.type), vars);
    const footerText = customTemplate?.footer
      ? replaceVariables(customTemplate.footer, vars)
      : "Sistema de Armários Inteligentes — E-mail automático";
    const subject = getDefaultSubject(payload.type);
    const fullHtml = wrapInEmailLayout(bodyHtml, footerText);

    // Send via SMTP
    const portNum = parseInt(smtpConfig.port, 10);
    const useTls = smtpConfig.encryption === "tls" || smtpConfig.encryption === "ssl";

    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: portNum,
        tls: useTls,
        auth: smtpConfig.user && smtpConfig.password
          ? { username: smtpConfig.user, password: smtpConfig.password }
          : undefined,
      },
    });

    await client.send({
      from: `${smtpConfig.from_name || "Sistema de Armários"} <${smtpConfig.from_email || smtpConfig.user}>`,
      to: email,
      subject: replaceVariables(subject, vars),
      content: "Visualize este e-mail em um cliente com suporte a HTML.",
      html: fullHtml,
    });

    await client.close();
    console.log(`Email sent to ${email} (${payload.type})`);

    return new Response(JSON.stringify({ success: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("email-locker-notify error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
