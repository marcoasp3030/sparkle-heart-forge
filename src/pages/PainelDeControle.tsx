import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lock, Unlock, Package, MapPin, Search,
  ChevronRight, Wrench, TrendingUp, BarChart3
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";

const statusConfig = {
  occupied: { label: "Ocupado", className: "bg-primary/10 text-primary border-primary/20" },
  available: { label: "Disponível", className: "bg-success/10 text-success border-success/20" },
  maintenance: { label: "Manutenção", className: "bg-accent/10 text-accent border-accent/20" },
};

type DoorWithLocker = {
  id: string;
  door_number: number;
  status: string;
  occupied_by: string | null;
  occupied_at: string | null;
  locker_id: string;
  locker_name: string;
  locker_location: string;
  occupant_name: string | null;
};

const PainelDeControle = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [doors, setDoors] = useState<DoorWithLocker[]>([]);
  const [stats, setStats] = useState({ total: 0, available: 0, occupied: 0, maintenance: 0 });
  const { selectedCompany } = useCompany();

  useEffect(() => {
    if (!selectedCompany) {
      setLoading(false);
      return;
    }
    fetchData();

    // Subscribe to realtime changes on locker_doors
    const channel = supabase
      .channel("dashboard-doors")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locker_doors" },
        () => {
          // Re-fetch all data on any door change
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompany]);

  const fetchData = async () => {
    setLoading(true);

    const { data: lockers } = await supabase
      .from("lockers")
      .select("id, name, location")
      .eq("company_id", selectedCompany!.id);

    if (!lockers || lockers.length === 0) {
      setDoors([]);
      setStats({ total: 0, available: 0, occupied: 0, maintenance: 0 });
      setLoading(false);
      return;
    }

    const lockerIds = lockers.map((l) => l.id);
    const lockerMap = Object.fromEntries(lockers.map((l) => [l.id, l]));

    const { data: doorsData } = await supabase
      .from("locker_doors")
      .select("id, door_number, status, occupied_by, occupied_at, locker_id")
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
    });
    setLoading(false);
  };

  const filtered = doors.filter(
    (d) =>
      d.locker_name.toLowerCase().includes(search.toLowerCase()) ||
      d.locker_location.toLowerCase().includes(search.toLowerCase()) ||
      (d.occupant_name && d.occupant_name.toLowerCase().includes(search.toLowerCase())) ||
      `${d.door_number}`.includes(search)
  );

  const occupancyRate = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;

  const statCards = [
    {
      label: "Total de Portas",
      value: stats.total,
      icon: Lock,
      sublabel: "cadastradas",
      gradient: "from-secondary to-secondary/70",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
    },
    {
      label: "Disponíveis",
      value: stats.available,
      icon: Unlock,
      sublabel: "livres agora",
      gradient: "from-success to-success/70",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "Ocupadas",
      value: stats.occupied,
      icon: Package,
      sublabel: "em uso",
      gradient: "from-primary to-primary/70",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "Manutenção",
      value: stats.maintenance,
      icon: Wrench,
      sublabel: "indisponíveis",
      gradient: "from-accent to-accent/70",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
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
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Painel de Controle
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCompany
              ? `Monitoramento em tempo real — ${selectedCompany.name}`
              : "Selecione uma empresa para visualizar os dados."}
          </p>
        </div>
        {!loading && stats.total > 0 && (
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <Card className="group relative overflow-hidden border-border/40 shadow-card hover:shadow-elevated transition-all duration-300">
              {/* Gradient accent stripe */}
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
              <CardContent className="p-5 pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    {loading ? (
                      <>
                        <Skeleton className="h-10 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </>
                    ) : (
                      <>
                        <p className="text-4xl font-extrabold tracking-tight text-foreground">
                          {stat.value}
                        </p>
                        <div>
                          <p className="text-sm font-semibold text-foreground/80">{stat.label}</p>
                          <p className="text-xs text-muted-foreground">{stat.sublabel}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className={`rounded-xl p-2.5 ${stat.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </div>
                {/* Mini progress bar */}
                {!loading && stats.total > 0 && (
                  <div className="mt-4">
                    <Progress
                      value={(stat.value / stats.total) * 100}
                      className="h-1.5 bg-muted/50"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Occupancy Summary Bar */}
      {!loading && stats.total > 0 && (
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
                <span className="text-xs text-muted-foreground">{stats.total} portas</span>
              </div>
              {/* Stacked bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full">
                {stats.occupied > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.occupied / stats.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    className="bg-primary"
                  />
                )}
                {stats.available > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.available / stats.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="bg-success"
                  />
                )}
                {stats.maintenance > 0 && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.maintenance / stats.total) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.7 }}
                    className="bg-accent"
                  />
                )}
              </div>
              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Ocupadas ({stats.occupied})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-success" />
                  <span className="text-muted-foreground">Disponíveis ({stats.available})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                  <span className="text-muted-foreground">Manutenção ({stats.maintenance})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Door List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card className="border-border/40 shadow-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Portas de Armários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? "Carregando..." : `${filtered.length} porta${filtered.length !== 1 ? "s" : ""} encontrada${filtered.length !== 1 ? "s" : ""}`}
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
            ) : filtered.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <Lock className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {doors.length === 0
                    ? "Nenhuma porta cadastrada para esta empresa."
                    : "Nenhuma porta corresponde à busca."}
                </p>
              </div>
            ) : (
              filtered.map((door, i) => (
                <motion.div
                  key={door.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.03 }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        statusConfig[door.status as keyof typeof statusConfig]?.className || "bg-muted"
                      }`}
                    >
                      {door.status === "occupied" ? (
                        <Lock className="h-4 w-4" />
                      ) : door.status === "available" ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Wrench className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground font-mono">
                        {door.locker_name} — Porta {door.door_number}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {door.locker_location || "Sem localização"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {door.occupant_name && (
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-foreground">{door.occupant_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Desde {formatTime(door.occupied_at)}
                        </p>
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium px-2.5 py-0.5 ${
                        statusConfig[door.status as keyof typeof statusConfig]?.className || ""
                      }`}
                    >
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
