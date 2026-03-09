import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Building2,
  Database,
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";

interface HealthCheck {
  status: "healthy" | "degraded" | "down" | "checking";
  latencyMs: number | null;
  lastChecked: Date | null;
  error?: string;
}

export default function StatusConexao() {
  const { user, session } = useAuth();
  const { selectedCompany, companies, isSuperAdmin, userRole } = useCompany();
  const [dbHealth, setDbHealth] = useState<HealthCheck>({
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  });
  const [authHealth, setAuthHealth] = useState<HealthCheck>({
    status: "checking",
    latencyMs: null,
    lastChecked: null,
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkDbHealth = async () => {
    const start = performance.now();
    try {
      const { error } = await supabase
        .from("platform_settings")
        .select("key")
        .limit(1);
      const latency = Math.round(performance.now() - start);
      setDbHealth({
        status: error ? "degraded" : "healthy",
        latencyMs: latency,
        lastChecked: new Date(),
        error: error?.message,
      });
      if (!error) setLastSync(new Date());
    } catch (e: any) {
      setDbHealth({
        status: "down",
        latencyMs: null,
        lastChecked: new Date(),
        error: e.message,
      });
    }
  };

  const checkAuthHealth = async () => {
    const start = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start);
      setAuthHealth({
        status: error ? "degraded" : "healthy",
        latencyMs: latency,
        lastChecked: new Date(),
        error: error?.message,
      });
    } catch (e: any) {
      setAuthHealth({
        status: "down",
        latencyMs: null,
        lastChecked: new Date(),
        error: e.message,
      });
    }
  };

  const runAllChecks = async () => {
    setRefreshing(true);
    await Promise.all([checkDbHealth(), checkAuthHealth()]);
    setRefreshing(false);
  };

  useEffect(() => {
    runAllChecks();
    const interval = setInterval(runAllChecks, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    healthy: { label: "Saudável", color: "bg-emerald-500", textColor: "text-emerald-600", icon: CheckCircle2 },
    degraded: { label: "Degradado", color: "bg-amber-500", textColor: "text-amber-600", icon: Activity },
    down: { label: "Indisponível", color: "bg-destructive", textColor: "text-destructive", icon: XCircle },
    checking: { label: "Verificando...", color: "bg-muted-foreground", textColor: "text-muted-foreground", icon: Clock },
  };

  const overallStatus =
    dbHealth.status === "down" || authHealth.status === "down"
      ? "down"
      : dbHealth.status === "degraded" || authHealth.status === "degraded"
        ? "degraded"
        : dbHealth.status === "healthy" && authHealth.status === "healthy"
          ? "healthy"
          : "checking";

  const OverallIcon = overallStatus === "healthy" ? Wifi : overallStatus === "checking" ? Clock : WifiOff;

  const formatTime = (d: Date | null) =>
    d ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

  const HealthCard = ({ title, icon: Icon, health }: { title: string; icon: any; health: HealthCheck }) => {
    const cfg = statusConfig[health.status];
    const StatusIcon = cfg.icon;
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <div className={`h-2.5 w-2.5 rounded-full ${cfg.color} animate-pulse`} />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${cfg.textColor}`} />
            <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
          </div>
          {health.latencyMs !== null && (
            <p className="text-xs text-muted-foreground">
              Latência: <span className="font-mono font-medium text-foreground">{health.latencyMs}ms</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Última verificação: {formatTime(health.lastChecked)}
          </p>
          {health.error && (
            <p className="text-xs text-destructive mt-1 break-all">{health.error}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Status da Conexão</h1>
          <p className="text-muted-foreground text-sm">Monitoramento em tempo real da plataforma</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runAllChecks}
          disabled={refreshing}
          className="gap-2 self-start"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Overall status banner */}
      <Card className={`border-l-4 ${overallStatus === "healthy" ? "border-l-emerald-500" : overallStatus === "degraded" ? "border-l-amber-500" : overallStatus === "down" ? "border-l-destructive" : "border-l-muted-foreground"}`}>
        <CardContent className="flex items-center gap-4 py-4">
          <OverallIcon className={`h-8 w-8 ${statusConfig[overallStatus].textColor}`} />
          <div>
            <p className="font-semibold text-lg">{statusConfig[overallStatus].label}</p>
            <p className="text-sm text-muted-foreground">
              {overallStatus === "healthy"
                ? "Todos os serviços estão operando normalmente."
                : overallStatus === "degraded"
                  ? "Alguns serviços apresentam lentidão ou instabilidade."
                  : overallStatus === "down"
                    ? "Um ou mais serviços estão indisponíveis."
                    : "Verificando o status dos serviços..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service health cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <HealthCard title="Banco de Dados" icon={Database} health={dbHealth} />
        <HealthCard title="Autenticação" icon={Activity} health={authHealth} />
      </div>

      {/* User & Company info */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Logged user */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Usuário Logado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user ? (
              <>
                <div>
                  <p className="font-semibold">{user.user_metadata?.full_name || "—"}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{userRole || "user"}</Badge>
                  {isSuperAdmin && <Badge>Super Admin</Badge>}
                  {session && (
                    <Badge variant="outline" className="text-xs">
                      Sessão ativa
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{user.id.slice(0, 8)}...</span>
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active company */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Empresa Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedCompany ? (
              <>
                <div>
                  <p className="font-semibold">{selectedCompany.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedCompany.type}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedCompany.active ? "default" : "destructive"}>
                    {selectedCompany.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant="outline">{companies.length} empresa(s)</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ID: <span className="font-mono">{selectedCompany.id.slice(0, 8)}...</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma empresa selecionada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last sync */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Última Sincronização com o Banco
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-mono font-semibold">
            {lastSync ? lastSync.toLocaleString("pt-BR") : "Aguardando primeira verificação..."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            As verificações são realizadas automaticamente a cada 30 segundos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
