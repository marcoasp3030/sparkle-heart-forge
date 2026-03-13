/**
 * WhatsApp webhook route - migrated from whatsapp-webhook Edge Function.
 * Processes button clicks and text commands from WhatsApp users.
 */
import { Router, Request, Response } from "express";
import { pool } from "../config/database";

const router = Router();

async function findPersonByPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  const number = withoutCountry.slice(2);

  const { rows } = await pool.query(
    `SELECT id, nome, company_id, telefone FROM funcionarios_clientes 
     WHERE ativo = true AND (telefone ILIKE $1 OR telefone ILIKE $2) LIMIT 1`,
    [`%${withoutCountry}%`, `%${number}%`]
  );
  return rows[0] || null;
}

async function getActiveReservation(personId: string) {
  const { rows } = await pool.query(
    `SELECT id, door_number, label, locker_id, expires_at, status, usage_type 
     FROM locker_doors WHERE occupied_by_person = $1 AND status = 'occupied' LIMIT 1`,
    [personId]
  );
  return rows[0] || null;
}

async function sendReply(baseUrl: string, token: string, phone: string, text: string) {
  await fetch(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: JSON.stringify({ number: phone, text }),
  });
}

function parseTextCommand(text: string): string | null {
  const n = text.trim().toLowerCase();
  if (["status", "detalhes", "minha reserva", "1"].includes(n)) return "btn_view_details";
  if (["renovar", "estender", "renew", "2"].includes(n)) return "btn_extend";
  if (["renovar 1h", "+1h", "renovar +1h"].includes(n)) return "btn_renew_1h";
  if (["renovar 2h", "+2h", "renovar +2h"].includes(n)) return "btn_renew_2h";
  if (["liberar", "release", "soltar", "3"].includes(n)) return "btn_release";
  if (["liberar agora"].includes(n)) return "btn_release_now";
  if (["ajuda", "help", "como funciona", "?"].includes(n)) return "btn_how_it_works";
  if (["disponíveis", "disponiveis", "ver disponiveis", "portas"].includes(n)) return "btn_view_available";
  if (["reservar", "nova reserva"].includes(n)) return "btn_new_reservation";
  if (["histórico", "historico", "history"].includes(n)) return "btn_history";
  return null;
}

