import { useState, useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import {
  Lock, Unlock, Package, MapPin, Search,
  ChevronRight, Wrench, TrendingUp, BarChart3, Droplets, Timer
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";
import GraficosDashboard from "@/components/dashboard/GraficosDashboard";

import FiltrosDashboard, { type DashboardFilters } from "@/components/dashboard/FiltrosDashboard";
import CountdownPorta from "@/components/armario/CountdownPorta";

const statusConfig = {
  occupied: { label: "Ocupado", className: "bg-primary/10 text-primary border-primary/20" },
  available: { label: "Disponível", className: "bg-success/10 text-success border-success/20" },
  maintenance: { label: "Manutenção", className: "bg-accent/10 text-accent border-accent/20" },
  hygienizing: { label: "Higienização", className: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
};

type DoorWithLocker = {
  id: string;
  door_number: number;
  status: string;
  occupied_by: string | null;
  occupied_at: string | null;
  expires_at: string | null;
  locker_id: string;
  locker_name: string;
  locker_location: string;
  occupant_name: string | null;
};

// Animated counter component
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, v => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.8, ease: "easeOut" });
    const unsubscribe = rounded.on("change", v => setDisplay(v));
    return () => { controls.stop(); unsubscribe(); };
  }, [value]);

  return <span className={className}>{display}</span>;
}

