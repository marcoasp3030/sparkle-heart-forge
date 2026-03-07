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

// Progressive lockout: increasing delays as failures accumulate
// 1-2 failures: no delay, 3 failures: 1 min, 4 failures: 5 min, 5+: 15 min
const LOCKOUT_TIERS = [
  { maxAttempts: 2, lockoutMinutes: 0 },
  { maxAttempts: 3, lockoutMinutes: 1 },
  { maxAttempts: 4, lockoutMinutes: 5 },
  { maxAttempts: 5, lockoutMinutes: 15 },
];
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
  if (falhas <= 1) return "info";
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

  // Determine which lockout tier applies
  let lockoutMinutes = 0;
  let maxForTier = Infinity;
  for (const tier of LOCKOUT_TIERS) {
    if (falhas >= tier.maxAttempts && tier.lockoutMinutes > lockoutMinutes) {
      lockoutMinutes = tier.lockoutMinutes;
      maxForTier = tier.maxAttempts;
    }
  }

  // Check if currently locked out
  if (lockoutMinutes > 0 && data && data.length > 0) {
    const lastAttempt = new Date(data[0].created_at).getTime();
    const unlockAt = lastAttempt + lockoutMinutes * 60 * 1000;
    const now = Date.now();

    if (now < unlockAt) {
      const minutos = Math.ceil((unlockAt - now) / 60000);
      return {
        bloqueado: true,
        tentativasRestantes: 0,
        minutosRestantes: Math.max(1, minutos),
        totalFalhas: falhas,
        nivel: "bloqueado",
        mensagem: gerarMensagem(falhas, 0, Math.max(1, minutos)),
      };
    }
  }

  // Not locked — calculate remaining attempts until next tier
  const nextTier = LOCKOUT_TIERS.find((t) => falhas < t.maxAttempts);
  const restantes = nextTier ? nextTier.maxAttempts - falhas : 0;
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