// POST /api/webhooks/whatsapp
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body;
    console.log("Webhook received:", JSON.stringify(body).substring(0, 500));

    const event = body?.data || body;
    const key = event?.key || body?.key;
    const remoteJid = key?.remoteJid || "";
    const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");

    if (!senderPhone) {
      return res.json({ ok: true, skipped: "no_sender" });
    }

    // Detect button click or text command
    let buttonId: string | null = null;
    const buttonResponse = event?.data?.buttonResponseMessage || event?.buttonResponseMessage;
    if (buttonResponse?.selectedButtonId) {
      buttonId = buttonResponse.selectedButtonId;
    }

    if (!buttonId) {
      const messageText =
        event?.data?.message?.conversation ||
        event?.data?.message?.extendedTextMessage?.text ||
        event?.message?.conversation ||
        event?.message?.extendedTextMessage?.text || "";
      if (messageText) buttonId = parseTextCommand(messageText);
    }

    if (!buttonId) {
      return res.json({ ok: true, skipped: "not_actionable" });
    }

    console.log(`Processing action: ${buttonId} from ${senderPhone}`);

    const person = await findPersonByPhone(senderPhone);

    // Get UAZAPI settings
    const { rows: serverRows } = await pool.query(
      `SELECT value FROM platform_settings WHERE key = 'uazapi_server_url' LIMIT 1`
    );
    const serverUrl = serverRows[0]?.value as string;
    if (!serverUrl) return res.json({ ok: true, skipped: "no_uazapi" });

    let instanceToken = "";
    if (person?.company_id) {
      const { rows } = await pool.query(
        `SELECT instance_token FROM company_whatsapp WHERE company_id = $1 AND status = 'connected' LIMIT 1`,
        [person.company_id]
      );
      instanceToken = rows[0]?.instance_token || "";
    }
    if (!instanceToken) return res.json({ ok: true, skipped: "no_instance" });

    const baseUrl = (serverUrl as string).replace(/\/$/, "");
    let replyText = "";

    switch (buttonId) {
      case "btn_view_details": {
        if (!person?.id) { replyText = "❌ Não foi possível identificar seu cadastro."; break; }
        const door = await getActiveReservation(person.id);
        if (!door) { replyText = "📦 Você não tem nenhuma reserva ativa no momento."; break; }
        const { rows: lockerRows } = await pool.query(`SELECT name, location FROM lockers WHERE id = $1`, [door.locker_id]);
        const locker = lockerRows[0];
        const doorLabel = door.label || `Porta #${door.door_number}`;
        const expiresTime = door.expires_at ? new Date(door.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "Sem prazo";
        replyText = `📋 *Detalhes da sua reserva*\n\n📦 *Porta:* ${doorLabel}\n🏢 *Armário:* ${locker?.name || "—"}\n📍 *Local:* ${locker?.location || "—"}\n⏰ *Expira às:* ${expiresTime}`;
        break;
      }
      case "btn_extend":
      case "btn_renew_2h": {
        if (!person?.id) { replyText = "❌ Não identificado."; break; }
        const door = await getActiveReservation(person.id);
        if (!door) { replyText = "📦 Sem reserva ativa para renovar."; break; }
        if (!door.expires_at) { replyText = "ℹ️ Reserva permanente, não precisa renovar."; break; }
        const hours = buttonId === "btn_renew_2h" ? 2 : 1;
        const newExpires = new Date(new Date(door.expires_at).getTime() + hours * 3600000);
        await pool.query(`UPDATE locker_doors SET expires_at = $1 WHERE id = $2`, [newExpires.toISOString(), door.id]);
        await pool.query(`UPDATE locker_reservations SET expires_at = $1, renewed_count = renewed_count + 1, expiry_notified = false WHERE door_id = $2 AND status = 'active'`, [newExpires.toISOString(), door.id]);
        replyText = `✅ *Renovada!* Novo prazo: ${newExpires.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} (+${hours}h)`;
        break;
      }
      case "btn_renew_1h": {
        if (!person?.id) { replyText = "❌ Não identificado."; break; }
        const door = await getActiveReservation(person.id);
        if (!door || !door.expires_at) { replyText = "📦 Sem reserva ativa."; break; }
        const newExp = new Date(new Date(door.expires_at).getTime() + 3600000);
        await pool.query(`UPDATE locker_doors SET expires_at = $1 WHERE id = $2`, [newExp.toISOString(), door.id]);
        await pool.query(`UPDATE locker_reservations SET expires_at = $1, renewed_count = renewed_count + 1, expiry_notified = false WHERE door_id = $2 AND status = 'active'`, [newExp.toISOString(), door.id]);
        replyText = `✅ *Renovada +1h!* Novo prazo: ${newExp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}`;
        break;
      }
      case "btn_release":
      case "btn_release_now": {
        if (!person?.id) { replyText = "❌ Não identificado."; break; }
        const door = await getActiveReservation(person.id);
        if (!door) { replyText = "📦 Sem reserva ativa."; break; }
        const now = new Date().toISOString();
        await pool.query(`UPDATE locker_doors SET status = 'available', occupied_by = NULL, occupied_at = NULL, occupied_by_person = NULL, usage_type = 'temporary', expires_at = NULL, scheduled_reservation_id = NULL WHERE id = $1`, [door.id]);
        await pool.query(`UPDATE locker_reservations SET status = 'released', released_at = $1 WHERE door_id = $2 AND status = 'active'`, [now, door.id]);
        replyText = `🔓 *Porta liberada!* ${door.label || `Porta #${door.door_number}`}`;
        break;
      }
      case "btn_how_it_works":
        replyText = `❓ *Como funciona?*\n\n1️⃣ Reservar\n2️⃣ Usar\n3️⃣ Renovar\n4️⃣ Liberar\n\nComandos: *status*, *renovar*, *liberar*, *ajuda*`;
        break;
      case "btn_view_available":
      case "btn_see_lockers": {
        if (!person?.company_id) { replyText = "❌ Empresa não identificada."; break; }
        const { rows: lockers } = await pool.query(`SELECT id, name, location FROM lockers WHERE company_id = $1`, [person.company_id]);
        if (!lockers.length) { replyText = "📦 Nenhum armário cadastrado."; break; }
        const lockerIds = lockers.map(l => l.id);
        const { rows: doors } = await pool.query(`SELECT locker_id, status FROM locker_doors WHERE locker_id = ANY($1)`, [lockerIds]);
        const summary = lockers.map(locker => {
          const ld = doors.filter(d => d.locker_id === locker.id);
          const avail = ld.filter(d => d.status === "available").length;
          return `${avail > 0 ? "🟢" : "🔴"} *${locker.name}* — ${avail}/${ld.length} disponíveis`;
        }).join("\n");
        replyText = `🔍 *Armários*\n\n${summary}`;
        break;
      }
      case "btn_new_reservation":
        replyText = "📦 Para reservar, acesse o sistema ou peça a um administrador.\n\nResponda *disponíveis* para ver portas livres.";
        break;
      case "btn_history":
        replyText = "📊 Acesse a plataforma para ver seu histórico completo.";
        break;
      case "btn_contact_support":
        replyText = "💬 Entre em contato com o administrador da sua empresa.\n\nResponda *ajuda* para ver comandos.";
        break;
      default:
        replyText = "❓ Comando não reconhecido. Responda *ajuda*.";
    }

    await sendReply(baseUrl, instanceToken, senderPhone, replyText);
    res.json({ ok: true, action: buttonId });
  } catch (error: any) {
    console.error("whatsapp-webhook error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export { router as whatsappWebhookRouter };
