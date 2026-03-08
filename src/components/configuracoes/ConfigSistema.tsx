import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Database, Clock, Activity, Download, Loader2, Shield, Users } from "lucide-react";

export default function ConfigSistema() {
  const { user } = useAuth();
  const { isSuperAdmin, userRole, selectedCompany } = useCompany();
  const { toast } = useToast();
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [stats, setStats] = useState({ users: 0, companies: 0, lockers: 0, doors: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [waitlistEnabled, setWaitlistEnabled] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const [usersRes, companiesRes, lockersRes, doorsRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("companies").select("id", { count: "exact", head: true }),
          supabase.from("lockers").select("id", { count: "exact", head: true }),
          supabase.from("locker_doors").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          users: usersRes.count ?? 0,
          companies: companiesRes.count ?? 0,
          lockers: lockersRes.count ?? 0,
          doors: doorsRes.count ?? 0,
        });
      } catch {
        // silent
      } finally {
        setLoadingStats(false);
      }
    };
    loadStats();
  }, []);

  // Load waitlist setting
  useEffect(() => {
    const loadWaitlistSetting = async () => {
      if (!selectedCompany) return;
      const { data } = await supabase
        .from("company_permissions")
        .select("enabled")
        .eq("company_id", selectedCompany.id)
        .eq("permission", "waitlist_enabled")
        .maybeSingle();
      setWaitlistEnabled(data?.enabled ?? false);
      setWaitlistLoading(false);
    };
    loadWaitlistSetting();
  }, [selectedCompany]);

  const toggleWaitlist = async (enabled: boolean) => {
    if (!selectedCompany) return;
    setWaitlistEnabled(enabled);

    const { data: existing } = await supabase
      .from("company_permissions")
      .select("id")
      .eq("company_id", selectedCompany.id)
      .eq("permission", "waitlist_enabled")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("company_permissions")
        .update({ enabled })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("company_permissions")
        .insert({ company_id: selectedCompany.id, permission: "waitlist_enabled", enabled });
    }

    toast({ title: enabled ? "Fila de espera ativada" : "Fila de espera desativada" });
  };

  const handleExportLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Logs exportados com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao exportar logs", description: err.message, variant: "destructive" });
    }
  };

  const statCards = [
    { label: "Usuários", value: stats.users, icon: Activity },
    { label: "Empresas", value: stats.companies, icon: Database },
    { label: "Armários", value: stats.lockers, icon: Monitor },
    { label: "Portas", value: stats.doors, icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* System stats (superadmin only) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Visão Geral do Sistema
            </CardTitle>
            <CardDescription>Estatísticas em tempo real da plataforma</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="p-4 rounded-xl bg-muted/50 border border-border text-center">
                  <s.icon className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {loadingStats ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : s.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regional settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Preferências Regionais
          </CardTitle>
          <CardDescription>Configure o fuso horário e formato de data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fuso horário</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                  <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                  <SelectItem value="America/Bahia">Bahia (GMT-3)</SelectItem>
                  <SelectItem value="America/Recife">Recife (GMT-3)</SelectItem>
                  <SelectItem value="America/Fortaleza">Fortaleza (GMT-3)</SelectItem>
                  <SelectItem value="America/Belem">Belém (GMT-3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Formato de data</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DD/MM/YYYY">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/DD/YYYY">MM/DD/AAAA</SelectItem>
                  <SelectItem value="YYYY-MM-DD">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tempo limite da sessão</Label>
            <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
              <SelectTrigger className="sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutos</SelectItem>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit & export (superadmin) */}
      {isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Dados e Auditoria
            </CardTitle>
            <CardDescription>Exporte logs de auditoria e gerencie dados do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
              <div>
                <p className="text-sm font-medium">Logs de auditoria</p>
                <p className="text-xs text-muted-foreground">
                  Exporte os últimos 500 registros de auditoria em JSON
                </p>
              </div>
              <Button variant="outline" onClick={handleExportLogs} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>

            <div className="p-4 rounded-xl border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Proteção contra força bruta</p>
                  <p className="text-xs text-muted-foreground">
                    Bloqueia contas após 5 tentativas falhas por 60 segundos
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                  Ativo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
