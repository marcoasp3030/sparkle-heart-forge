import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield, Search, Filter, Download, Clock, Archive, Users,
  RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Eye,
  Activity, TrendingUp, UserCheck, Lock, Unlock, Wrench,
  Ban, FileText, Calendar, BarChart3, X
} from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any;
  category: string;
  company_id: string | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

const categoryConfig: Record<string, { label: string; icon: any; color: string }> = {
  armarios: { label: "Armários", icon: Archive, color: "text-primary" },
  renovacoes: { label: "Renovações", icon: RefreshCw, color: "text-amber-600" },
  pessoas: { label: "Pessoas", icon: Users, color: "text-blue-600" },
  autenticacao: { label: "Autenticação", icon: Lock, color: "text-purple-600" },
  system: { label: "Sistema", icon: Wrench, color: "text-muted-foreground" },
};

const actionLabels: Record<string, string> = {
  door_status_changed: "Status da porta alterado",
  door_assigned: "Porta atribuída",
  door_released: "Porta liberada",
  door_reassigned: "Porta reatribuída",
  door_expiry_changed: "Prazo alterado",
  renewal_requested: "Renovação solicitada",
  renewal_approved: "Renovação aprovada",
  renewal_rejected: "Renovação recusada",
  renewal_status_changed: "Status de renovação alterado",
  person_created: "Pessoa cadastrada",
  person_updated: "Pessoa atualizada",
  person_deactivated: "Pessoa desativada",
  person_reactivated: "Pessoa reativada",
  person_deleted: "Pessoa removida",
  reservation_created: "Reserva criada",
  reservation_released: "Reserva liberada",
  reservation_expired: "Reserva expirada",
  reservation_cancelled: "Reserva cancelada",
  reservation_status_changed: "Status de reserva alterado",
  login: "Login realizado",
  logout: "Logout",
  login_failed: "Tentativa de login falha",
  password_changed: "Senha alterada",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(var(--destructive))",
  "#8b5cf6",
  "#06b6d4",
];