// Mini sparkline using SVG
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60, h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PainelDeControle = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [doors, setDoors] = useState<DoorWithLocker[]>([]);
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, maintenance: 0, hygienizing: 0 });
  const [filters, setFilters] = useState<DashboardFilters>({ period: "all", lockerId: null, status: null });
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [sparkData, setSparkData] = useState<Record<string, number[]>>({});
  const { selectedCompany } = useCompany();

  useEffect(() => {
    if (!selectedCompany) {
      setLoading(false);
      return;
    }
    fetchData();
    const interval = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(interval);
  }, [selectedCompany]);

  // Build sparkline data from historical reservations
  useEffect(() => {
    if (!selectedCompany) return;
    buildSparkData();
  }, [selectedCompany]);

  const buildSparkData = async () => {
    const { data: lockers } = await supabase
      .from("lockers").select("id").eq("company_id", selectedCompany!.id);
    if (!lockers?.length) return;
    const lockerIds = lockers.map(l => l.id);

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: reservations } = await supabase
      .from("locker_reservations")
      .select("status, starts_at")
      .in("locker_id", lockerIds)
      .gte("starts_at", since.toISOString());

    if (!reservations?.length) return;

    // Group by day for last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const occupiedByDay = days.map(day => reservations.filter(r => r.starts_at.slice(0, 10) === day && r.status === "active").length);
    const totalByDay = days.map(day => reservations.filter(r => r.starts_at.slice(0, 10) === day).length);

    setSparkData({
      total: totalByDay,
      occupied: occupiedByDay,
      available: totalByDay.map((t, i) => Math.max(0, t - occupiedByDay[i])),
      maintenance: days.map(() => 0),
      hygienizing: days.map(() => 0),
    });
  };

  const fetchData = async (showLoading = true) => {
    if (showLoading && doors.length === 0) setLoading(true);

    const { data: lockers } = await supabase
      .from("lockers")
      .select("id, name, location")
      .eq("company_id", selectedCompany!.id);

    if (!lockers || lockers.length === 0) {
      setDoors([]);
      setStats({ total: 0, available: 0, occupied: 0, maintenance: 0, hygienizing: 0 });
      setLoading(false);
      return;
    }

    const lockerIds = lockers.map((l) => l.id);
    const lockerMap = Object.fromEntries(lockers.map((l) => [l.id, l]));

    const { data: doorsData } = await supabase
      .from("locker_doors")
      .select("id, door_number, status, occupied_by, occupied_at, expires_at, locker_id")
      .in("locker_id", lockerIds);

    if (!doorsData) {
      setLoading(false);
      return;
    }

    const occupantIds = doorsData.filter((d) => d.occupied_by).map((d) => d.occupied_by!);
    let profileMap: Record<string, string> = {};
    if (occupantIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", occupantIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name || "Sem nome"]));
      }
    }

    const mapped: DoorWithLocker[] = doorsData.map((d) => ({
      id: d.id,
      door_number: d.door_number,
      status: d.status,
      occupied_by: d.occupied_by,
      occupied_at: d.occupied_at,
      expires_at: d.expires_at,
      locker_id: d.locker_id,
      locker_name: lockerMap[d.locker_id]?.name || "",
      locker_location: lockerMap[d.locker_id]?.location || "",
      occupant_name: d.occupied_by ? profileMap[d.occupied_by] || null : null,
    }));

    setDoors(mapped);
    setStats({
      total: mapped.length,
      available: mapped.filter((d) => d.status === "available").length,
      occupied: mapped.filter((d) => d.status === "occupied").length,
      maintenance: mapped.filter((d) => d.status === "maintenance").length,
      hygienizing: mapped.filter((d) => d.status === "hygienizing").length,
    });
    setLoading(false);
  };

  // Apply filters to doors
  const filteredDoors = useMemo(() => {
    let result = doors;

    if (filters.lockerId) {
      result = result.filter(d => d.locker_id === filters.lockerId);
    }
    if (filters.status) {
      result = result.filter(d => d.status === filters.status);
    }
    if (search) {
      result = result.filter(d =>
        d.locker_name.toLowerCase().includes(search.toLowerCase()) ||
        d.locker_location.toLowerCase().includes(search.toLowerCase()) ||
        (d.occupant_name && d.occupant_name.toLowerCase().includes(search.toLowerCase())) ||
        `${d.door_number}`.includes(search)
      );
    }
    if (filters.period !== "all") {
      const now = Date.now();
      const ms = filters.period === "today" ? 86400000 : filters.period === "7d" ? 604800000 : 2592000000;
      result = result.filter(d => !d.occupied_at || (now - new Date(d.occupied_at).getTime()) <= ms);
    }

    return result;
  }, [doors, filters, search]);

  // Filtered stats
  const filteredStats = useMemo(() => ({
    total: filteredDoors.length,
    available: filteredDoors.filter(d => d.status === "available").length,
    occupied: filteredDoors.filter(d => d.status === "occupied").length,
    maintenance: filteredDoors.filter(d => d.status === "maintenance").length,
    hygienizing: filteredDoors.filter(d => d.status === "hygienizing").length,
  }), [filteredDoors]);

  const occupancyRate = filteredStats.total > 0 ? Math.round((filteredStats.occupied / filteredStats.total) * 100) : 0;

  const statCards = [
    { key: "total", label: "Total de Portas", value: filteredStats.total, icon: Lock, sublabel: "cadastradas", gradient: "from-secondary to-secondary/70", iconBg: "bg-secondary/10", iconColor: "text-secondary", sparkColor: "hsl(224, 60%, 48%)" },
    { key: "available", label: "Disponíveis", value: filteredStats.available, icon: Unlock, sublabel: "livres agora", gradient: "from-success to-success/70", iconBg: "bg-success/10", iconColor: "text-success", sparkColor: "hsl(152, 60%, 42%)" },
    { key: "occupied", label: "Ocupadas", value: filteredStats.occupied, icon: Package, sublabel: "em uso", gradient: "from-primary to-primary/70", iconBg: "bg-primary/10", iconColor: "text-primary", sparkColor: "hsl(330, 81%, 46%)" },
    { key: "maintenance", label: "Manutenção", value: filteredStats.maintenance, icon: Wrench, sublabel: "indisponíveis", gradient: "from-accent to-accent/70", iconBg: "bg-accent/10", iconColor: "text-accent", sparkColor: "hsl(25, 95%, 53%)" },
    { key: "hygienizing", label: "Higienização", value: filteredStats.hygienizing, icon: Droplets, sublabel: "em limpeza", gradient: "from-cyan-500 to-cyan-500/70", iconBg: "bg-cyan-500/10", iconColor: "text-cyan-600", sparkColor: "hsl(187, 85%, 43%)" },
  ];

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Painel de Controle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCompany
              ? `Monitoramento em tempo real — ${selectedCompany.name}`
              : "Selecione uma empresa para visualizar os dados."}
          </p>
        </div>
        {!loading && filteredStats.total > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 rounded-full bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Taxa de ocupação: <span className="font-bold text-foreground">{occupancyRate}%</span>
          </motion.div>
        )}
      </motion.div>

      {/* Filters */}
      {selectedCompany && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <FiltrosDashboard filters={filters} onChange={setFilters} />
        </motion.div>
      )}

      {/* Stat Cards - Interactive */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        {statCards.map((stat, i) => {
          const isExpanded = expandedCard === stat.key;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card
                className={`group relative overflow-hidden border-border/40 shadow-card hover:shadow-elevated transition-all duration-300 cursor-pointer ${
                  isExpanded ? "ring-2 ring-primary/30" : ""
                }`}
                onClick={() => setExpandedCard(isExpanded ? null : stat.key)}
              >
                {/* Gradient accent stripe */}
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                <CardContent className="p-3 pt-4 md:p-5 md:pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 md:space-y-3">
                      {loading ? (
                        <>
                          <Skeleton className="h-8 md:h-10 w-12 md:w-16" />
                          <Skeleton className="h-4 w-20 md:w-24" />
                        </>
                      ) : (
                        <>
                          <p className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">
                            <AnimatedNumber value={stat.value} />
                          </p>
                          <div>
                            <p className="text-xs md:text-sm font-semibold text-foreground/80">{stat.label}</p>
                            <p className="text-[10px] md:text-xs text-muted-foreground">{stat.sublabel}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`rounded-lg md:rounded-xl p-2 md:p-2.5 ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                        <stat.icon className={`h-4 w-4 md:h-5 md:w-5 ${stat.iconColor}`} />
                      </div>
                      {sparkData[stat.key] && !loading && (
                        <MiniSparkline data={sparkData[stat.key]} color={stat.sparkColor} />
                      )}
                    </div>
                  </div>
                  {/* Mini progress bar */}
                  {!loading && filteredStats.total > 0 && (
                    <div className="mt-4">
                      <Progress
                        value={(stat.value / filteredStats.total) * 100}
                        className="h-1.5 bg-muted/50"
                      />
                    </div>
                  )}
                  {/* Expanded detail */}
                  {isExpanded && !loading && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-3 pt-3 border-t border-border/30"
                    >
                      <p className="text-[11px] text-muted-foreground">
                        {stat.value > 0 ? (
                          <>
                            Representa <span className="font-semibold text-foreground">
                              {Math.round((stat.value / filteredStats.total) * 100)}%
                            </span> do total
                          </>
                        ) : (
                          "Nenhuma porta nesta categoria"
                        )}
                      </p>
                      {stat.key === "occupied" && filteredStats.occupied > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {filteredDoors.filter(d => d.status === "occupied" && d.expires_at).length} com prazo definido
                        </p>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Occupancy Summary Bar */}
      {!loading && filteredStats.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <Card className="border-border/40 shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">Distribuição de Status</span>
                </div>
                <span className="text-xs text-muted-foreground">{filteredStats.total} portas</span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {filteredStats.occupied > 0 && (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(filteredStats.occupied / filteredStats.total) * 100}%` }} transition={{ duration: 0.8, delay: 0.5 }} className="bg-primary" />
                )}
                {filteredStats.available > 0 && (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(filteredStats.available / filteredStats.total) * 100}%` }} transition={{ duration: 0.8, delay: 0.6 }} className="bg-success" />
                )}
                {filteredStats.maintenance > 0 && (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(filteredStats.maintenance / filteredStats.total) * 100}%` }} transition={{ duration: 0.8, delay: 0.7 }} className="bg-accent" />
                )}
                {filteredStats.hygienizing > 0 && (
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(filteredStats.hygienizing / filteredStats.total) * 100}%` }} transition={{ duration: 0.8, delay: 0.8 }} className="bg-cyan-500" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" /><span className="text-muted-foreground">Ocupadas ({filteredStats.occupied})</span></div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success" /><span className="text-muted-foreground">Disponíveis ({filteredStats.available})</span></div>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-accent" /><span className="text-muted-foreground">Manutenção ({filteredStats.maintenance})</span></div>
                {filteredStats.hygienizing > 0 && (
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /><span className="text-muted-foreground">Higienização ({filteredStats.hygienizing})</span></div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Hygienizing Doors Widget */}
      {!loading && doors.filter(d => d.status === "hygienizing" && d.expires_at).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.38 }}>
          <Card className="border-cyan-500/20 shadow-card overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-cyan-400" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-lg p-2 bg-cyan-500/10"><Timer className="h-4 w-4 text-cyan-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Portas em Higienização</h3>
                  <p className="text-xs text-muted-foreground">Countdown em tempo real</p>
                </div>
                <Badge variant="outline" className="ml-auto bg-cyan-500/10 text-cyan-600 border-cyan-500/20 text-xs">
                  {doors.filter(d => d.status === "hygienizing").length} porta{doors.filter(d => d.status === "hygienizing").length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {doors.filter(d => d.status === "hygienizing" && d.expires_at).map(door => (
                  <motion.div key={door.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
                    <CountdownPorta expiresAt={door.expires_at!} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate font-mono">{door.locker_name} — Porta {door.door_number}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{door.locker_location || "Sem localização"}</span>
                      </div>
                    </div>
                    <Droplets className="h-4 w-4 text-cyan-500 animate-pulse flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Activity Feed + Charts side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <FeedAtividades />
        </div>
        <div className="lg:col-span-2">
          <GraficosDashboard />
        </div>
      </div>

      {/* Door List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
        <Card className="border-border/40 shadow-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Portas de Armários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? "Carregando..." : `${filteredDoors.length} porta${filteredDoors.length !== 1 ? "s" : ""} encontrada${filteredDoors.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, local ou ocupante..."
                className="pl-9 h-9 bg-muted/40 border-border/30 focus:bg-card transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))
            ) : filteredDoors.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <Lock className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {doors.length === 0
                    ? "Nenhuma porta cadastrada para esta empresa."
                    : "Nenhuma porta corresponde aos filtros."}
                </p>
              </div>
            ) : (
              filteredDoors.map((door, i) => (
                <motion.div
                  key={door.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.03 }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${statusConfig[door.status as keyof typeof statusConfig]?.className || "bg-muted"}`}>
                      {door.status === "occupied" ? <Lock className="h-4 w-4" /> : door.status === "available" ? <Unlock className="h-4 w-4" /> : door.status === "hygienizing" ? <Droplets className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground font-mono">{door.locker_name} — Porta {door.door_number}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />{door.locker_location || "Sem localização"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {door.occupant_name && (
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-foreground">{door.occupant_name}</p>
                        <p className="text-[11px] text-muted-foreground">Desde {formatTime(door.occupied_at)}</p>
                      </div>
                    )}
                    <Badge variant="outline" className={`text-[11px] font-medium px-2.5 py-0.5 ${statusConfig[door.status as keyof typeof statusConfig]?.className || ""}`}>
                      {statusConfig[door.status as keyof typeof statusConfig]?.label || door.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default PainelDeControle;
