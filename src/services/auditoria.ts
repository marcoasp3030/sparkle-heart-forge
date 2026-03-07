import { supabase } from "@/integrations/supabase/client";

type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "locker_access"
  | "locker_reserve"
  | "locker_release"
  | "locker_maintenance"
  | "permission_change"
  | "user_created"
  | "user_updated"
  | "password_change"
  | "branding_update"
  | "settings_update";

type ResourceType =
  | "auth"
  | "locker_door"
  | "locker"
  | "company"
  | "profile"
  | "permission"
  | "settings";

interface AuditEntry {
  action: AuditAction;
  resource_type: ResourceType;
  resource_id?: string;
  details?: Record<string, unknown>;
}

export async function registrarAuditoria(entry: AuditEntry) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? {},
      user_agent: navigator.userAgent,
    } as any);
  } catch (err) {
    console.error("Erro ao registrar auditoria:", err);
  }
}

// Lockout: 5 failed attempts → 60-second block
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const WINDOW_MINUTES = 30; // observation window

export type NivelAlerta = "info" | "aviso" | "perigo" | "bloqueado";

export interface StatusBloqueio {
  bloqueado: boolean;
  tentativasRestantes: number;
  minutosRestantes: number;
  totalFalhas: number;
  nivel: NivelAlerta;
  mensagem: string;
}

function calcularNivel(falhas: number): NivelAlerta {
  if (falhas === 0) return "info";
  if (falhas <= 2) return "info";
  if (falhas <= 3) return "aviso";
  if (falhas <= 4) return "perigo";
  return "bloqueado";
}

function gerarMensagem(falhas: number, restantes: number, minutosRestantes: number): string {
  if (falhas === 0) return "";

  if (minutosRestantes > 0) {
    return `Sua conta foi temporariamente bloqueada por segurança. Aguarde ${minutosRestantes} minuto(s) antes de tentar novamente.`;
  }

  if (restantes <= 1) {
    return "⚠️ Última tentativa! Após esta, sua conta será bloqueada temporariamente.";
  }

  if (restantes <= 2) {
    return `Atenção: restam apenas ${restantes} tentativas. Verifique se o Caps Lock está desligado e confira seu e-mail.`;
  }

  return `E-mail ou senha incorretos. Você ainda tem ${restantes} tentativa(s).`;
}

export async function verificarBloqueioLogin(email: string): Promise<StatusBloqueio> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("login_attempts")
    .select("id, created_at")
    .eq("email", email.toLowerCase())
    .eq("success", false)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  const falhas = data?.length ?? 0;

  // Check if locked out (5+ failures → 60s block)
  if (falhas >= MAX_ATTEMPTS && data && data.length > 0) {
    const lastAttempt = new Date(data[0].created_at).getTime();
    const unlockAt = lastAttempt + LOCKOUT_SECONDS * 1000;
    const now = Date.now();

    if (now < unlockAt) {
      const segundos = Math.ceil((unlockAt - now) / 1000);
      const minutos = Math.max(1, Math.ceil(segundos / 60));
      return {
        bloqueado: true,
        tentativasRestantes: 0,
        minutosRestantes: minutos,
        totalFalhas: falhas,
        nivel: "bloqueado",
        mensagem: `Sua conta foi temporariamente bloqueada por segurança. Aguarde ${segundos} segundo(s) antes de tentar novamente.`,
      };
    }
  }

  // Not locked — calculate remaining attempts
  const restantes = Math.max(0, MAX_ATTEMPTS - falhas);
  const nivel = calcularNivel(falhas);

  return {
    bloqueado: false,
    tentativasRestantes: Math.max(0, restantes),
    minutosRestantes: 0,
    totalFalhas: falhas,
    nivel,
    mensagem: gerarMensagem(falhas, restantes, 0),
  };
}

export async function registrarTentativaLogin(email: string, sucesso: boolean) {
  try {
    await supabase.from("login_attempts").insert({
      email: email.toLowerCase(),
      success: sucesso,
    } as any);
  } catch (err) {
    console.error("Erro ao registrar tentativa de login:", err);
  }
}
