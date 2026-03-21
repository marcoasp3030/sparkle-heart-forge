import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Lock, Send, RefreshCw, CheckCircle, XCircle, Clock, Copy, ExternalLink } from "lucide-react";
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

export default function ConfigFechaduras() {
  const [lockId, setLockId] = useState("1");
  const [origem, setOrigem] = useState("web");
  const [loading, setLoading] = useState(false);
  const [historico, setHistorico] = useState<Comando[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [ultimoComando, setUltimoComando] = useState<{ id: number; status: string } | null>(null);

  const baseUrl = String(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, "");

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
              <p className="text-sm mt-1">Sem autenticação (fase inicial)</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground font-medium">Polling recomendado</p>
              <p className="text-sm mt-1">GET /comandos a cada 2s</p>
            </div>
          </div>
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
        </CardContent>
      </Card>

      {/* Test Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Painel de Teste</CardTitle>
          <CardDescription>Envie comandos de teste diretamente para a API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Send command */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Enviar Comando — Abrir Fechadura</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lock_id">Lock ID</Label>
                <Input
                  id="lock_id"
                  type="number"
                  min={1}
                  value={lockId}
                  onChange={(e) => setLockId(e.target.value)}
                  placeholder="Ex: 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Input
                  id="origem"
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="web, app, api..."
                />
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

          {/* Quick actions */}
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
