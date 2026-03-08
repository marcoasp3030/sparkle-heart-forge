import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Archive, Unlock, XCircle, Timer, RefreshCw,
  ChevronDown, CalendarDays, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertCircle, Ban
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow, differenceInMinutes, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReservationHistory {
  id: string;
  starts_at: string;
  expires_at: string | null;
  released_at: string | null;
  status: string;
  usage_type: string;
  renewed_count: number;
  notes: string | null;
  created_at: string;
  door: {
    door_number: number;
    label: string | null;
    size: string;
  } | null;
  locker: {
    name: string;
    location: string;
  } | null;
}

interface RenewalHistory {
  id: string;
  door_id: string;
  status: string;
  requested_hours: number;
  created_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
}

interface HistoricoPortalProps {
  personId: string;
}

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  active: {
    label: "Ativa",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  released: {
    label: "Liberada",
    icon: Unlock,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  expired: {
    label: "Expirada",
    icon: Timer,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  cancelled: {
    label: "Cancelada",
    icon: Ban,
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
  },
  scheduled: {
    label: "Agendada",
    icon: CalendarDays,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
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
  const [reservations, setReservations] = useState<ReservationHistory[]>([]);
  const [renewals, setRenewals] = useState<RenewalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_COUNT = 10;

  useEffect(() => {
    const load = async () => {
      const [resResult, renewalResult] = await Promise.all([
        supabase
          .from("locker_reservations")
          .select("id, starts_at, expires_at, released_at, status, usage_type, renewed_count, notes, created_at, door_id, locker_id")
          .eq("person_id", personId)
          .order("created_at", { ascending: false }),
        supabase
          .from("renewal_requests")
          .select("id, door_id, status, requested_hours, created_at, reviewed_at, admin_notes")
          .eq("person_id", personId)
          .order("created_at", { ascending: false }),
      ]);

      if (resResult.data && resResult.data.length > 0) {
        const doorIds = [...new Set(resResult.data.map(r => r.door_id))];
        const lockerIds = [...new Set(resResult.data.map(r => r.locker_id))];

        const [doorsRes, lockersRes] = await Promise.all([
          supabase.from("locker_doors").select("id, door_number, label, size").in("id", doorIds),
          supabase.from("lockers").select("id, name, location").in("id", lockerIds),
        ]);

        const doorsMap = new Map(doorsRes.data?.map(d => [d.id, d]) || []);
        const lockersMap = new Map(lockersRes.data?.map(l => [l.id, l]) || []);

        const enriched: ReservationHistory[] = resResult.data.map(r => ({
          ...r,
          door: doorsMap.get(r.door_id) || null,
          locker: lockersMap.get(r.locker_id) || null,
        }));
        setReservations(enriched);
      }

      if (renewalResult.data) setRenewals(renewalResult.data as RenewalHistory[]);
      setLoading(false);
    };
    load();
  }, [personId]);

  // Build unified timeline
  type TimelineItem =
    | { type: "reservation"; data: ReservationHistory; date: Date }
    | { type: "renewal"; data: RenewalHistory; date: Date };

  const timeline: TimelineItem[] = [
    ...reservations.map(r => ({ type: "reservation" as const, data: r, date: new Date(r.created_at) })),
    ...renewals.map(r => ({ type: "renewal" as const, data: r, date: new Date(r.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const visibleTimeline = showAll ? timeline : timeline.slice(0, INITIAL_COUNT);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="shadow-card border-border/50">
          <CardContent className="p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Nenhum histórico</h3>
            <p className="text-sm text-muted-foreground">
              Quando você utilizar armários, o histórico aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-primary">{reservations.length}</p>
            <p className="text-[10px] text-muted-foreground">Reservas</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-secondary">
              {reservations.filter(r => r.status === "released").length}
            </p>
            <p className="text-[10px] text-muted-foreground">Liberadas</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-accent">
              {renewals.filter(r => r.status === "approved").length}
            </p>
            <p className="text-[10px] text-muted-foreground">Renovações</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[19px] top-6 bottom-6 w-[2px] bg-border/60 rounded-full" />

        <AnimatePresence>
          {visibleTimeline.map((item, i) => (
            <motion.div
              key={`${item.type}-${item.type === "reservation" ? item.data.id : item.data.id}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative flex gap-3 pb-4"
            >
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0 mt-1">
                {item.type === "reservation" ? (
                  <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center ${statusConfig[item.data.status]?.bg || "bg-muted border-border"}`}>
                    {(() => {
                      const cfg = statusConfig[item.data.status];
                      const Icon = cfg?.icon || Archive;
                      return <Icon className={`h-4 w-4 ${cfg?.color || "text-muted-foreground"}`} />;
                    })()}
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full border-2 bg-primary/10 border-primary/20 flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>

              {/* Content */}
              <Card className="flex-1 shadow-sm border-border/50 overflow-hidden">
                <CardContent className="p-3">
                  {item.type === "reservation" ? (
                    <ReservationCard reservation={item.data} />
                  ) : (
                    <RenewalCard renewal={item.data} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {timeline.length > INITIAL_COUNT && !showAll && (
        <Button
          variant="ghost"
          className="w-full text-sm text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          <ChevronDown className="h-4 w-4 mr-1" />
          Ver mais ({timeline.length - INITIAL_COUNT} restantes)
        </Button>
      )}
    </div>
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
            {reservation.locker && (
              <span className="text-[10px] text-muted-foreground">• {reservation.locker.name}</span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(new Date(reservation.starts_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {endTime && (
              <> → {format(new Date(endTime), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
            )}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${cfg.bg} ${cfg.color} border`}>
          {cfg.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {duration}
        </span>
        <span className="flex items-center gap-1">
          <Archive className="h-3 w-3" />
          {reservation.door?.size === "small" ? "P" : reservation.door?.size === "medium" ? "M" : "G"}
        </span>
        {reservation.usage_type === "temporary" && (
          <span className="flex items-center gap-1">
            <Timer className="h-3 w-3" />
            Temporário
          </span>
        )}
        {reservation.renewed_count > 0 && (
          <span className="flex items-center gap-1 text-primary">
            <RefreshCw className="h-3 w-3" />
            {reservation.renewed_count}x renovada
          </span>
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
          <p className="text-sm font-semibold text-foreground">
            Renovação de +{renewal.requested_hours}h
          </p>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(renewal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
        <Badge variant="outline" className={`text-[10px] flex-shrink-0 border ${st.color}`}>
          {st.label}
        </Badge>
      </div>
      {renewal.reviewed_at && (
        <p className="text-[10px] text-muted-foreground">
          Revisado em {format(new Date(renewal.reviewed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}
      {renewal.admin_notes && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2">
          {renewal.admin_notes}
        </p>
      )}
    </div>
  );
}
