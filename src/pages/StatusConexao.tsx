import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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
  AlertTriangle,
  Bell,
  Settings2,
  TrendingUp,
  BarChart3,
} from "lucide-react";

interface HealthCheck {
  status: "healthy" | "degraded" | "down" | "checking";
  latencyMs: number | null;
  lastChecked: Date | null;
  error?: string;
}

interface LatencyAlert {
  timestamp: Date;
  service: string;
  latencyMs: number;
  threshold: number;
}

interface UptimeDataPoint {
  time: string;
  timestamp: number;
  dbLatency: number | null;
  authLatency: number | null;
  dbStatus: "healthy" | "degraded" | "down";
  authStatus: "healthy" | "degraded" | "down";
}

const STORAGE_KEY = "status_latency_config";
const UPTIME_STORAGE_KEY = "status_uptime_history";
const MAX_UPTIME_POINTS = 288; // 24h * 60min / 5min = 288 points (every 5 minutes for 24h)

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { enabled: true, dbThreshold: 500, authThreshold: 500, soundEnabled: false };
}

function loadUptimeHistory(): UptimeDataPoint[] {
  try {
    const raw = localStorage.getItem(UPTIME_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Filter to last 24 hours
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return data.filter((p: UptimeDataPoint) => p.timestamp > cutoff);
    }
  } catch {}
  return [];
}

function saveUptimeHistory(data: UptimeDataPoint[]) {
  try {
    localStorage.setItem(UPTIME_STORAGE_KEY, JSON.stringify(data.slice(-MAX_UPTIME_POINTS)));
  } catch {}
}

