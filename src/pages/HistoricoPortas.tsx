import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  History, Search, Download, Clock, User, Calendar,
  ArrowUpDown, Filter, ChevronLeft, ChevronRight, DoorOpen
} from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface UsageRecord {
  id: string;
  doorId: string;
  doorNumber: number;
  doorLabel: string | null;
  lockerName: string;
  lockerLocation: string;
  personName: string | null;
  personType: string | null;
  personMatricula: string | null;
  usageType: string;
  status: string;
  startsAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  renewedCount: number;
  durationMinutes: number | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-success/10 text-success border-success/20" },
  scheduled: { label: "Agendada", className: "bg-secondary/10 text-secondary border-secondary/20" },
  released: { label: "Liberada", className: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expirada", className: "bg-accent/10 text-accent border-accent/20" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const ITEMS_PER_PAGE = 20;

export default function HistoricoPortas() {
  const { selectedCompany } = useCompany();
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lockerFilter, setLockerFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"recent" | "duration" | "door">("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedCompany) { setLoading(false); return; }
    fetchHistory();
  }, [selectedCompany]);

  const fetchHistory = async () => {
    setLoading(true);

    const { data: lockers } = await supabase
      .from("lockers")
      .select("id, name, location")
      .eq("company_id", selectedCompany!.id);

    if (!lockers || lockers.length === 0) { setRecords([]); setLoading(false); return; }

    const lockerIds = lockers.map(l => l.id);
    const lockerMap = new Map(lockers.map(l => [l.id, l]));

    const { data: reservations } = await supabase
      .from("locker_reservations")
      .select("id, door_id, locker_id, person_id, usage_type, status, starts_at, expires_at, released_at, renewed_count, created_at")
      .in("locker_id", lockerIds)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!reservations || reservations.length === 0) { setRecords([]); setLoading(false); return; }

    const doorIds = [...new Set(reservations.map(r => r.door_id))];
    const personIds = reservations.map(r => r.person_id).filter(Boolean) as string[];

    const [doorsRes, personsRes] = await Promise.all([
      supabase.from("locker_doors").select("id, door_number, label").in("id", doorIds),
      personIds.length > 0 ? supabase.from("funcionarios_clientes").select("id, nome, tipo, matricula").in("id", personIds) : { data: [] },
    ]);

    const doorMap = new Map((doorsRes.data || []).map(d => [d.id, d]));
    const personMap = new Map((personsRes.data || []).map(p => [p.id, p]));

    const mapped: UsageRecord[] = reservations.map(r => {
      const locker = lockerMap.get(r.locker_id);
      const door = doorMap.get(r.door_id);
      const person = r.person_id ? personMap.get(r.person_id) : null;

      const endTime = r.released_at || r.expires_at;
      let durationMinutes: number | null = null;
      if (endTime && r.starts_at) {
        durationMinutes = (new Date(endTime).getTime() - new Date(r.starts_at).getTime()) / 60000;
      } else if (r.status === "active" && r.starts_at) {
        durationMinutes = (Date.now() - new Date(r.starts_at).getTime()) / 60000;
      }

      return {
        id: r.id,
        doorId: r.door_id,
        doorNumber: door?.door_number || 0,
        doorLabel: door?.label || null,
        lockerName: locker?.name || "—",
        lockerLocation: locker?.location || "—",
        personName: person?.nome || null,
        personType: person?.tipo || null,
        personMatricula: person?.matricula || null,
        usageType: r.usage_type,
        status: r.status,
        startsAt: r.starts_at,
        expiresAt: r.expires_at,
        releasedAt: r.released_at,
        renewedCount: r.renewed_count,
        durationMinutes,
      };
    });

    setRecords(mapped);
    setLoading(false);
  };

  const uniqueLockers = useMemo(() => [...new Set(records.map(r => r.lockerName))], [records]);

  const filtered = useMemo(() => {
    let result = records.filter(r => {
      const matchSearch = !search ||
        (r.personName?.toLowerCase().includes(search.toLowerCase())) ||
        r.lockerName.toLowerCase().includes(search.toLowerCase()) ||
        String(r.doorNumber).includes(search) ||
        (r.doorLabel?.toLowerCase().includes(search.toLowerCase())) ||
        (r.personMatricula?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchLocker = lockerFilter === "all" || r.lockerName === lockerFilter;
      return matchSearch && matchStatus && matchLocker;
    });

    switch (sortBy) {
      case "duration": result.sort((a, b) => (b.durationMinutes ?? -1) - (a.durationMinutes ?? -1)); break;
      case "door": result.sort((a, b) => a.lockerName.localeCompare(b.lockerName) || a.doorNumber - b.doorNumber); break;
      default: break; // already sorted by recent
    }
    return result;
  }, [records, search, statusFilter, lockerFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // Stats
  const avgDuration = useMemo(() => {
    const durations = records.filter(r => r.durationMinutes !== null && r.durationMinutes > 0).map(r => r.durationMinutes!);
    return durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  }, [records]);

  const totalUses = records.length;
  const activeNow = records.filter(r => r.status === "active").length;

  const handleExportCSV = () => {
    const headers = ["Armário", "Localização", "Porta", "Pessoa", "Tipo", "Matrícula", "Uso", "Status", "Início", "Fim", "Duração", "Renovações"];
    const rows = filtered.map(r => [
      r.lockerName, r.lockerLocation, r.doorLabel || `#${r.doorNumber}`,
      r.personName || "—", r.personType === "funcionario" ? "Funcionário" : r.personType === "cliente" ? "Cliente" : "—",
      r.personMatricula || "—", r.usageType === "permanent" ? "Permanente" : "Temporário",
      statusConfig[r.status]?.label || r.status,
      formatDateTime(r.startsAt),
      r.releasedAt ? formatDateTime(r.releasedAt) : r.expiresAt ? formatDateTime(r.expiresAt) : "—",
      formatDuration(r.durationMinutes), String(r.renewedCount),
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `historico-portas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico de Uso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedCompany ? `Registro detalhado por porta — ${selectedCompany.name}` : "Selecione uma empresa"}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportCSV} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total de Usos", value: totalUses, icon: History, color: "text-secondary" },
          { label: "Em uso agora", value: activeNow, icon: DoorOpen, color: "text-success" },
          { label: "Tempo médio", value: formatDuration(avgDuration), icon: Clock, color: "text-primary" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 bg-muted/60`}>
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, porta, matrícula..." className="pl-9 h-9 bg-muted/40 border-border/30" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                <SelectItem value="active" className="text-xs">Ativa</SelectItem>
                <SelectItem value="released" className="text-xs">Liberada</SelectItem>
                <SelectItem value="expired" className="text-xs">Expirada</SelectItem>
                <SelectItem value="scheduled" className="text-xs">Agendada</SelectItem>
                <SelectItem value="cancelled" className="text-xs">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lockerFilter} onValueChange={v => { setLockerFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-auto min-w-[130px] text-xs"><SelectValue placeholder="Armário" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos armários</SelectItem>
                {uniqueLockers.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs"><ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent" className="text-xs">Mais recente</SelectItem>
                <SelectItem value="duration" className="text-xs">Maior duração</SelectItem>
                <SelectItem value="door" className="text-xs">Por porta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/40 overflow-hidden">
        <div className="overflow-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-20">
              <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Armário / Porta</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pessoa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Início</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Fim</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Duração</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Renov.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell>
                      <p className="text-sm font-semibold">{r.lockerName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {r.doorLabel || `Porta #${r.doorNumber}`} · {r.lockerLocation}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{r.personName || "—"}</p>
                          {r.personMatricula && <p className="text-[10px] text-muted-foreground">{r.personMatricula}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${statusConfig[r.status]?.className || ""}`}>
                        {statusConfig[r.status]?.label || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <Calendar className="h-3 w-3 inline mr-1" />{formatDateTime(r.startsAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {r.releasedAt ? formatDateTime(r.releasedAt) : r.expiresAt ? formatDateTime(r.expiresAt) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{formatDuration(r.durationMinutes)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.renewedCount > 0 ? (
                        <Badge variant="outline" className="text-[10px] bg-secondary/10 text-secondary border-secondary/20">{r.renewedCount}x</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground">{filtered.length} registro(s) · Página {safePage} de {totalPages}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
