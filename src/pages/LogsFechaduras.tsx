import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Unlock, Search, Download, Clock, User, Calendar,
  Filter, ChevronLeft, ChevronRight, Building2, MapPin,
  CheckCircle2, AlertCircle, Loader2, TimerIcon, DoorOpen
} from "lucide-react";
import api from "@/lib/api";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CommandLog {
  id: number;
  lock_id: number;
  acao: string;
  status: string;
  origem: string | null;
  resposta: string | null;
  criado_em: string;
  executado_em: string | null;
  door_number: number | null;
  door_label: string | null;
  locker_name: string | null;
  locker_location: string | null;
  person_name: string | null;
  person_type: string | null;
  person_matricula: string | null;
}

const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
  pendente: { label: "Pendente", icon: TimerIcon, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  executando: { label: "Executando", icon: Loader2, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  executado: { label: "Executado", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  erro: { label: "Erro", icon: AlertCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const origemLabels: Record<string, string> = {
  portal: "Portal Usuário",
  web: "Painel Admin",
  painel: "Painel Admin",
  api: "API Externa",
  agente: "Agente Local",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
    " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatExecutionTime(criado: string, executado: string | null): string {
  if (!executado) return "—";
  const ms = new Date(executado).getTime() - new Date(criado).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ITEMS_PER_PAGE = 25;

export default function LogsFechaduras() {
  const { selectedCompany } = useCompany();
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [origemFilter, setOrigemFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [selectedCompany]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedCompany?.id) params.company_id = selectedCompany.id;

      const res = await api.get("/fechaduras/historico-admin", { params });
      setLogs(res.data || []);
    } catch (err: any) {
      console.error("[LOGS] Erro ao buscar histórico:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = logs.length;
    const executados = logs.filter(l => l.status === "executado").length;
    const erros = logs.filter(l => l.status === "erro").length;
    const pendentes = logs.filter(l => l.status === "pendente").length;
    return { total, executados, erros, pendentes };
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = !search ||
        l.person_name?.toLowerCase().includes(search.toLowerCase()) ||
        (l.locker_name || "").toLowerCase().includes(search.toLowerCase()) ||
        String(l.lock_id).includes(search) ||
        (l.door_label?.toLowerCase().includes(search.toLowerCase())) ||
        (l.person_matricula?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchOrigem = origemFilter === "all" || l.origem === origemFilter;
      return matchSearch && matchStatus && matchOrigem;
    });
  }, [logs, search, statusFilter, origemFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleExportCSV = () => {
    const headers = ["ID", "Armário", "Localização", "Porta", "Pessoa", "Tipo", "Ação", "Status", "Origem", "Enviado em", "Executado em", "Tempo"];
    const rows = filtered.map(l => [
      l.id,
      l.locker_name || `Lock #${l.lock_id}`,
      l.locker_location || "—",
      l.door_label || `#${l.door_number || 0}`,
      l.person_name || "—",
      l.person_type === "funcionario" ? "Funcionário" : l.person_type === "cliente" ? "Cliente" : "—",
      l.acao,
      statusConfig[l.status]?.label || l.status,
      origemLabels[l.origem || ""] || l.origem || "—",
      formatDateTime(l.criado_em),
      l.executado_em ? formatDateTime(l.executado_em) : "—",
      formatExecutionTime(l.criado_em, l.executado_em),
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-fechaduras-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Unlock className="h-6 w-6 text-primary" />
            Logs de Fechaduras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro de todos os comandos de abertura — portal, painel e agente
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={fetchLogs}>
            <Loader2 className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportCSV} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total de Comandos", value: stats.total, icon: DoorOpen, color: "text-primary", bg: "bg-primary/10" },
          { label: "Executados", value: stats.executados, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "Pendentes", value: stats.pendentes, icon: TimerIcon, color: "text-amber-600", bg: "bg-amber-500/10" },
          { label: "Erros", value: stats.erros, icon: AlertCircle, color: "text-destructive", bg: "bg-destructive/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${s.bg}`}>
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
              <Input
                placeholder="Buscar por pessoa, armário, lock_id..."
                className="pl-9 h-9 bg-muted/40 border-border/30"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                <SelectItem value="pendente" className="text-xs">Pendente</SelectItem>
                <SelectItem value="executando" className="text-xs">Executando</SelectItem>
                <SelectItem value="executado" className="text-xs">Executado</SelectItem>
                <SelectItem value="erro" className="text-xs">Erro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={origemFilter} onValueChange={v => { setOrigemFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas origens</SelectItem>
                <SelectItem value="portal" className="text-xs">Portal Usuário</SelectItem>
                <SelectItem value="painel" className="text-xs">Painel Admin</SelectItem>
                <SelectItem value="web" className="text-xs">Web</SelectItem>
                <SelectItem value="api" className="text-xs">API Externa</SelectItem>
                <SelectItem value="agente" className="text-xs">Agente Local</SelectItem>
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
              <Unlock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum comando de fechadura encontrado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Armário / Porta</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pessoa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Ação</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Origem</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Enviado em</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tempo Exec.</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(l => {
                  const sc = statusConfig[l.status] || statusConfig.pendente;
                  const StatusIcon = sc.icon;
                  return (
                    <TableRow key={l.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-start gap-2">
                          <Building2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{l.locker_name || `Lock #${l.lock_id}`}</p>
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{l.locker_location || "—"}</span>
                              <span className="mx-0.5">·</span>
                              <span className="font-mono">{l.door_label || `Porta #${l.door_number || l.lock_id}`}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{l.person_name || "—"}</p>
                            <div className="flex items-center gap-1">
                              {l.person_type && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0">
                                  {l.person_type === "funcionario" ? "Funcionário" : "Cliente"}
                                </Badge>
                              )}
                              {l.person_matricula && (
                                <span className="text-[10px] text-muted-foreground">{l.person_matricula}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          {l.acao}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${sc.className}`}>
                          <StatusIcon className={`h-3 w-3 ${l.status === "executando" ? "animate-spin" : ""}`} />
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {origemLabels[l.origem || ""] || l.origem || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDateTime(l.criado_em)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">
                            {formatExecutionTime(l.criado_em, l.executado_em)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {l.resposta ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground max-w-[120px] truncate block cursor-help">
                                {l.resposta}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs break-all">{l.resposta}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground">{filtered.length} comando(s) · Página {safePage} de {totalPages}</p>
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
