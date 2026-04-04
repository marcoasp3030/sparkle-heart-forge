import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ChevronDown,
  CheckCircle2, AlertCircle, Lock, Loader2, Zap
} from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LockCommand {
  id: number;
  acao: string;
  lock_id: number;
  status: string;
  resposta: string | null;
  origem: string | null;
  criado_em: string;
  executado_em: string | null;
}

interface HistoricoPortalProps {
  personId: string;
}

const lockStatusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pendente: { label: "Pendente", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock },
  executando: { label: "Executando", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Loader2 },
  executado: { label: "Executado", color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle2 },
  erro: { label: "Erro", color: "text-destructive", bg: "bg-destructive/10 border-destructive/20", icon: AlertCircle },
};

function getDuration(startsAt: string, endsAt: string | null): string {
  if (!endsAt) return "—";
  const mins = differenceInMinutes(new Date(endsAt), new Date(startsAt));
  if (mins < 60) return `${mins}min`;
  const hours = differenceInHours(new Date(endsAt), new Date(startsAt));
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}min` : `${hours}h`;
}

export default function HistoricoPortal({ personId }: HistoricoPortalProps) {
  const [lockCommands, setLockCommands] = useState<LockCommand[]>([]);
  const [lockDoorsMap, setLockDoorsMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAllCommands, setShowAllCommands] = useState(false);
  const INITIAL_COUNT = 10;

  useEffect(() => {
    const load = async () => {
      try {
        const historicoRes = await api.get("/mobile/historico?limit=200");
        const cmdsData = historicoRes.data?.data || [];
        setLockCommands(cmdsData as LockCommand[]);
      } catch (err) {
        console.error("[HISTORICO] Erro ao carregar:", err);
      }
      setLoading(false);
    };
    load();
  }, [personId]);

  const visibleCommands = showAllCommands ? lockCommands : lockCommands.slice(0, INITIAL_COUNT);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasCommands = lockCommands.length > 0;

  if (!hasCommands) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card border-border/50">
          <CardContent className="p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Nenhum histórico</h3>
            <p className="text-sm text-muted-foreground">
              Quando você abrir fechaduras, o histórico aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-primary">{lockCommands.length}</p>
            <p className="text-[10px] text-muted-foreground">Total de Comandos</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-secondary">{lockCommands.filter(c => c.status === "executado").length}</p>
            <p className="text-[10px] text-muted-foreground">Executados</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Lock commands list */}
      <div className="space-y-2">
        <AnimatePresence>
          {visibleCommands.map((cmd, i) => (
            <motion.div
              key={cmd.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <LockCommandCard command={cmd} doorLabel={lockDoorsMap.get(cmd.lock_id) || `Lock #${cmd.lock_id}`} />
            </motion.div>
          ))}
        </AnimatePresence>
        {lockCommands.length > INITIAL_COUNT && !showAllCommands && (
          <Button variant="ghost" className="w-full text-sm text-muted-foreground" onClick={() => setShowAllCommands(true)}>
            <ChevronDown className="h-4 w-4 mr-1" />
            Ver mais ({lockCommands.length - INITIAL_COUNT} restantes)
          </Button>
        )}
      </div>
    </div>
  );
}

function LockCommandCard({ command, doorLabel }: { command: LockCommand; doorLabel: string }) {
  const cfg = lockStatusConfig[command.status] || lockStatusConfig.pendente;
  const Icon = cfg.icon;

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-9 w-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
              <Icon className={`h-4 w-4 ${cfg.color} ${command.status === "executando" ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{doorLabel}</p>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 flex-shrink-0">#{command.id}</Badge>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                <span>{format(new Date(command.criado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</span>
                {command.origem && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 border-border/50">{command.origem}</Badge>
                )}
              </div>
            </div>
          </div>
          <Badge variant="outline" className={`text-[10px] flex-shrink-0 border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </Badge>
        </div>

        {(command.executado_em || command.resposta) && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {command.executado_em && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {getDuration(command.criado_em, command.executado_em)} para executar
                </span>
              )}
              {command.resposta && (
                <span className="flex items-center gap-1 truncate">→ {command.resposta}</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReservationCard({ reservation }: { reservation: ReservationHistory }) {
  const cfg = statusConfig[reservation.status] || statusConfig.active;
  const endTime = reservation.released_at || reservation.expires_at;
  const duration = getDuration(reservation.starts_at, endTime);
  const doorLabel = reservation.door ? (reservation.door.label || `Porta ${reservation.door.door_number}`) : "Porta";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{doorLabel}</p>
            {reservation.locker && <span className="text-[10px] text-muted-foreground">• {reservation.locker.name}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(new Date(reservation.starts_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {endTime && <> → {format(new Date(endTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${cfg.bg} ${cfg.color} border`}>{cfg.label}</Badge>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{duration}</span>
        <span className="flex items-center gap-1">
          <Archive className="h-3 w-3" />
          {reservation.door?.size === "small" ? "P" : reservation.door?.size === "medium" ? "M" : "G"}
        </span>
        {reservation.usage_type === "temporary" && (
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" />Temporário</span>
        )}
        {reservation.renewed_count > 0 && (
          <span className="flex items-center gap-1 text-primary"><RefreshCw className="h-3 w-3" />{reservation.renewed_count}x renovada</span>
        )}
      </div>
    </div>
  );
}

function RenewalCard({ renewal }: { renewal: RenewalHistory }) {
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "Pendente", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
    approved: { label: "Aprovada", color: "text-green-600 bg-green-500/10 border-green-500/20" },
    rejected: { label: "Recusada", color: "text-destructive bg-destructive/10 border-destructive/20" },
  };
  const st = statusMap[renewal.status] || statusMap.pending;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Renovação de +{renewal.requested_hours}h</p>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(renewal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] flex-shrink-0 border ${st.color}`}>{st.label}</Badge>
      </div>
      {renewal.reviewed_at && (
        <p className="text-[10px] text-muted-foreground">
          Revisado em {format(new Date(renewal.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}
      {renewal.admin_notes && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2">{renewal.admin_notes}</p>
      )}
    </div>
  );
}
