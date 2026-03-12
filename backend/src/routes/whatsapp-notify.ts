/**
 * WhatsApp locker notification route - migrated from whatsapp-locker-notify Edge Function.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";

const router = Router();

type NotificationType =
  | "reservation_confirmed" | "reservation_released" | "reservation_expiring"
  | "reservation_expired" | "reservation_renewed" | "scheduled_activated"
  | "scheduled_cancelled" | "welcome" | "waitlist_available";

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

function getDefaultButtons(type: NotificationType): Array<{ buttonId: string; buttonText: string }> {
  const map: Record<string, Array<{ buttonId: string; buttonText: string }>> = {
    reservation_confirmed: [{ buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" }, { buttonId: "btn_extend", buttonText: "⏰ Estender prazo" }, { buttonId: "btn_release", buttonText: "🔓 Liberar porta" }],
    scheduled_activated: [{ buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" }, { buttonId: "btn_extend", buttonText: "⏰ Estender prazo" }, { buttonId: "btn_release", buttonText: "🔓 Liberar porta" }],
    reservation_released: [{ buttonId: "btn_new_reservation", buttonText: "📦 Nova reserva" }, { buttonId: "btn_history", buttonText: "📊 Meu histórico" }],
    reservation_expiring: [{ buttonId: "btn_renew_1h", buttonText: "🔄 Renovar +1h" }, { buttonId: "btn_renew_2h", buttonText: "🔄 Renovar +2h" }, { buttonId: "btn_release_now", buttonText: "🔓 Liberar agora" }],
    reservation_expired: [{ buttonId: "btn_new_reservation", buttonText: "📦 Reservar novamente" }, { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" }],
    scheduled_cancelled: [{ buttonId: "btn_new_reservation", buttonText: "📦 Reservar novamente" }, { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" }],
    reservation_renewed: [{ buttonId: "btn_view_details", buttonText: "📋 Ver detalhes" }],
    welcome: [{ buttonId: "btn_see_lockers", buttonText: "📦 Ver armários" }, { buttonId: "btn_how_it_works", buttonText: "❓ Como funciona" }, { buttonId: "btn_contact_support", buttonText: "💬 Falar com suporte" }],
    waitlist_available: [{ buttonId: "btn_reserve_now", buttonText: "📦 Reservar agora" }, { buttonId: "btn_leave_queue", buttonText: "❌ Sair da fila" }],
  };
  return map[type] || [];
}

function buildDefaultMessage(payload: NotificationPayload, personName: string | null) {
  const door = payload.doorLabel || `Porta #${payload.doorNumber}`;
  const locker = payload.lockerName || "seu armário";
  const name = personName ? personName.split(" ")[0] : "";
  const greeting = name ? `Olá, *${name}*! 👋` : "Olá! 👋";
  const expiresTime = payload.expiresAt ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
  const expiresDate = payload.expiresAt ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
  const buttons = getDefaultButtons(payload.type);
  const footer = "🔒 Sistema de Armários Inteligentes";

  const messages: Record<string, string> = {
    reservation_confirmed: `${greeting}\n\n✅ *Sua reserva foi confirmada!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n📅 *Válida até:* ${expiresDate} às ${expiresTime}`,
    reservation_released: `${greeting}\n\n🔓 *Porta liberada com sucesso!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}`,
    reservation_expiring: `${greeting}\n\n⚠️ *Sua reserva está expirando.*\n\n📦 *Porta:* ${door}\n⏳ *Tempo restante:* ${payload.minutesLeft} minuto(s)`,
    reservation_expired: `${greeting}\n\n❌ *Sua reserva expirou.*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}`,
    reservation_renewed: `${greeting}\n\n🔄 *Reserva renovada!*\n\n📦 *Porta:* ${door}\n⏰ *Novo prazo:* ${expiresDate} às ${expiresTime}\n➕ *Estendida por:* ${payload.renewedHours}h`,
    scheduled_activated: `${greeting}\n\n🟢 *Agendamento ativado!*\n\n📦 *Porta:* ${door}\n📅 *Válida até:* ${expiresDate} às ${expiresTime}`,
    scheduled_cancelled: `${greeting}\n\n🚫 *Agendamento cancelado*\n\n📦 *Porta:* ${door}`,
    welcome: `${greeting}\n\n🎉 *Bem-vindo(a)!*\n\nVocê pode reservar portas, receber alertas e renovar reservas pelo celular. 🔐`,
    waitlist_available: `${greeting}\n\n🎉 *Uma porta ficou disponível!*\n\n📦 *Porta:* ${door}\n🏢 *Armário:* ${locker}\n\nReserve agora! ⚡`,
  };

  return { text: messages[payload.type] || `📦 Notificação sobre ${door}`, buttons, footer };
}

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  if (digits.length === 12) {
    const areaCode = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length === 8 && parseInt(number[0]) >= 6) {
      digits = `55${areaCode}9${number}`;
    }
  }
  return digits;
}

// POST /api/whatsapp-notify
router.post("/", async (req: Request, res: Response) => {
  try {
    const payload: NotificationPayload = req.body;

    if (!payload.companyId || !payload.type) {
      return res.status(400).json({ error: "companyId e type são obrigatórios" });
    }

    // Check if company has WhatsApp connected
    const { rows: waRows } = await pool.query(
      `SELECT * FROM company_whatsapp WHERE company_id = $1 LIMIT 1`,
      [payload.companyId]
    );
    const companyWa = waRows[0];

    if (!companyWa || companyWa.status !== "connected" || !companyWa.instance_token) {
      return res.json({ success: false, reason: "whatsapp_not_connected" });
    }

    // Get person's phone and name
    let phone: string | null = null;
    let personName: string | null = null;

    if (payload.personId) {
      const { rows } = await pool.query(
        `SELECT telefone, nome FROM funcionarios_clientes WHERE id = $1`,
        [payload.personId]
      );
      phone = rows[0]?.telefone || null;
      personName = rows[0]?.nome || null;
    }

    if (!phone) {
      return res.json({ success: false, reason: "no_phone_number" });
    }

    const formattedPhone = normalizePhone(phone);
    if (formattedPhone.length < 12 || formattedPhone.length > 13) {
      return res.json({ success: false, reason: "invalid_phone_format", phone: formattedPhone });
    }

    // Load custom template
    const { rows: templateRows } = await pool.query(
      `SELECT template_text, footer, active FROM company_notification_templates 
       WHERE company_id = $1 AND type = $2 LIMIT 1`,
      [payload.companyId, payload.type]
    );
    const customTemplate = templateRows[0];

    if (customTemplate && !customTemplate.active) {
      return res.json({ success: false, reason: "template_disabled" });
    }

    let message: any;
    if (customTemplate?.template_text) {
      const vars: Record<string, string> = {
        "{nome}": (personName || "").split(" ")[0],
        "{porta}": payload.doorLabel || `Porta #${payload.doorNumber}`,
        "{armario}": payload.lockerName || "seu armário",
        "{data_expiracao}": payload.expiresAt ? new Date(payload.expiresAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
        "{hora_expiracao}": payload.expiresAt ? new Date(payload.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "",
        "{minutos_restantes}": String(payload.minutesLeft || 0),
        "{horas_renovadas}": String(payload.renewedHours || 0),
      };
      message = {
        text: replaceVariables(customTemplate.template_text, vars),
        buttons: getDefaultButtons(payload.type),
        footer: replaceVariables(customTemplate.footer || "🔒 Sistema de Armários", vars),
      };
    } else {
      message = buildDefaultMessage(payload, personName);
    }

    // Get UAZAPI server URL
    const { rows: serverRows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'uazapi_server_url' LIMIT 1`
    );
    const serverUrl = serverRows[0]?.value as string;
    if (!serverUrl) {
      return res.json({ success: false, reason: "uazapi_not_configured" });
    }

    const baseUrl = (serverUrl as string).replace(/\/$/, "");
    const token = String(companyWa.instance_token);
    const { text, buttons, footer } = message;

    // Try sending with buttons first
    if (buttons && buttons.length > 0) {
      try {
        const btnResponse = await fetch(`${baseUrl}/send/buttons`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "token": token },
          body: JSON.stringify({ number: formattedPhone, title: "", message: text, footer: footer || "", buttons }),
        });
        if (btnResponse.ok) {
          const btnData = await btnResponse.json();
          return res.json({ success: true, method: "buttons", data: btnData });
        }
      } catch (e) {
        console.log("Buttons endpoint failed, falling back to text");
      }
    }

    // Fallback: plain text
    let fallbackText = text;
    if (buttons?.length) {
      fallbackText += "\n\n━━━━━━━━━━━━━━━━━━\n";
      fallbackText += buttons.map((b: any, i: number) => `*${i + 1}.* ${b.buttonText}`).join("\n");
      fallbackText += "\n\n_Responda com o número da opção desejada._";
    }
    if (footer) fallbackText += `\n\n_${footer}_`;

    const response = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": token },
      body: JSON.stringify({ number: formattedPhone, text: fallbackText }),
    });
    const data = await response.json();

    res.status(response.ok ? 200 : 400).json({ success: response.ok, method: "text", data });
  } catch (error: any) {
    console.error("whatsapp-notify error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export { router as whatsappNotifyRouter };
