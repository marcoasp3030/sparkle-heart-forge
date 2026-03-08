import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map button IDs to actions
type ButtonAction = {
  handler: (ctx: ActionContext) => Promise<string>;
};

interface ActionContext {
  supabase: ReturnType<typeof createClient>;
  senderPhone: string;
  personId: string | null;
  companyId: string | null;
  baseUrl: string;
  instanceToken: string;
}

async function findPersonByPhone(supabase: ReturnType<typeof createClient>, phone: string) {
  // Try matching with various formats
  const digits = phone.replace(/\D/g, "");
  const withoutCountry = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = withoutCountry.slice(0, 2);
  const number = withoutCountry.slice(2);

  const { data } = await supabase
    .from("funcionarios_clientes")
    .select("id, nome, company_id, telefone")
    .eq("ativo", true)
    .or(`telefone.ilike.%${withoutCountry}%,telefone.ilike.%${number}%`)
    .limit(1)
    .single();

  return data;
}

async function getActiveReservation(supabase: ReturnType<typeof createClient>, personId: string) {
  const { data } = await supabase
    .from("locker_doors")
    .select("id, door_number, label, locker_id, expires_at, status, usage_type")
    .eq("occupied_by_person", personId)
    .eq("status", "occupied")
    .limit(1)
    .single();

  return data;
}

async function sendReply(baseUrl: string, token: string, phone: string, text: string) {
  await fetch(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: JSON.stringify({ number: phone, text }),
  });
}

// ── Button Handlers ──────────────────────────────────────────

