import { useState, useEffect } from "react";
import { Clock, UserCheck, Calendar, Lock, Search, Download, History, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface OccupiedDoorReport {
  id: string;
  door_number: number;
  label: string | null;
  size: string;
  usage_type: string;
  expires_at: string | null;
  occupied_at: string | null;
  locker_name: string;
  locker_location: string;
  person_name: string | null;
  person_type: string | null;
  person_matricula: string | null;
}

interface ReservationHistory {
  id: string;
  door_number: number;
  locker_name: string;
  person_name: string | null;
  person_type: string | null;
  usage_type: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  released_at: string | null;
  renewed_count: number;
  created_at: string;
}

interface RelatorioOcupacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RelatorioOcupacao({ open, onOpenChange }: RelatorioOcupacaoProps) {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState<OccupiedDoorReport[]>([]);
  const [history, setHistory] = useState<ReservationHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [tab, setTab] = useState("current");

  useEffect(() => {
    if (!open || !selectedCompany) return;
    fetchData();
  }, [open, selectedCompany]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchOccupied(), fetchHistory()]);
    setLoading(false);
  };

  const fetchOccupied = async () => {
    const { data: doors } = await supabase
      .from("locker_doors")
      .select("id, door_number, label, size, usage_type, expires_at, occupied_at, occupied_by_person, locker_id")
      .eq("status", "occupied");

    if (!doors || doors.length === 0) { setData([]); return; }

    const lockerIds = [...new Set(doors.map(d => d.locker_id))];
    const personIds = doors.map(d => d.occupied_by_person).filter(Boolean) as string[];

    const [lockersRes, personsRes] = await Promise.all([
      supabase.from("lockers").select("id, name, location").in("id", lockerIds),
      personIds.length > 0 ? supabase.from("funcionarios_clientes").select("id, nome, tipo, matricula").in("id", personIds) : { data: [] },
    ]);

    const lockersMap = new Map((lockersRes.data || []).map((l: any) => [l.id, l]));
    const personsMap = new Map((personsRes.data || []).map((p: any) => [p.id, p]));

    setData(doors.map(d => {
      const locker: any = lockersMap.get(d.locker_id);
      const person: any = d.occupied_by_person ? personsMap.get(d.occupied_by_person) : null;
      return {
        id: d.id, door_number: d.door_number, label: d.label, size: d.size,
        usage_type: d.usage_type || "temporary", expires_at: d.expires_at, occupied_at: d.occupied_at,
        locker_name: locker?.name || "—", locker_location: locker?.location || "—",
        person_name: person?.nome || null, person_type: person?.tipo || null, person_matricula: person?.matricula || null,
      };
    }));
  };

  const fetchHistory = async () => {
    const { data: reservations } = await supabase
      .from("locker_reservations")
      .select("id, door_id, locker_id, person_id, usage_type, status, starts_at, expires_at, released_at, renewed_count, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!reservations || reservations.length === 0) { setHistory([]); return; }

    const lockerIds = [...new Set(reservations.map(r => r.locker_id))];
    const doorIds = [...new Set(reservations.map(r => r.door_id))];
    const personIds = reservations.map(r => r.person_id).filter(Boolean) as string[];

    const [lockersRes, doorsRes, personsRes] = await Promise.all([
      supabase.from("lockers").select("id, name").in("id", lockerIds),
      supabase.from("locker_doors").select("id, door_number").in("id", doorIds),
      personIds.length > 0 ? supabase.from("funcionarios_clientes").select("id, nome, tipo").in("id", personIds) : { data: [] },
    ]);

    const lockersMap = new Map((lockersRes.data || []).map((l: any) => [l.id, l]));
    const doorsMap = new Map((doorsRes.data || []).map((d: any) => [d.id, d]));
    const personsMap = new Map((personsRes.data || []).map((p: any) => [p.id, p]));

    setHistory(reservations.map(r => {
      const locker = lockersMap.get(r.locker_id);
      const door = doorsMap.get(r.door_id);
      const person = r.person_id ? personsMap.get(r.person_id) : null;
      return {
        id: r.id, door_number: door?.door_number || 0, locker_name: locker?.name || "—",
        person_name: person?.nome || null, person_type: person?.tipo || null,
        usage_type: r.usage_type, status: r.status, starts_at: r.starts_at,
        expires_at: r.expires_at, released_at: r.released_at, renewed_count: r.renewed_count, created_at: r.created_at,
      };
    }));
  };

  const filtered = data.filter(d => {
    const matchSearch = !search ||
      (d.person_name?.toLowerCase().includes(search.toLowerCase())) ||
      d.locker_name.toLowerCase().includes(search.toLowerCase()) ||
      String(d.door_number).includes(search);
    const matchType = filterType === "all" || d.usage_type === filterType;
    return matchSearch && matchType;
  });

  const filteredHistory = history.filter(h => {
    const matchSearch = !search ||
      (h.person_name?.toLowerCase().includes(search.toLowerCase())) ||
      h.locker_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = historyFilter === "all" || h.status === historyFilter;
    return matchSearch && matchStatus;
  });

  const isExpired = (expiresAt: string | null) => expiresAt ? new Date(expiresAt) < new Date() : false;

  const statusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      active: { label: "Ativa", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
      scheduled: { label: "Agendada", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
      released: { label: "Liberada", className: "bg-muted text-muted-foreground border-border" },
      expired: { label: "Expirada", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
      cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive border-destructive/20" },
    };
    const c = configs[status] || configs.released;
    return <Badge variant="outline" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ["Armário", "Localização", "Porta", "Pessoa", "Tipo Pessoa", "Matrícula", "Uso", "Ocupado em", "Expira em"];
    const rows = filtered.map(d => [
      d.locker_name, d.locker_location, d.label || `#${d.door_number}`, d.person_name || "—",
      d.person_type === "funcionario" ? "Funcionário" : d.person_type === "cliente" ? "Cliente" : "—",
      d.person_matricula || "—", d.usage_type === "permanent" ? "Permanente" : "Temporário",
      d.occupied_at ? new Date(d.occupied_at).toLocaleDateString("pt-BR") : "—",
      d.expires_at ? new Date(d.expires_at).toLocaleDateString("pt-BR") : "—",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `relatorio-ocupacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40">
          <DialogTitle className="text-lg font-bold">Relatório de Armários</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col">
          <div className="px-6 pb-3 border-b border-border/20">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="current" className="text-xs gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                Ocupação atual
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" />
                Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-6 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-muted/50 border-transparent text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {tab === "current" ? (
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 w-auto min-w-[130px] bg-muted/50 border-transparent text-xs">
                  <SelectValue placeholder="Tipo de uso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  <SelectItem value="permanent" className="text-xs">Permanente</SelectItem>
                  <SelectItem value="temporary" className="text-xs">Temporário</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger className="h-9 w-auto min-w-[130px] bg-muted/50 border-transparent text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  <SelectItem value="active" className="text-xs">Ativa</SelectItem>
                  <SelectItem value="scheduled" className="text-xs">Agendada</SelectItem>
                  <SelectItem value="released" className="text-xs">Liberada</SelectItem>
                  <SelectItem value="expired" className="text-xs">Expirada</SelectItem>
                  <SelectItem value="cancelled" className="text-xs">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>

          <div className="overflow-auto max-h-[50vh] px-2">
            <TabsContent value="current" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16"><Lock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">Nenhuma porta ocupada.</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Armário</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Porta</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pessoa</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Uso</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Ocupado em</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Expira em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => (
                      <TableRow key={d.id} className="hover:bg-muted/30">
                        <TableCell>
                          <p className="text-sm font-medium">{d.locker_name}</p>
                          <p className="text-[11px] text-muted-foreground">{d.locker_location}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">{d.label || `#${d.door_number}`}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{d.person_name || "—"}</p>
                              {d.person_matricula && <p className="text-[11px] text-muted-foreground">{d.person_matricula}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${d.usage_type === "permanent" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                            <Clock className="h-3 w-3 mr-1" />
                            {d.usage_type === "permanent" ? "Permanente" : "Temporário"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.occupied_at ? new Date(d.occupied_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          {d.expires_at ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className={`text-xs font-medium ${isExpired(d.expires_at) ? "text-destructive" : "text-muted-foreground"}`}>
                                {new Date(d.expires_at).toLocaleDateString("pt-BR")}
                              </span>
                              {isExpired(d.expires_at) && <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Expirado</Badge>}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-16"><History className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" /><p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Armário</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Porta</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pessoa</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Início</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Fim</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-center">Renov.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((h) => (
                      <TableRow key={h.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium">{h.locker_name}</TableCell>
                        <TableCell className="font-mono text-sm font-medium">#{h.door_number}</TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{h.person_name || "—"}</p>
                          {h.person_type && (
                            <p className="text-[11px] text-muted-foreground">
                              {h.person_type === "funcionario" ? "Funcionário" : "Cliente"}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(h.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(h.starts_at).toLocaleDateString("pt-BR")}{" "}
                          {new Date(h.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.released_at
                            ? new Date(h.released_at).toLocaleDateString("pt-BR")
                            : h.expires_at
                              ? new Date(h.expires_at).toLocaleDateString("pt-BR")
                              : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {h.renewed_count > 0 ? (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                              <RefreshCw className="h-3 w-3 mr-0.5" />{h.renewed_count}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-3 border-t border-border/40 text-xs text-muted-foreground">
          {tab === "current"
            ? `${filtered.length} porta(s) ocupada(s)`
            : `${filteredHistory.length} registro(s)`}
        </div>
      </DialogContent>
    </Dialog>
  );
}
