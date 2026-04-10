import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, XCircle } from "lucide-react";

interface AgentStatusBadgeProps {
  /** Intervalo de polling em ms (padrão: 5000) */
  pollInterval?: number;
  className?: string;
}

const resolveBaseUrl = () => {
  const raw = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (raw) return /(^|\/)api(\/|$)/i.test(raw) ? raw : `${raw}/api`;
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  return isLocal ? "/api" : "https://pblocker.sistembr.com.br/api";
};

export function AgentStatusBadge({ pollInterval = 5000, className }: AgentStatusBadgeProps) {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const baseUrl = resolveBaseUrl();

    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem("auth_token") || "";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${baseUrl}/fechaduras/agent-status`, { headers });
        if (!res.ok) { setIsOnline(false); setLoading(false); return; }
        const data = await res.json();
        setIsOnline(data.online === true || data.status === "online");
      } catch {
        setIsOnline(false);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  if (loading) {
    return (
      <Badge variant="secondary" className={`animate-pulse ${className || ""}`}>
        Analisando Agente...
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`gap-1.5 px-3 py-1 ${
        isOnline
          ? "bg-emerald-500/15 text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
          : "bg-red-500/15 text-red-600 border-red-200 dark:text-red-400 dark:border-red-800"
      } ${className || ""}`}
    >
      {isOnline ? (
        <Activity className="w-3.5 h-3.5 animate-pulse" />
      ) : (
        <XCircle className="w-3.5 h-3.5" />
      )}
      {isOnline ? "Agente Online" : "Agente Offline"}
    </Badge>
  );
}
