import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lock, Unlock, Package, MapPin, Search,
  ChevronRight, Wrench, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  }, [selectedCompany]);

  const fetchData = async () => {
    setLoading(true);

    // Get lockers for this company
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

    // Get all doors for those lockers
    const { data: doorsData } = await supabase
      .from("locker_doors")
      .select("id, door_number, status, occupied_by, occupied_at, locker_id")
      .in("locker_id", lockerIds);

    if (!doorsData) {
      setLoading(false);
      return;
    }

    // Get occupant names
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

  const statCards = [
    { label: "Total", value: stats.total, icon: Lock, sublabel: "portas cadastradas" },
    { label: "Disponíveis", value: stats.available, icon: Unlock, sublabel: "livres agora", accent: "success" as const },
    { label: "Ocupados", value: stats.occupied, icon: Package, sublabel: "em uso agora", accent: "primary" as const },
    { label: "Manutenção", value: stats.maintenance, icon: Wrench, sublabel: "em manutenção", accent: "accent" as const },
  ];

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedCompany ? `Estatísticas de ${selectedCompany.name}` : "Selecione uma empresa para ver os dados."}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.08 }}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300 border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`rounded-lg p-2 ${
                    stat.accent === "success" ? "bg-success/10" :
                    stat.accent === "primary" ? "bg-primary/10" :
                    stat.accent === "accent" ? "bg-accent/10" : "bg-muted"
                  }`}>
                    <stat.icon className={`h-4 w-4 ${
                      stat.accent === "success" ? "text-success" :
                      stat.accent === "primary" ? "text-primary" :
                      stat.accent === "accent" ? "text-accent" : "text-muted-foreground"
                    }`} />
                  </div>
                </div>
                {loading ? (
                  <Skeleton className="h-9 w-16 mb-1" />
                ) : (
                  <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                )}
                <p className="text-sm font-medium text-muted-foreground mt-0.5">{stat.label}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{stat.sublabel}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Door List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="shadow-card border-border/50 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Portas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Visão geral de todas as portas de armários</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar porta..." className="pl-9 h-9 bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="divide-y divide-border/50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="px-6 py-16 text-center text-muted-foreground text-sm">
                {doors.length === 0 ? "Nenhuma porta cadastrada para esta empresa." : "Nenhuma porta encontrada."}
              </div>
            ) : (
              filtered.map((door, i) => (
                <motion.div
                  key={door.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${statusConfig[door.status as keyof typeof statusConfig]?.className || "bg-muted"}`}>
                      {door.status === "occupied" ? <Lock className="h-4 w-4" /> : door.status === "available" ? <Unlock className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
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
                        <p className="text-[11px] text-muted-foreground">Desde {formatTime(door.occupied_at)}</p>
                      </div>
                    )}
                    <Badge variant="outline" className={`text-[11px] font-medium px-2.5 py-0.5 ${statusConfig[door.status as keyof typeof statusConfig]?.className || ""}`}>
                      {statusConfig[door.status as keyof typeof statusConfig]?.label || door.status}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
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
