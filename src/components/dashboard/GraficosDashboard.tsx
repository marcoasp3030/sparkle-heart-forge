import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, TrendingUp, DoorOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

interface ReservationRow {
  door_id: string;
  locker_id: string;
  person_id: string | null;
  status: string;
  starts_at: string;
  expires_at: string | null;
  released_at: string | null;
}

const COLORS = [
  "hsl(330, 81%, 46%)", // primary
  "hsl(224, 60%, 48%)", // secondary
  "hsl(152, 60%, 42%)", // success
  "hsl(25, 95%, 53%)",  // accent
  "hsl(220, 9%, 46%)",  // muted
];

export default function GraficosDashboard() {
  const { selectedCompany } = useCompany();
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [doorMap, setDoorMap] = useState<Map<string, { door_number: number; label: string | null; locker_name: string }>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompany) { setLoading(false); return; }
    fetchData();
  }, [selectedCompany]);

  const fetchData = async () => {
    setLoading(true);
    const { data: lockers } = await supabase
      .from("lockers").select("id, name").eq("company_id", selectedCompany!.id);
    if (!lockers?.length) { setLoading(false); return; }

    const lockerIds = lockers.map(l => l.id);
    const lockerMap = new Map(lockers.map(l => [l.id, l]));

    const [resRes, doorsRes] = await Promise.all([
      supabase.from("locker_reservations")
        .select("door_id, locker_id, person_id, status, starts_at, expires_at, released_at")
        .in("locker_id", lockerIds)
        .order("starts_at", { ascending: false })
        .limit(1000),
      supabase.from("locker_doors")
        .select("id, door_number, label, locker_id")
        .in("locker_id", lockerIds),
    ]);

    setReservations(resRes.data || []);
    const dm = new Map<string, { door_number: number; label: string | null; locker_name: string }>();
    (doorsRes.data || []).forEach(d => {
      dm.set(d.id, { door_number: d.door_number, label: d.label, locker_name: lockerMap.get(d.locker_id)?.name || "" });
    });
    setDoorMap(dm);
    setLoading(false);
  };

  // 1. Peak hours (hourly distribution of starts_at)
  const peakHoursData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, "0")}h`, count: 0 }));
    reservations.forEach(r => {
      const h = new Date(r.starts_at).getHours();
      hours[h].count++;
    });
    return hours;
  }, [reservations]);

  // 2. Most popular doors (top 10)
  const popularDoorsData = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach(r => { counts[r.door_id] = (counts[r.door_id] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const d = doorMap.get(id);
        return { name: d ? (d.label || `#${d.door_number} (${d.locker_name})`) : id.slice(0, 8), usos: count };
      });
  }, [reservations, doorMap]);

  // 3. Status distribution (pie)
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
    const labels: Record<string, string> = { active: "Ativa", released: "Liberada", expired: "Expirada", scheduled: "Agendada", cancelled: "Cancelada" };
    return Object.entries(counts).map(([status, value]) => ({ name: labels[status] || status, value }));
  }, [reservations]);

  // 4. Daily usage (last 30 days)
  const dailyUsageData = useMemo(() => {
    const now = new Date();
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    reservations.forEach(r => {
      const day = r.starts_at.slice(0, 10);
      if (day in days) days[day]++;
    });
    return Object.entries(days).map(([date, usos]) => ({
      date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      usos,
    }));
  }, [reservations]);

  // 5. Average duration
  const avgDuration = useMemo(() => {
    const durations = reservations
      .filter(r => r.released_at || r.expires_at)
      .map(r => {
        const end = r.released_at || r.expires_at!;
        return (new Date(end).getTime() - new Date(r.starts_at).getTime()) / 60000;
      })
      .filter(d => d > 0 && d < 24 * 60);
    return durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  }, [reservations]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    );
  }

  if (reservations.length === 0) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border/50 shadow-lg rounded-lg px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-muted-foreground">{p.name}: <span className="font-medium text-foreground">{p.value}</span></p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-foreground">Métricas & Análises</h2>
        <span className="text-xs text-muted-foreground ml-2">({reservations.length} reservas analisadas)</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Reservas", value: reservations.length, icon: TrendingUp, color: "text-primary" },
          { label: "Ativas Agora", value: reservations.filter(r => r.status === "active").length, icon: DoorOpen, color: "text-success" },
          { label: "Tempo Médio", value: avgDuration > 60 ? `${Math.floor(avgDuration / 60)}h ${avgDuration % 60}min` : `${avgDuration} min`, icon: Clock, color: "text-secondary" },
          { label: "Portas Usadas", value: new Set(reservations.map(r => r.door_id)).size, icon: BarChart3, color: "text-accent" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Card className="border-border/40">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <div>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily usage trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Uso Diário (últimos 30 dias)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyUsageData}>
                  <defs>
                    <linearGradient id="gradientUsos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(330, 81%, 46%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(330, 81%, 46%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="usos" name="Usos" stroke="hsl(330, 81%, 46%)" fill="url(#gradientUsos)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Peak hours */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Horários de Pico</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Reservas" fill="hsl(224, 60%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Popular doors */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Portas Mais Populares</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={popularDoorsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="usos" name="Usos" fill="hsl(152, 60%, 42%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status distribution pie */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-border/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição de Status</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {statusData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
