import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Lock, Send, RefreshCw, CheckCircle, Clock, Copy, Key, Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";
import api from "@/lib/api";

interface Comando {
  id: number;
  acao: string;
  lock_id: number;
  status: string;
  resposta?: string;
  origem?: string;
  criado_em: string;
  executado_em?: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  executando: { label: "Executando", variant: "default" },
  executado: { label: "Executado", variant: "outline" },
  erro: { label: "Erro", variant: "destructive" },
};

const endpoints = [
  {
    method: "POST",
    path: "/api/fechaduras/abrir",
    desc: "Cria um comando para abrir uma fechadura",
    body: '{ "lock_id": 1, "origem": "web" }',
  },
  {
    method: "GET",
    path: "/api/fechaduras/comandos",
    desc: "Busca próximo comando pendente (atômico)",
    body: null,
  },
  {
    method: "POST",
    path: "/api/fechaduras/concluir",
    desc: "Finaliza um comando com status e resposta",
    body: '{ "id": 1, "status": "executado", "resposta": "ok" }',
  },
  {
    method: "GET",
    path: "/api/fechaduras/historico",
    desc: "Lista últimos 50 comandos",
    body: null,
  },
];

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const prefix = "plk_";
  let key = prefix;
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export default function ConfigFechaduras() {
  const [lockId, setLockId] = useState("1");
  const [origem, setOrigem] = useState("web");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<Comando[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [ultimoComando, setUltimoComando] = useState<{ id: number; status: string } | null>(null);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [loadingKey, setLoadingKey] = useState(true);
  const [keyEnabled, setKeyEnabled] = useState(false);

  const baseUrl = String(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, "");

  // Carregar API Key atual
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setLoadingKey(true);
    try {
      const { data } = await api.get("/settings", { params: { key: "fechaduras_api_key" } });
      const rows = Array.isArray(data) ? data : data?.data || [];
      const setting = rows.find?.((s: any) => s.key === "fechaduras_api_key");
      if (setting?.value) {
        const val = typeof setting.value === "string" ? setting.value : setting.value?.key || "";
        if (val && val !== "{}" && val !== '""') {
          setApiKey(val);
          setKeyEnabled(true);
        }
      }
    } catch {
      // Sem chave configurada = modo aberto
    } finally {
      setLoadingKey(false);
    }
  };

  const salvarApiKey = async (key: string) => {
    setSavingKey(true);
    try {
      await api.put("/settings/fechaduras_api_key", { value: { key } });
      setApiKey(key);
      setNewApiKey("");
      setKeyEnabled(!!key);
      toast({ title: key ? "API Key salva!" : "API Key removida", description: key ? "Os endpoints agora exigem autenticação." : "Os endpoints estão em modo aberto." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message || "Falha ao salvar API Key", variant: "destructive" });
    } finally {
      setSavingKey(false);
    }
  };

  const gerarNovaChave = () => {
    const key = generateApiKey();
    setNewApiKey(key);
    setShowKey(true);
  };

  const enviarComando = async () => {
    const id = parseInt(lockId);
    if (isNaN(id) || id <= 0) {
      toast({ title: "Lock ID inválido", description: "Informe um número inteiro positivo.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/fechaduras/abrir", { lock_id: id, origem: origem || "web" });
      setUltimoComando({ id: res.data.id, status: "pendente" });
      toast({ title: "Comando enviado!", description: `ID: ${res.data.id} — Lock: ${id}` });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message || "Falha na requisição", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const buscarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const { data } = await api.get("/fechaduras/historico");
      setHistorico(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar histórico", description: err.message, variant: "destructive" });
    } finally {
      setLoadingHistorico(false);
    }
  };

  const buscarPendente = async () => {
    try {
      const { data } = await api.get("/fechaduras/comandos");
      if (data.status === "vazio") {
        toast({ title: "Nenhum comando pendente", description: "A fila está vazia." });
      } else {
        toast({ title: `Comando #${data.id}`, description: `Ação: ${data.acao} | Lock: ${data.lock_id} — marcado como executando` });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const copiarTexto = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Texto copiado para a área de transferência." });
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 8)}${"•".repeat(20)}${apiKey.slice(-4)}` : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Integração — Fechaduras Inteligentes</CardTitle>
              <CardDescription>
                API de fila de comandos para controle de fechaduras via agente Python local
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium">Base URL</p>
              <p className="text-sm font-mono mt-1 break-all">{baseUrl}/api</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium">Autenticação</p>
              <div className="flex items-center gap-2 mt-1">
                {keyEnabled ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600 font-medium">API Key ativa</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    <span className="text-sm text-amber-600 font-medium">Modo aberto</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium">Polling recomendado</p>
              <p className="text-sm mt-1">GET /comandos a cada 2s</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Autenticação por API Key</CardTitle>
          </div>
          <CardDescription>
            Configure uma chave de acesso para proteger os endpoints de fechaduras. Sem chave configurada, o acesso é livre.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingKey ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Carregando configuração...
            </div>
          ) : (
            <>
              {/* Current key display */}
              {apiKey && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Chave atual</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2.5 rounded-md bg-muted font-mono text-sm break-all">
                      {showKey ? apiKey : maskedKey}
                    </code>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => copiarTexto(apiKey)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Usage instructions */}
              {apiKey && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Como usar no agente Python:</p>
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`headers = { "X-API-Key": "${showKey ? apiKey : "sua_api_key_aqui"}" }
requests.get(url, headers=headers)`}
                  </pre>
                  <p className="text-xs text-muted-foreground mt-1">
                    Também aceita: <code className="bg-muted px-1 rounded">Authorization: Bearer &lt;key&gt;</code> ou <code className="bg-muted px-1 rounded">?api_key=&lt;key&gt;</code>
                  </p>
                </div>
              )}

              <Separator />

              {/* Generate new key */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Button variant="outline" onClick={gerarNovaChave} className="gap-2">
                    <Key className="h-4 w-4" />
                    Gerar Nova Chave
                  </Button>
                  {apiKey && (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive gap-2"
                      onClick={() => salvarApiKey("")}
                      disabled={savingKey}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Remover Proteção
                    </Button>
                  )}
                </div>

                {newApiKey && (
                  <div className="space-y-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      ⚠️ Copie esta chave antes de salvar — ela não será exibida novamente por completo.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-2.5 rounded-md bg-white dark:bg-background font-mono text-sm break-all border">
                        {newApiKey}
                      </code>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => copiarTexto(newApiKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button onClick={() => salvarApiKey(newApiKey)} disabled={savingKey} className="gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      {savingKey ? "Salvando..." : "Ativar Esta Chave"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Endpoints Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Endpoints da API</CardTitle>
          <CardDescription>Referência rápida dos endpoints disponíveis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {endpoints.map((ep, i) => (
            <div key={i} className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={ep.method === "GET" ? "secondary" : "default"} className="font-mono text-xs">
                    {ep.method}
                  </Badge>
                  <code className="text-sm font-mono text-foreground">{ep.path}</code>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copiarTexto(`${baseUrl}${ep.path}`)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{ep.desc}</p>
              {ep.body && (
                <pre className="mt-2 p-2 rounded bg-muted text-xs font-mono overflow-x-auto">{ep.body}</pre>
              )}
            </div>
          ))}

          {keyEnabled && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <p className="font-medium text-primary">🔒 Autenticação obrigatória</p>
              <p className="text-muted-foreground mt-1">
                Todos os endpoints acima exigem o header <code className="bg-muted px-1 rounded text-xs">X-API-Key: sua_chave</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Painel de Teste</CardTitle>
          <CardDescription>Envie comandos de teste diretamente para a API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Enviar Comando — Abrir Fechadura</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lock_id">Lock ID</Label>
                <Input id="lock_id" type="number" min={1} value={lockId} onChange={(e) => setLockId(e.target.value)} placeholder="Ex: 1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Input id="origem" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="web, app, api..." />
              </div>
              <div className="flex items-end">
                <Button onClick={enviarComando} disabled={loading} className="w-full gap-2">
                  <Send className="h-4 w-4" />
                  {loading ? "Enviando..." : "Enviar Comando"}
                </Button>
              </div>
            </div>

            {ultimoComando && (
              <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-sm">
                  Último comando: <strong>#{ultimoComando.id}</strong> — Status: {ultimoComando.status}
                </span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={buscarPendente} className="gap-2">
              <Clock className="h-4 w-4" />
              Buscar Próximo Pendente
            </Button>
            <Button variant="outline" onClick={buscarHistorico} disabled={loadingHistorico} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loadingHistorico ? "animate-spin" : ""}`} />
              Carregar Histórico
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Comandos</CardTitle>
            <CardDescription>Últimos {historico.length} comandos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">ID</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Ação</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Lock</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Origem</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Resposta</th>
                    <th className="pb-2 font-medium text-muted-foreground">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((cmd) => {
                    const st = statusMap[cmd.status] || { label: cmd.status, variant: "secondary" as const };
                    return (
                      <tr key={cmd.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">#{cmd.id}</td>
                        <td className="py-2 pr-4">{cmd.acao}</td>
                        <td className="py-2 pr-4 font-mono">{cmd.lock_id}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{cmd.origem || "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground max-w-[200px] truncate">{cmd.resposta || "—"}</td>
                        <td className="py-2 text-muted-foreground text-xs">
                          {new Date(cmd.criado_em).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