const PERIOD_OPTIONS = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "14", label: "Últimos 14 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export default function Auditoria() {
  const { selectedCompany, isSuperAdmin } = useCompany();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [periodDays, setPeriodDays] = useState("30");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [profilesMap, setProfilesMap] = useState<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState("logs");

  useEffect(() => {
    loadLogs();
  }, [selectedCompany, periodDays]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const since = subDays(new Date(), parseInt(periodDays)).toISOString();
      let query = supabase
        .from("audit_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (selectedCompany) {
        query = query.eq("company_id", selectedCompany.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as AuditLog[]);

      // Load profile names
      const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))] as string[];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        const map = new Map<string, string>();
        profiles?.forEach(p => map.set(p.user_id, p.full_name || "Usuário"));
        // Also check funcionarios_clientes for person names in details
        setProfilesMap(map);
      }
    } catch (err: any) {
      toast.error("Erro ao carregar logs: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (categoryFilter !== "all" && log.category !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const actionLabel = (actionLabels[log.action] || log.action).toLowerCase();
        const userName = profilesMap.get(log.user_id || "") || "";
        const detailStr = JSON.stringify(log.details || {}).toLowerCase();
        if (!actionLabel.includes(s) && !userName.toLowerCase().includes(s) && !detailStr.includes(s) && !log.resource_type.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, categoryFilter, search, profilesMap]);

  // Dashboard stats
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const byUser: Record<string, number> = {};

    logs.forEach(log => {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      const day = format(new Date(log.created_at), "dd/MM");
      byDay[day] = (byDay[day] || 0) + 1;
      if (log.user_id) {
        byUser[log.user_id] = (byUser[log.user_id] || 0) + 1;
      }
    });

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({
      name: categoryConfig[name]?.label || name,
      value,
    }));

    const actionData = Object.entries(byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({
        name: actionLabels[name] || name,
        value,
      }));

    const dailyData = Object.entries(byDay).map(([name, value]) => ({ name, value }));

    const topUsers = Object.entries(byUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({
        name: profilesMap.get(userId) || "Desconhecido",
        count,
      }));

    return { categoryData, actionData, dailyData, topUsers, total: logs.length };
  }, [logs, profilesMap]);

  const exportCSV = () => {
    const headers = ["Data/Hora", "Categoria", "Ação", "Usuário", "Recurso", "Detalhes"];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      categoryConfig[log.category]?.label || log.category,
      actionLabels[log.action] || log.action,
      profilesMap.get(log.user_id || "") || log.user_id || "Sistema",
      `${log.resource_type} ${log.resource_id || ""}`,
      JSON.stringify(log.details || {}),
    ]);

    const csv = [headers.join(";"), ...rows.map(r => r.map(c => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filteredLogs.length} registros exportados`);
  };

  const getActionIcon = (action: string) => {
    if (action.includes("assigned") || action.includes("created") || action.includes("login")) return <UserCheck className="h-4 w-4" />;
    if (action.includes("released") || action.includes("logout")) return <Unlock className="h-4 w-4" />;
    if (action.includes("expired") || action.includes("failed")) return <AlertTriangle className="h-4 w-4" />;
    if (action.includes("approved")) return <RefreshCw className="h-4 w-4" />;
    if (action.includes("rejected") || action.includes("cancelled") || action.includes("deactivated") || action.includes("deleted")) return <Ban className="h-4 w-4" />;
    if (action.includes("status") || action.includes("updated")) return <Activity className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("created") || action.includes("assigned") || action.includes("approved") || action.includes("login") && !action.includes("failed")) {
      return "bg-green-500/10 text-green-600 border-green-500/20";
    }
    if (action.includes("released") || action.includes("expired") || action.includes("changed")) {
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    }
    if (action.includes("rejected") || action.includes("failed") || action.includes("deleted") || action.includes("deactivated") || action.includes("cancelled")) {
      return "bg-destructive/10 text-destructive border-destructive/20";
    }
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Central de Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento completo de segurança e atividades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodDays} onValueChange={setPeriodDays}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        {/* === LOGS TAB === */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação, usuário, detalhes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearch("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(categoryConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-primary">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total de registros</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{filteredLogs.length}</p>
                <p className="text-[10px] text-muted-foreground">Filtrados</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-amber-600">
                  {logs.filter(l => l.action.includes("failed") || l.action.includes("rejected")).length}
                </p>
                <p className="text-[10px] text-muted-foreground">Alertas</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-green-600">
                  {new Set(logs.map(l => l.user_id).filter(Boolean)).size}
                </p>
                <p className="text-[10px] text-muted-foreground">Usuários ativos</p>
              </CardContent>
            </Card>
          </div>

          {/* Logs list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-10 text-center">
                <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="font-semibold text-foreground">Nenhum registro encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou período</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filteredLogs.slice(0, 100).map((log, i) => {
                    const cat = categoryConfig[log.category] || categoryConfig.system;
                    const CatIcon = cat.icon;
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.01, 0.5) }}
                        className="p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted/50`}>
                            {getActionIcon(log.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-foreground">
                                {actionLabels[log.action] || log.action}
                              </span>
                              <Badge variant="outline" className={`text-[9px] ${getActionBadgeColor(log.action)}`}>
                                {cat.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                              <span>•</span>
                              <span>{profilesMap.get(log.user_id || "") || "Sistema"}</span>
                              {log.details?.label && (
                                <>
                                  <span>•</span>
                                  <span>{log.details.label}</span>
                                </>
                              )}
                              {log.details?.nome && (
                                <>
                                  <span>•</span>
                                  <span>{log.details.nome}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Eye className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-1" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                {filteredLogs.length > 100 && (
                  <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20">
                    Mostrando 100 de {filteredLogs.length} registros. Exporte o CSV para ver todos.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === DASHBOARD TAB === */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {/* Activity over time */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Atividade por Dia
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="value" name="Eventos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By category */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {stats.categoryData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>

            {/* Top users */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Usuários Mais Ativos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topUsers.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topUsers.map((u, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {i + 1}
                          </div>
                          <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{u.name}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{u.count} ações</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top actions */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Ações Mais Frequentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.actionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.actionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="value" name="Quantidade" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes do Registro
            </DialogTitle>
            <DialogDescription>
              Informações completas do log de auditoria
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ação</p>
                  <p className="text-sm font-medium">{actionLabels[selectedLog.action] || selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {categoryConfig[selectedLog.category]?.label || selectedLog.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="text-sm">{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p className="text-sm">{profilesMap.get(selectedLog.user_id || "") || "Sistema"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tipo de Recurso</p>
                  <p className="text-sm">{selectedLog.resource_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID do Recurso</p>
                  <p className="text-sm font-mono text-[11px] truncate">{selectedLog.resource_id || "—"}</p>
                </div>
              </div>

              {selectedLog.ip_address && (
                <div>
                  <p className="text-xs text-muted-foreground">IP</p>
                  <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="text-xs text-muted-foreground">User Agent</p>
                  <p className="text-[11px] text-muted-foreground font-mono break-all">{selectedLog.user_agent}</p>
                </div>
              )}

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Detalhes (JSON)</p>
                  <pre className="text-[11px] bg-muted/50 rounded-lg p-3 overflow-auto max-h-48 font-mono text-foreground">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
