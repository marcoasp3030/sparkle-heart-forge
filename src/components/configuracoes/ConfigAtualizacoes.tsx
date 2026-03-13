import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { get, post } from "@/lib/api";
import {
  RefreshCw, Download, CheckCircle2, AlertTriangle,
  GitCommit, Clock, History, ArrowUpCircle, Loader2, XCircle, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VersionInfo {
  version: string;
  commit: string;
  commitDate: string;
  commitMessage: string;
  environment: string;
}

interface UpdateCheck {
  hasUpdate: boolean;
  currentCommit: string;
  remoteCommit: string;
  remoteVersion: string;
  changelog: Array<{ hash: string; date: string; message: string; author: string }>;
  checkedAt: string;
}

interface UpdateHistoryItem {
  id: string;
  action: string;
  details: any;
  created_at: string;
  updated_by_name: string;
}

export default function ConfigAtualizacoes() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [updateCheck, setUpdateCheck] = useState<UpdateCheck | null>(null);
  const [history, setHistory] = useState<UpdateHistoryItem[]>([]);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchVersion = async () => {
    setLoadingVersion(true);
    try {
      const data = await get<VersionInfo>("/system/version");
      setVersion(data);
    } catch (err: any) {
      toast.error("Erro ao buscar versão", { description: err.message });
    } finally {
      setLoadingVersion(false);
    }
  };

  const checkForUpdates = async () => {
    setLoadingCheck(true);
    try {
      const data = await get<UpdateCheck>("/system/check-update");
      setUpdateCheck(data);
      if (!data.hasUpdate) {
        toast.success("Sistema está atualizado!");
      } else {
        toast.info(`Nova versão disponível: ${data.remoteVersion || data.remoteCommit}`);
      }
    } catch (err: any) {
      toast.error("Erro ao verificar atualizações", { description: err.message });
    } finally {
      setLoadingCheck(false);
    }
  };

  const executeUpdate = async () => {
    if (!confirm("Tem certeza que deseja atualizar o sistema? Os containers serão reiniciados.")) return;
    setLoadingUpdate(true);
    try {
      const data = await post<any>("/system/update");
      toast.success(data.message, { description: `Versão: ${data.version} (${data.commit})` });
      setUpdateCheck(null);
      fetchVersion();
      fetchHistory();
    } catch (err: any) {
      const isRollback = err.message?.includes("Rollback");
      toast.error(isRollback ? "Atualização falhou - Rollback executado" : "Erro na atualização", {
        description: err.message,
        duration: 10000,
      });
    } finally {
      setLoadingUpdate(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await get<UpdateHistoryItem[]>("/system/update-history");
      setHistory(data);
    } catch (err: any) {
      toast.error("Erro ao buscar histórico", { description: err.message });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load on mount
  useEffect(() => {
    fetchVersion();
    fetchHistory();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "system_update_completed":
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso</Badge>;
      case "system_update_rollback":
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30"><RotateCcw className="h-3 w-3 mr-1" /> Rollback</Badge>;
      case "system_update_failed":
        return <Badge className="bg-destructive/15 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      case "system_update_started":
        return <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30"><ArrowUpCircle className="h-3 w-3 mr-1" /> Iniciado</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Versão Atual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-primary" />
                Versão Atual
              </CardTitle>
              <CardDescription>Informações sobre a versão instalada do sistema</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchVersion} disabled={loadingVersion}>
              {loadingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {version ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Versão</p>
                <p className="text-2xl font-bold text-primary">v{version.version}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Commit</p>
                <p className="text-lg font-mono font-semibold">{version.commit}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{version.commitMessage}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Ambiente</p>
                <Badge variant={version.environment === "production" ? "default" : "secondary"}>
                  {version.environment}
                </Badge>
                {version.commitDate && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(version.commitDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Carregando informações de versão...</p>
          )}
        </CardContent>
      </Card>

      {/* Verificar Atualizações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-primary" />
                Atualizações
              </CardTitle>
              <CardDescription>Verifique e aplique atualizações do repositório</CardDescription>
            </div>
            <Button onClick={checkForUpdates} disabled={loadingCheck} variant="outline">
              {loadingCheck ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Verificar Atualizações
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {updateCheck ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                {updateCheck.hasUpdate ? (
                  <>
                    <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">Nova atualização disponível!</p>
                      <p className="text-sm text-muted-foreground">
                        {updateCheck.currentCommit} → {updateCheck.remoteCommit}
                        {updateCheck.remoteVersion && ` (v${updateCheck.remoteVersion})`}
                      </p>
                    </div>
                    <Button onClick={executeUpdate} disabled={loadingUpdate} className="shrink-0">
                      {loadingUpdate ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Atualizando...</>
                      ) : (
                        <><Download className="h-4 w-4 mr-2" /> Atualizar Agora</>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-semibold">Sistema atualizado</p>
                      <p className="text-sm text-muted-foreground">
                        Verificado em {format(new Date(updateCheck.checkedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Changelog */}
              {updateCheck.hasUpdate && updateCheck.changelog.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Alterações pendentes ({updateCheck.changelog.length})
                  </h4>
                  <ScrollArea className="h-[200px] rounded-lg border">
                    <div className="p-3 space-y-2">
                      {updateCheck.changelog.map((item, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm p-2 rounded hover:bg-muted/50">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">{item.hash}</code>
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{item.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.author} • {item.date ? format(new Date(item.date), "dd/MM HH:mm", { locale: ptBR }) : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {loadingUpdate && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                    <div>
                      <p className="font-semibold text-amber-700">Atualização em andamento...</p>
                      <p className="text-sm text-muted-foreground">
                        Os containers estão sendo reconstruídos. Isso pode levar alguns minutos.
                        Em caso de falha, o rollback automático será executado.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Clique em "Verificar Atualizações" para consultar o repositório.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Atualizações
              </CardTitle>
              <CardDescription>Registro das últimas atualizações aplicadas</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchHistory} disabled={loadingHistory}>
              {loadingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  {getActionBadge(item.action)}
                  <div className="flex-1 min-w-0">
                    {item.details?.from_commit && (
                      <p className="text-sm font-mono">
                        {item.details.from_commit} → {item.details.to_commit}
                        {item.details.new_version && <span className="ml-2 font-sans text-primary font-semibold">v{item.details.new_version}</span>}
                      </p>
                    )}
                    {item.details?.error && (
                      <p className="text-sm text-destructive truncate">{item.details.error}</p>
                    )}
                    {item.details?.rolled_back_to && (
                      <p className="text-xs text-muted-foreground">Revertido para: {item.details.rolled_back_to}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                    {item.updated_by_name && (
                      <p className="text-xs text-muted-foreground">{item.updated_by_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atualização registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