export default function StatusConexao() {
  const { user, session } = useAuth();
  const { selectedCompany, companies, isSuperAdmin, userRole } = useCompany();
  const [dbHealth, setDbHealth] = useState<HealthCheck>({ status: "checking", latencyMs: null, lastChecked: null });
  const [authHealth, setAuthHealth] = useState<HealthCheck>({ status: "checking", latencyMs: null, lastChecked: null });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uptimeHistory, setUptimeHistory] = useState<UptimeDataPoint[]>(loadUptimeHistory);

  // Latency alert config
  const savedConfig = loadConfig();
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(savedConfig.enabled);
  const [dbThreshold, setDbThreshold] = useState<number>(savedConfig.dbThreshold);
  const [authThreshold, setAuthThreshold] = useState<number>(savedConfig.authThreshold);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(savedConfig.soundEnabled);
  const [alertHistory, setAlertHistory] = useState<LatencyAlert[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const lastAlertRef = useRef<Record<string, number>>({});
  const lastUptimeRecordRef = useRef<number>(0);

  // Persist config
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: alertsEnabled, dbThreshold, authThreshold, soundEnabled }));
  }, [alertsEnabled, dbThreshold, authThreshold, soundEnabled]);

  const triggerAlert = useCallback((service: string, latencyMs: number, threshold: number) => {
    const now = Date.now();
    if (lastAlertRef.current[service] && now - lastAlertRef.current[service] < 60000) return;
    lastAlertRef.current[service] = now;

    const alert: LatencyAlert = { timestamp: new Date(), service, latencyMs, threshold };
    setAlertHistory((prev) => [alert, ...prev].slice(0, 50));

    toast({
      variant: "destructive",
      title: `⚠️ Latência alta: ${service}`,
      description: `${latencyMs}ms excede o limite de ${threshold}ms`,
    });

    if (soundEnabled && typeof Audio !== "undefined") {
      try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Hj4+LgHRpYWBpcHqEjpKRioBza2RiZ3J/iZOWk4yBdWxmY2hxfYiSlZKMgXVsZ2RpcnyIkpWTjIF1bGdka3J+iZKVk4yBdmxnZWxzf4mSlpOMgndtaGVsc3+Jk5aTjIJ3bWhlbXOAipOWk4yCd21pZm1zf4qTlpOMg3htaWZuc4CKk5aTjIN4bWlmbnR/ipOXk42DeG1pZ25zf4qTl5ONg3ltamdvdICLk5eTjYN5bmpncHSAi5SXk42EeW5qaHB1gIuUl5ONhHluamhwdYCLlJeTjYR5bmpocXWAi5SYk46EeW5qaXF1gIyUmJOOhHpua2lxdYGMlJiTjoR6bmtpcnWBjJSYk46Fem5raXJ2gYyUmJSOhXpva2lydoGMlZiUjoV6b2tqcnaBjJWYlI6Fem9ranJ2gYyVmZSOhXpva2pydoGNlZmUj4V7b2xqc3aBjZWZlI+Fe29sanN2gY2VmZSPhXtvbGpzdoGNlpmUj4Z7b2xrc3eBjZaZlI+Ge29sa3N3gY2WmZSPhnxvbGtzd4GNlpmVj4Z8cGxrc3eBjpaZlY+GfHBsa3R3gY6WmpWQhnxwbGt0d4GOlpqVkIZ8cG1rdHeBjpaalpCGfHBta3R4gY6Wm5WQh3xwbWx0eIGOl5uVkId8cG1sdHiBjpeclZCHfXFtbHR4gY+Xm5aQh31xbWx1eIGPl5uWkId9cW1sdXiBj5eblpCHfXFtbXV4gY+Xm5aRh31xbm11eIKPl5yWkYd9cW5tdXiCj5eclpGIfXFubXV5go+XnJaRiH1ybm11eYKPmJyWkYh+cm5udXmCj5icl5GIfnJubnZ5go+YnJeRiH5ybm52eYKQmJyXkYh+cm5udnmCkJidl5GJfnJvbnZ5gpCYnZeRiX5yb252eYKQmJ2XkYl+cm9vdnmCkJidl5KJfnNvb3Z6gpCYnZeSiX5zb292eoKQmJ2Xkol+c29vd3qCkJidl5KJf3Nvb3d6gpCZnZeSiX9zb293eoKRmZ2Xkol/c3Bvd3qCkZmdmJKKf3NwcHd6gpGZnpiSin9zcHB3eoORmZ6Ykop/c3Bwd3uDkZmemJKKf3NwcHd7g5GZnpiTin9zcHB4e4ORmZ6Yk4p/dHBweHuDkZqemJOKgHRwcHh7g5GanpiTioB0cHB4e4ORmp6Yk4qAdHFweHuDkpqemZOKgHRxcXh7g5KanpmTi4B0cXF4e4OSmZ6Zk4uAdXFxeHuDkpqemZOLgHVxcXh7g5KanpmTi4B1cXF4fIOSmZ6Zk4uBdXFxeXyDkpqfmZOLgXVxcXl8g5Kan5mUi4F1cnF5fIOSmp+ZlIuBdXJxeXyEkpqfmZSLgXVycXl8hJKan5mUi4F1cnJ5fISSmZ+ZlIuBdnJyeXyEkpqfmpSMgXZycnl9hJKan5qUjIF2cnJ5fYSSmqCalIyBdnJyeX2Ekpqfm5SMgXZycnp9hJKaoJqUjIF2c3J6fYSTmqCalIyCdnNyen2Ek5qgmpWMgnZzcnp9hJOaoJqVjIJ2c3J6fYSTmqCalYyCd3Nzen6Ek5qgmpWMgndzcnp+hJOaoJqVjIJ3c3N6foSTm6CalYyCd3Nzen6Ek5ugmpWNgndzcnp+hJOboJuVjYJ3c3N7foSTm6CblY2Cd3Rze36Ek5ugm5WNgndzc3t+hZOboJuVjYN3c3N7foWTm6CblY2Dd3Rze36Fk5ugm5aNg3d0c3t+hZOboJuWjYN4dHN7f4WTm6CblY2DeHR0e3+Fk5ugm5aNg3h0dHt/hZOboJuWjYN4dHR7f4WUm6GblY6DeHR0e3+FlJuhmpaOg3h0dHt/hZSboZqWjoN4dHR8f4WUm6GalY6DeHR0fH+FlJuhmpaOhHh0dHx/hZSboZqWjoR4dXR8f4WUm6GalY6EeHV0fH+FlJyhmpaOhHh1dHx/hZScopi=").play(); } catch {}
    }
  }, [soundEnabled]);

  const recordUptimePoint = useCallback((dbLat: number | null, authLat: number | null, dbStat: HealthCheck["status"], authStat: HealthCheck["status"]) => {
    const now = Date.now();
    // Only record every 5 minutes minimum
    if (now - lastUptimeRecordRef.current < 5 * 60 * 1000) return;
    lastUptimeRecordRef.current = now;

    const point: UptimeDataPoint = {
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      timestamp: now,
      dbLatency: dbLat,
      authLatency: authLat,
      dbStatus: dbStat === "checking" ? "healthy" : dbStat,
      authStatus: authStat === "checking" ? "healthy" : authStat,
    };

    setUptimeHistory((prev) => {
      const updated = [...prev, point].slice(-MAX_UPTIME_POINTS);
      saveUptimeHistory(updated);
      return updated;
    });
  }, []);

  const checkDbHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const { error } = await supabase.from("platform_settings").select("key").limit(1);
      const latency = Math.round(performance.now() - start);
      const isHighLatency = alertsEnabled && latency > dbThreshold;
      const status = error ? "degraded" : isHighLatency ? "degraded" : "healthy";
      setDbHealth({
        status,
        latencyMs: latency,
        lastChecked: new Date(),
        error: error?.message,
      });
      if (!error) setLastSync(new Date());
      if (isHighLatency && !error) triggerAlert("Banco de Dados", latency, dbThreshold);
      return { latency, status };
    } catch (e: any) {
      setDbHealth({ status: "down", latencyMs: null, lastChecked: new Date(), error: e.message });
      return { latency: null, status: "down" as const };
    }
  }, [alertsEnabled, dbThreshold, triggerAlert]);

  const checkAuthHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const { error } = await supabase.auth.getSession();
      const latency = Math.round(performance.now() - start);
      const isHighLatency = alertsEnabled && latency > authThreshold;
      const status = error ? "degraded" : isHighLatency ? "degraded" : "healthy";
      setAuthHealth({
        status,
        latencyMs: latency,
        lastChecked: new Date(),
        error: error?.message,
      });
      if (isHighLatency && !error) triggerAlert("Autenticação", latency, authThreshold);
      return { latency, status };
    } catch (e: any) {
      setAuthHealth({ status: "down", latencyMs: null, lastChecked: new Date(), error: e.message });
      return { latency: null, status: "down" as const };
    }
  }, [alertsEnabled, authThreshold, triggerAlert]);

  const runAllChecks = useCallback(async () => {
    setRefreshing(true);
    const [dbResult, authResult] = await Promise.all([checkDbHealth(), checkAuthHealth()]);
    recordUptimePoint(dbResult.latency, authResult.latency, dbResult.status, authResult.status);
    setRefreshing(false);
  }, [checkDbHealth, checkAuthHealth, recordUptimePoint]);

  useEffect(() => {
    runAllChecks();
    const interval = setInterval(runAllChecks, 30000);
    return () => clearInterval(interval);
  }, [runAllChecks]);

  // Calculate uptime percentages
  const uptimeStats = {
    db: uptimeHistory.length > 0
      ? Math.round((uptimeHistory.filter(p => p.dbStatus === "healthy").length / uptimeHistory.length) * 100)
      : 100,
    auth: uptimeHistory.length > 0
      ? Math.round((uptimeHistory.filter(p => p.authStatus === "healthy").length / uptimeHistory.length) * 100)
      : 100,
    avgDbLatency: uptimeHistory.length > 0
      ? Math.round(uptimeHistory.filter(p => p.dbLatency !== null).reduce((sum, p) => sum + (p.dbLatency || 0), 0) / Math.max(1, uptimeHistory.filter(p => p.dbLatency !== null).length))
      : 0,
    avgAuthLatency: uptimeHistory.length > 0
      ? Math.round(uptimeHistory.filter(p => p.authLatency !== null).reduce((sum, p) => sum + (p.authLatency || 0), 0) / Math.max(1, uptimeHistory.filter(p => p.authLatency !== null).length))
      : 0,
  };

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

  const getLatencyColor = (latencyMs: number | null, threshold: number) => {
    if (latencyMs === null) return "text-muted-foreground";
    if (latencyMs > threshold) return "text-destructive font-bold";
    if (latencyMs > threshold * 0.7) return "text-amber-600 font-semibold";
    return "text-foreground";
  };

  const getUptimeColor = (pct: number) => {
    if (pct >= 99) return "text-emerald-600";
    if (pct >= 95) return "text-amber-600";
    return "text-destructive";
  };

  const HealthCard = ({ title, icon: Icon, health, threshold }: { title: string; icon: any; health: HealthCheck; threshold: number }) => {
    const cfg = statusConfig[health.status];
    const StatusIcon = cfg.icon;
    const isOverThreshold = alertsEnabled && health.latencyMs !== null && health.latencyMs > threshold;
    return (
      <Card className={isOverThreshold ? "border-destructive/50 ring-1 ring-destructive/20" : ""}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isOverThreshold && <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-pulse" />}
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.color} animate-pulse`} />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${cfg.textColor}`} />
            <span className={`text-sm font-semibold ${cfg.textColor}`}>{cfg.label}</span>
          </div>
          {health.latencyMs !== null && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Latência: <span className={`font-mono ${getLatencyColor(health.latencyMs, threshold)}`}>{health.latencyMs}ms</span>
              </p>
              {alertsEnabled && (
                <span className="text-[10px] text-muted-foreground">Limite: {threshold}ms</span>
              )}
            </div>
          )}
          {isOverThreshold && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Latência acima do limite configurado
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

  // Prepare chart data - show last 50 points for better visualization
  const chartData = uptimeHistory.slice(-50).map((p) => ({
    ...p,
    dbLatency: p.dbLatency || 0,
    authLatency: p.authLatency || 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Status da Conexão</h1>
          <p className="text-muted-foreground text-sm">Monitoramento em tempo real da plataforma</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)} className="gap-2">
            <Settings2 className="h-4 w-4" />
            Alertas
          </Button>
          <Button variant="outline" size="sm" onClick={runAllChecks} disabled={refreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Alert Configuration Panel */}
      {showConfig && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Configuração de Alertas de Latência
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Alertas ativos</Label>
                <p className="text-xs text-muted-foreground">Notificar quando a latência exceder o limite</p>
              </div>
              <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="db-threshold" className="text-xs">Limite Banco de Dados (ms)</Label>
                <Input
                  id="db-threshold"
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={dbThreshold}
                  onChange={(e) => setDbThreshold(Math.max(50, Number(e.target.value)))}
                  disabled={!alertsEnabled}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Recomendado: 300–800ms</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-threshold" className="text-xs">Limite Autenticação (ms)</Label>
                <Input
                  id="auth-threshold"
                  type="number"
                  min={50}
                  max={5000}
                  step={50}
                  value={authThreshold}
                  onChange={(e) => setAuthThreshold(Math.max(50, Number(e.target.value)))}
                  disabled={!alertsEnabled}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">Recomendado: 300–800ms</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Som de alerta</Label>
                <p className="text-xs text-muted-foreground">Tocar som ao disparar alerta</p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} disabled={!alertsEnabled} />
            </div>
          </CardContent>
        </Card>
      )}

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
        <HealthCard title="Banco de Dados" icon={Database} health={dbHealth} threshold={dbThreshold} />
        <HealthCard title="Autenticação" icon={Activity} health={authHealth} threshold={authThreshold} />
      </div>

      {/* Uptime History Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Histórico de Uptime (Últimas 24h)
            </CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">DB:</span>
                <span className={`font-bold ${getUptimeColor(uptimeStats.db)}`}>{uptimeStats.db}%</span>
                <span className="text-muted-foreground">({uptimeStats.avgDbLatency}ms avg)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Auth:</span>
                <span className={`font-bold ${getUptimeColor(uptimeStats.auth)}`}>{uptimeStats.auth}%</span>
                <span className="text-muted-foreground">({uptimeStats.avgAuthLatency}ms avg)</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAuth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    className="fill-muted-foreground"
                    label={{ value: "ms", angle: -90, position: "insideLeft", fontSize: 10, className: "fill-muted-foreground" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}ms`,
                      name === "dbLatency" ? "Banco de Dados" : "Autenticação",
                    ]}
                  />
                  <Legend
                    formatter={(value) => (value === "dbLatency" ? "Banco de Dados" : "Autenticação")}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="dbLatency"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorDb)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="authLatency"
                    stroke="hsl(142, 76%, 36%)"
                    fillOpacity={1}
                    fill="url(#colorAuth)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aguardando coleta de dados...</p>
                <p className="text-xs mt-1">Os dados são registrados a cada 5 minutos</p>
              </div>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Dados coletados a cada 5 minutos. Histórico armazenado localmente por até 24 horas.
          </p>
        </CardContent>
      </Card>

      {/* User & Company info */}
      <div className="grid gap-4 sm:grid-cols-2">
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
                  {session && <Badge variant="outline" className="text-xs">Sessão ativa</Badge>}
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

      {/* Alert History */}
      {alertHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Histórico de Alertas ({alertHistory.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAlertHistory([])} className="text-xs h-7">
              Limpar
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {alertHistory.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
                    <span className="font-medium">{a.service}</span>
                    <span className="text-destructive font-mono font-bold">{a.latencyMs}ms</span>
                    <span className="text-muted-foreground">/ {a.threshold}ms</span>
                  </div>
                  <span className="text-muted-foreground">{formatTime(a.timestamp)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
