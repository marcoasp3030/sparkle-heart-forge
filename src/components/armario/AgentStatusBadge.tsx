import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, XCircle } from "lucide-react";
import api from "@/lib/api";

interface AgentStatusBadgeProps {
  /** Intervalo de polling em ms (padrão: 5000) */
  pollInterval?: number;
  /** Exibir apenas para admins? Se false, sempre exibe */
  className?: string;
}

export function AgentStatusBadge({ pollInterval = 5000, className }: AgentStatusBadgeProps) {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data } = await api.get("/fechaduras/agent-status");
        // A API retorna { online: true/false } ou { status: "online"/"offline" }
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
