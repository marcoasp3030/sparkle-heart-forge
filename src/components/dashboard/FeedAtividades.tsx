import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Lock, Unlock, RefreshCw, Wrench, Droplets, Clock, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";

interface ActivityEvent {
  id: string;
  type: "occupied" | "released" | "maintenance" | "hygienizing" | "renewed" | "available";
  door_number: number;
  locker_name: string;
  person_name: string | null;
  timestamp: string;
}

const eventConfig: Record<string, { icon: typeof Lock; label: string; color: string }> = {
  occupied: { icon: Lock, label: "Ocupada", color: "text-primary bg-primary/10" },
  released: { icon: Unlock, label: "Liberada", color: "text-success bg-success/10" },
  available: { icon: Unlock, label: "Disponível", color: "text-success bg-success/10" },
  maintenance: { icon: Wrench, label: "Manutenção", color: "text-accent bg-accent/10" },
  hygienizing: { icon: Droplets, label: "Higienização", color: "text-cyan-600 bg-cyan-500/10" },
  renewed: { icon: RotateCcw, label: "Renovada", color: "text-secondary bg-secondary/10" },
};

export default function FeedAtividades() {
  const { selectedCompany } = useCompany();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = useCallback(async (silent = false) => {
    if (!selectedCompany) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data: lockers } = await supabase
        .from("lockers").select("id, name").eq("company_id", selectedCompany.id);
      if (!lockers?.length) { setEvents([]); return; }

      const lockerIds = lockers.map(l => l.id);
      const lockerMap = new Map(lockers.map(l => [l.id, l.name]));

      const since = new Date();
      since.setHours(since.getHours() - 24);

      const { data: reservations } = await supabase
        .from("locker_reservations")
        .select("id, door_id, locker_id, person_id, status, starts_at, released_at, updated_at")
        .in("locker_id", lockerIds)
        .gte("updated_at", since.toISOString())
        .order("updated_at", { ascending: false })
        .limit(30);

      if (!reservations?.length) { setEvents([]); return; }

      const doorIds = [...new Set(reservations.map(r => r.door_id))];
      const personIds = [...new Set(reservations.filter(r => r.person_id).map(r => r.person_id!))];

      const [doorsRes, personsRes] = await Promise.all([
        supabase.from("locker_doors").select("id, door_number").in("id", doorIds),
        personIds.length > 0
          ? supabase.from("funcionarios_clientes").select("id, nome").in("id", personIds)
          : Promise.resolve({ data: [] }),
      ]);

      const doorMap = new Map((doorsRes.data || []).map(d => [d.id, d.door_number]));
      const personMap = new Map((personsRes.data || []).map(p => [p.id, p.nome]));

      const mapped: ActivityEvent[] = reservations.map(r => ({
        id: r.id,
        type: r.status === "active" ? "occupied" : r.status === "released" ? "released" : r.status as any,
        door_number: doorMap.get(r.door_id) || 0,
        locker_name: lockerMap.get(r.locker_id) || "",
        person_name: r.person_id ? personMap.get(r.person_id) || null : null,
        timestamp: r.updated_at,
      }));

      setEvents(mapped);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(() => fetchEvents(true), 15000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const formatTimeAgo = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (!selectedCompany) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <Card className="border-border/40 shadow-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Activity className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Atividade em Tempo Real</h3>
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              últimas 24h
            </Badge>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className="h-7 px-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/20">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma atividade nas últimas 24h
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map((event, i) => {
                const config = eventConfig[event.type] || eventConfig.available;
                const Icon = config.icon;
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className={`rounded-lg p-1.5 ${config.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {event.locker_name} — Porta {event.door_number}
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {config.label.toLowerCase()}
                        </span>
                      </p>
                      {event.person_name && (
                        <p className="text-[11px] text-muted-foreground truncate">{event.person_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(event.timestamp)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
