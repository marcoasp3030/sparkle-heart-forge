import { useEffect, useRef, useCallback } from "react";
// supabase import removed - using api.ts for auth
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useToast } from "@/hooks/use-toast";
import { registrarAuditoria } from "@/services/auditoria";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE_MS = 2 * 60 * 1000; // warn 2 min before

export function useSessionTimeout() {
  const { session, signOut } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningRef = useRef<ReturnType<typeof setTimeout>>();

  const handleLogout = useCallback(async () => {
    await registrarAuditoria({
      action: "logout",
      resource_type: "auth",
      details: { reason: "inactivity_timeout" },
    });
    await signOut();
    toast({
      title: "Sessão expirada",
      description: "Você foi desconectado por inatividade.",
      variant: "destructive",
    });
  }, [signOut, toast]);

  const resetTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!session) return;

    warningRef.current = setTimeout(() => {
      toast({
        title: "Sessão expirando",
        description: "Sua sessão expirará em 2 minutos por inatividade.",
      });
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    timeoutRef.current = setTimeout(handleLogout, INACTIVITY_TIMEOUT_MS);
  }, [session, handleLogout, toast]);

  useEffect(() => {
    if (!session) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    const handler = () => resetTimers();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [session, resetTimers]);
}
