/**
 * Email locker notification route - migrated from email-locker-notify Edge Function.
 * Sends transactional emails for locker events using SMTP.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";
import nodemailer from "nodemailer";

const router = Router();

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
  const subjects: Record<string, string> = {
    reservation_confirmed: "✅ Reserva Confirmada",
    reservation_released: "🔓 Porta Liberada",
    reservation_expiring: "⚠️ Reserva Expirando",
    reservation_expired: "❌ Reserva Expirada",
    reservation_renewed: "🔄 Reserva Renovada",
    welcome: "🎉 Bem-vindo(a) ao Sistema de Armários",
    waitlist_available: "🎉 Porta Disponível — Fila de Espera",
  };
  return subjects[type] || "Notificação - Sistema de Armários";
}

function getDefaultHtmlTemplate(type: NotificationType): string {
  const templates: Record<string, string> = {
    reservation_confirmed: `<h2>Olá, {nome}! 👋</h2><p>Sua reserva foi <strong>confirmada</strong>!</p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Válida até:</td><td>{data_expiracao} às {hora_expiracao}</td></tr></table>`,
    reservation_released: `<h2>Olá, {nome}! 👋</h2><p>Sua porta foi <strong>liberada</strong>!</p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr></table>`,
    reservation_expiring: `<h2>Olá, {nome}! ⚠️</h2><p><strong>Atenção!</strong> Sua reserva está expirando.</p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tempo restante:</td><td>{minutos_restantes} minuto(s)</td></tr></table>`,
    reservation_expired: `<h2>Olá, {nome}! 👋</h2><p>Sua reserva <strong>expirou</strong>.</p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr></table>`,
    reservation_renewed: `<h2>Olá, {nome}! 👋</h2><p>Sua reserva foi <strong>renovada</strong>!</p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Novo prazo:</td><td>{data_expiracao} às {hora_expiracao}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Estendida por:</td><td>{horas_renovadas}h</td></tr></table>`,
    welcome: `<h2>Olá, {nome}! 🎉</h2><p><strong>Bem-vindo(a)!</strong> Você pode reservar portas, receber alertas e renovar reservas.</p>`,
    waitlist_available: `<h2>Olá, {nome}! 🎉</h2><p><strong>Uma porta ficou disponível!</strong></p><table style="margin:16px 0;border-collapse:collapse;"><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr><tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr></table><p>Reserve agora antes que alguém ocupe.</p>`,
  };
  return templates[type] || `<p>Notificação sobre {porta} — {armario}</p>`;
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

// POST /api/email-notify
router.post("/", async (req: Request, res: Response) => {
  try {
    const payload: NotificationPayload = req.body;

    if (!payload.companyId || !payload.type) {
      return res.status(400).json({ error: "companyId e type são obrigatórios" });
    }

    // Check SMTP config
    const { rows: smtpRows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'smtp_config' LIMIT 1`
    );
    const smtpConfig = smtpRows[0]?.value as Record<string, any> | null;
    if (!smtpConfig?.enabled || !smtpConfig?.host || !smtpConfig?.port) {
      return res.json({ success: false, reason: "smtp_not_configured" });
    }

    // Get person's email and name
    let email: string | null = null;
    let personName: string | null = null;

    if (payload.personId) {
      const { rows } = await pool.query(
        `SELECT email, nome FROM funcionarios_clientes WHERE id = $1`,
        [payload.personId]
      );
      email = rows[0]?.email || null;
      personName = rows[0]?.nome || null;
    }

    if (!email) {
      return res.json({ success: false, reason: "no_email" });
    }

    // Load custom template
    const { rows: templateRows } = await pool.query(
      `SELECT template_text, footer, active FROM company_notification_templates 
       WHERE company_id = $1 AND type = $2 AND channel = 'email' LIMIT 1`,
      [payload.companyId, payload.type]
    );
    const customTemplate = templateRows[0] || null;

    if (customTemplate && !customTemplate.active) {
      return res.json({ success: false, reason: "template_disabled" });
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

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: portNum,
      secure: useTls && portNum === 465,
      auth: smtpConfig.user && smtpConfig.password
        ? { user: smtpConfig.user, pass: smtpConfig.password }
        : undefined,
      tls: useTls ? { rejectUnauthorized: false } : undefined,
    });

    await transporter.sendMail({
      from: `${smtpConfig.from_name || "Sistema de Armários"} <${smtpConfig.from_email || smtpConfig.user}>`,
      to: email,
      subject: replaceVariables(subject, vars),
      text: "Visualize este e-mail em um cliente com suporte a HTML.",
      html: fullHtml,
    });

    console.log(`Email sent to ${email} (${payload.type})`);
    res.json({ success: true, email });
  } catch (error: any) {
    console.error("email-notify error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export { router as emailNotifyRouter };