async function handleViewDetails(ctx: ActionContext): Promise<string> {
  if (!ctx.personId) return "❌ Não foi possível identificar seu cadastro. Entre em contato com o suporte.";

  const door = await getActiveReservation(ctx.supabase, ctx.personId);
  if (!door) return "📦 Você não tem nenhuma reserva ativa no momento.\n\nDeseja fazer uma nova reserva? Responda *reservar*.";

  const { data: locker } = await ctx.supabase.from("lockers").select("name, location").eq("id", door.locker_id).single();
  const doorLabel = door.label || `Porta #${door.door_number}`;
  const expiresTime = door.expires_at
    ? new Date(door.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "Sem prazo";

  return `📋 *Detalhes da sua reserva*\n\n` +
    `📦 *Porta:* ${doorLabel}\n` +
    `🏢 *Armário:* ${locker?.name || "—"}\n` +
    `📍 *Local:* ${locker?.location || "—"}\n` +
    `⏰ *Expira às:* ${expiresTime}\n` +
    `📊 *Status:* Ocupado\n` +
    `🔑 *Tipo:* ${door.usage_type === "temporary" ? "Temporário" : "Permanente"}`;
}

async function handleExtend(ctx: ActionContext, hours: number): Promise<string> {
  if (!ctx.personId) return "❌ Não foi possível identificar seu cadastro.";

  const door = await getActiveReservation(ctx.supabase, ctx.personId);
  if (!door) return "📦 Você não tem nenhuma reserva ativa para renovar.";
  if (!door.expires_at) return "ℹ️ Sua reserva é permanente e não precisa de renovação.";

  const currentExpires = new Date(door.expires_at);
  const newExpires = new Date(currentExpires.getTime() + hours * 60 * 60 * 1000);

  await ctx.supabase
    .from("locker_doors")
    .update({ expires_at: newExpires.toISOString() })
    .eq("id", door.id);

  // Update reservation
  await ctx.supabase
    .from("locker_reservations")
    .update({
      expires_at: newExpires.toISOString(),
      renewed_count: (await ctx.supabase
        .from("locker_reservations")
        .select("renewed_count")
        .eq("door_id", door.id)
        .eq("status", "active")
        .single()).data?.renewed_count + 1 || 1,
      expiry_notified: false,
    })
    .eq("door_id", door.id)
    .eq("status", "active");

  const newTime = newExpires.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `✅ *Reserva renovada com sucesso!*\n\n` +
    `📦 *Porta:* ${door.label || `Porta #${door.door_number}`}\n` +
    `⏰ *Novo prazo:* ${newTime}\n` +
    `➕ Estendida por mais ${hours}h.\n\nAproveite! 😊`;
}

async function handleRelease(ctx: ActionContext): Promise<string> {
  if (!ctx.personId) return "❌ Não foi possível identificar seu cadastro.";

  const door = await getActiveReservation(ctx.supabase, ctx.personId);
  if (!door) return "📦 Você não tem nenhuma reserva ativa para liberar.";

  const now = new Date().toISOString();

  await ctx.supabase
    .from("locker_doors")
    .update({
      status: "available",
      occupied_by: null,
      occupied_at: null,
      occupied_by_person: null,
      usage_type: "temporary",
      expires_at: null,
      scheduled_reservation_id: null,
    })
    .eq("id", door.id);

  await ctx.supabase
    .from("locker_reservations")
    .update({ status: "released", released_at: now })
    .eq("door_id", door.id)
    .eq("status", "active");

  return `🔓 *Porta liberada com sucesso!*\n\n` +
    `📦 *Porta:* ${door.label || `Porta #${door.door_number}`}\n\n` +
    `Sua porta foi liberada e está disponível. Obrigado! 🙏`;
}

async function handleHowItWorks(_ctx: ActionContext): Promise<string> {
  return `❓ *Como funciona o sistema de armários?*\n\n` +
    `1️⃣ *Reservar* — Peça a um administrador ou reserve pelo sistema\n` +
    `2️⃣ *Usar* — Dirija-se ao armário e utilize sua porta\n` +
    `3️⃣ *Renovar* — Estenda o prazo quando necessário\n` +
    `4️⃣ *Liberar* — Libere a porta ao terminar\n\n` +
    `📲 *Comandos disponíveis:*\n` +
    `• Responda *status* para ver sua reserva\n` +
    `• Responda *renovar* para estender o prazo\n` +
    `• Responda *liberar* para liberar sua porta\n` +
    `• Responda *ajuda* para ver este menu\n\n` +
    `Alertas automáticos serão enviados antes da expiração! ⏰`;
}

async function handleAvailable(ctx: ActionContext): Promise<string> {
  if (!ctx.companyId) return "❌ Empresa não identificada.";

  const { data: lockers } = await ctx.supabase
    .from("lockers")
    .select("id, name, location")
    .eq("company_id", ctx.companyId);

  if (!lockers || lockers.length === 0) return "📦 Nenhum armário cadastrado para sua empresa.";

  const lockerIds = lockers.map(l => l.id);
  const { data: doors } = await ctx.supabase
    .from("locker_doors")
    .select("locker_id, status")
    .in("locker_id", lockerIds);

  const summary = lockers.map(locker => {
    const lockerDoors = doors?.filter(d => d.locker_id === locker.id) || [];
    const available = lockerDoors.filter(d => d.status === "available").length;
    const total = lockerDoors.length;
    const emoji = available > 0 ? "🟢" : "🔴";
    return `${emoji} *${locker.name}* (${locker.location || "—"})\n   ${available}/${total} portas disponíveis`;
  }).join("\n\n");

  return `🔍 *Armários disponíveis*\n\n${summary}\n\n_Solicite uma reserva ao administrador ou acesse o sistema._`;
}

// ── Text Command Parser ──────────────────────────────────────

function parseTextCommand(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  if (["status", "detalhes", "minha reserva", "1"].includes(normalized)) return "btn_view_details";
  if (["renovar", "estender", "renew", "2"].includes(normalized)) return "btn_extend";
  if (["renovar 1h", "+1h", "renovar +1h"].includes(normalized)) return "btn_renew_1h";
  if (["renovar 2h", "+2h", "renovar +2h"].includes(normalized)) return "btn_renew_2h";
  if (["liberar", "release", "soltar", "3"].includes(normalized)) return "btn_release";
  if (["liberar agora"].includes(normalized)) return "btn_release_now";
  if (["ajuda", "help", "como funciona", "?"].includes(normalized)) return "btn_how_it_works";
  if (["disponíveis", "disponiveis", "ver disponiveis", "portas"].includes(normalized)) return "btn_view_available";
  if (["reservar", "nova reserva"].includes(normalized)) return "btn_new_reservation";
  if (["histórico", "historico", "history"].includes(normalized)) return "btn_history";
  return null;
}

// ── Main Handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).substring(0, 500));

    // UAZAPI sends various event formats — extract the relevant data
    // Button response: { data: { buttonResponseMessage: { selectedButtonId: "..." } }, key: { remoteJid: "..." } }
    // Text message: { data: { message: { conversation: "..." } }, key: { remoteJid: "..." } }
    const event = body?.data || body;
    const key = event?.key || body?.key;
    const remoteJid = key?.remoteJid || "";
    const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "");

    if (!senderPhone) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_sender" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect button click or text command
    let buttonId: string | null = null;

    // Button response
    const buttonResponse = event?.data?.buttonResponseMessage || event?.buttonResponseMessage;
    if (buttonResponse?.selectedButtonId) {
      buttonId = buttonResponse.selectedButtonId;
    }

    // Text command fallback
    if (!buttonId) {
      const messageText =
        event?.data?.message?.conversation ||
        event?.data?.message?.extendedTextMessage?.text ||
        event?.message?.conversation ||
        event?.message?.extendedTextMessage?.text ||
        "";

      if (messageText) {
        buttonId = parseTextCommand(messageText);
      }
    }

    if (!buttonId) {
      // Not a recognized action, ignore
      return new Response(JSON.stringify({ ok: true, skipped: "not_actionable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing action: ${buttonId} from ${senderPhone}`);

    // Find person by phone
    const person = await findPersonByPhone(supabase, senderPhone);

    // Get UAZAPI settings for reply
    const { data: serverUrlSetting } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "uazapi_server_url")
      .single();

    const serverUrl = serverUrlSetting?.value as string;
    if (!serverUrl) {
      console.log("UAZAPI not configured, can't reply");
      return new Response(JSON.stringify({ ok: true, skipped: "no_uazapi" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance token for the person's company
    let instanceToken = "";
    if (person?.company_id) {
      const { data: companyWa } = await supabase
        .from("company_whatsapp")
        .select("instance_token")
        .eq("company_id", person.company_id)
        .eq("status", "connected")
        .single();
      instanceToken = companyWa?.instance_token || "";
    }

    if (!instanceToken) {
      console.log("No connected WhatsApp instance for reply");
      return new Response(JSON.stringify({ ok: true, skipped: "no_instance" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = (serverUrl as string).replace(/\/$/, "");
    const ctx: ActionContext = {
      supabase,
      senderPhone,
      personId: person?.id || null,
      companyId: person?.company_id || null,
      baseUrl,
      instanceToken,
    };

    let replyText = "";

    switch (buttonId) {
      case "btn_view_details":
        replyText = await handleViewDetails(ctx);
        break;
      case "btn_extend":
      case "btn_renew_2h":
        replyText = await handleExtend(ctx, 2);
        break;
      case "btn_renew_1h":
        replyText = await handleExtend(ctx, 1);
        break;
      case "btn_release":
      case "btn_release_now":
        replyText = await handleRelease(ctx);
        break;
      case "btn_how_it_works":
        replyText = await handleHowItWorks(ctx);
        break;
      case "btn_view_available":
      case "btn_see_lockers":
        replyText = await handleAvailable(ctx);
        break;
      case "btn_new_reservation":
        replyText = "📦 Para fazer uma nova reserva, acesse o sistema ou solicite a um administrador.\n\n_Responda *disponíveis* para ver armários com portas livres._";
        break;
      case "btn_history":
        replyText = "📊 Seu histórico de reservas está disponível no sistema.\n\nAcesse a plataforma para ver detalhes completos das suas reservas anteriores.";
        break;
      case "btn_contact_support":
        replyText = "💬 *Suporte*\n\nPara falar com o suporte, entre em contato com o administrador da sua empresa.\n\n_Responda *ajuda* para ver os comandos disponíveis._";
        break;
      default:
        replyText = "❓ Comando não reconhecido.\n\nResponda *ajuda* para ver os comandos disponíveis.";
    }

    await sendReply(baseUrl, instanceToken, senderPhone, replyText);
    console.log(`Reply sent to ${senderPhone} for action ${buttonId}`);

    return new Response(JSON.stringify({ ok: true, action: buttonId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("whatsapp-webhook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
