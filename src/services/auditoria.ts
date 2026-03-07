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

// Rate limiting: check recent failed attempts for an email
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function verificarBloqueioLogin(email: string): Promise<{
  bloqueado: boolean;
  tentativasRestantes: number;
  minutosRestantes: number;
}> {
  const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact" })
    .eq("email", email.toLowerCase())
    .eq("success", false)
    .gte("created_at", cutoff);

  const falhas = data?.length ?? 0;

  if (falhas >= MAX_ATTEMPTS) {
    // Find oldest attempt in window to calculate remaining lockout
    const { data: oldest } = await supabase
      .from("login_attempts")
      .select("created_at")
      .eq("email", email.toLowerCase())
      .eq("success", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(1);

    const oldestTime = oldest?.[0]?.created_at
      ? new Date(oldest[0].created_at).getTime()
      : Date.now();
    const unlockAt = oldestTime + LOCKOUT_MINUTES * 60 * 1000;
    const minutos = Math.ceil((unlockAt - Date.now()) / 60000);

    return { bloqueado: true, tentativasRestantes: 0, minutosRestantes: Math.max(1, minutos) };
  }

  return {
    bloqueado: false,
    tentativasRestantes: MAX_ATTEMPTS - falhas,
    minutosRestantes: 0,
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
