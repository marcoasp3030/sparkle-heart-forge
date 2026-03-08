import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Check, X, Clock, MessageSquare, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RenewalRequest {
  id: string;
  door_id: string;
  person_id: string;
  company_id: string;
  requested_hours: number;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  person?: { nome: string; email: string | null; matricula: string | null };
  door?: { door_number: number; label: string | null; locker?: { name: string } };
}

const statusConfig: Record<string, { label: string; class: string }> = {
  pending: { label: "Pendente", class: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  approved: { label: "Aprovado", class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  rejected: { label: "Recusado", class: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function Renovacoes() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [requests, setRequests] = useState<RenewalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actionDialog, setActionDialog] = useState<{ request: RenewalRequest; action: "approved" | "rejected" } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchRequests(); }, [filter, selectedCompany]);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from("renewal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") query = query.eq("status", filter);
    if (selectedCompany) query = query.eq("company_id", selectedCompany.id);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Erro ao carregar solicitações", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Enrich with person and door info
    const enriched = await Promise.all(
      (data || []).map(async (req) => {
        const [personRes, doorRes] = await Promise.all([
          supabase.from("funcionarios_clientes").select("nome, email, matricula").eq("id", req.person_id).single(),
          supabase.from("locker_doors").select("door_number, label, locker:lockers(name)").eq("id", req.door_id).single(),
        ]);
        return {
          ...req,
          person: personRes.data || undefined,
          door: doorRes.data ? { ...doorRes.data, locker: Array.isArray(doorRes.data.locker) ? doorRes.data.locker[0] : doorRes.data.locker } : undefined,
        } as RenewalRequest;
      })
    );

    setRequests(enriched);
    setLoading(false);
  };

  const handleAction = async () => {
    if (!actionDialog || !user) return;
    setSaving(true);

    const { error } = await supabase
      .from("renewal_requests")
      .update({
        status: actionDialog.action,
        admin_notes: adminNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", actionDialog.request.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // If approved, extend the door expiration
      if (actionDialog.action === "approved") {
        const { data: door } = await supabase
          .from("locker_doors")
          .select("expires_at")
          .eq("id", actionDialog.request.door_id)
          .single();

        if (door) {
          const base = door.expires_at ? new Date(door.expires_at) : new Date();
          const newExpiry = new Date(base.getTime() + actionDialog.request.requested_hours * 60 * 60 * 1000);
          await supabase
            .from("locker_doors")
            .update({ expires_at: newExpiry.toISOString() })
            .eq("id", actionDialog.request.door_id);
        }
      }

      toast({
        title: actionDialog.action === "approved" ? "Renovação aprovada!" : "Renovação recusada",
        description: actionDialog.action === "approved"
          ? `+${actionDialog.request.requested_hours}h adicionadas com sucesso.`
          : "A solicitação foi recusada.",
      });
      fetchRequests();
    }

    setActionDialog(null);
    setAdminNotes("");
    setSaving(false);
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            Solicitações de Renovação
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie as solicitações de extensão de prazo dos armários.</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Pendentes", value: filter === "all" ? requests.filter((r) => r.status === "pending").length : filter === "pending" ? requests.length : "—", color: "text-amber-600" },
          { label: "Aprovadas", value: filter === "all" ? requests.filter((r) => r.status === "approved").length : filter === "approved" ? requests.length : "—", color: "text-emerald-600" },
          { label: "Recusadas", value: filter === "all" ? requests.filter((r) => r.status === "rejected").length : filter === "rejected" ? requests.length : "—", color: "text-destructive" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-5">
                <p className={`text-3xl font-extrabold tracking-tight ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="shadow-card border-border/50 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border px-6">
            <CardTitle className="text-base font-bold">Solicitações</CardTitle>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="approved">Aprovadas</SelectItem>
                <SelectItem value="rejected">Recusadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhuma solicitação encontrada</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Pessoa</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Porta</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Horas</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Data</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Status</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{req.person?.nome || "—"}</p>
                              <p className="text-xs text-muted-foreground">{req.person?.matricula || req.person?.email || ""}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{req.door?.label || `Porta #${req.door?.door_number}`}</p>
                            <p className="text-xs text-muted-foreground">{req.door?.locker?.name || ""}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              +{req.requested_hours}h
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm">{format(new Date(req.created_at), "dd/MM/yy HH:mm")}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusConfig[req.status]?.class}>
                              {statusConfig[req.status]?.label || req.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {req.status === "pending" ? (
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                                  onClick={() => setActionDialog({ request: req, action: "approved" })}
                                >
                                  <Check className="h-3 w-3" /> Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => setActionDialog({ request: req, action: "rejected" })}
                                >
                                  <X className="h-3 w-3" /> Recusar
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {req.reviewed_at && format(new Date(req.reviewed_at), "dd/MM HH:mm")}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-3 p-4">
                  {requests.map((req) => (
                    <Card key={req.id} className="border-border/50">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{req.person?.nome || "—"}</p>
                            <p className="text-xs text-muted-foreground">{req.door?.label || `Porta #${req.door?.door_number}`} • {req.door?.locker?.name}</p>
                          </div>
                          <Badge variant="outline" className={statusConfig[req.status]?.class}>
                            {statusConfig[req.status]?.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> +{req.requested_hours}h</span>
                          <span>{formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 border-emerald-500/30 text-emerald-600"
                              onClick={() => setActionDialog({ request: req, action: "approved" })}>
                              <Check className="h-3 w-3" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 border-destructive/30 text-destructive"
                              onClick={() => setActionDialog({ request: req, action: "rejected" })}>
                              <X className="h-3 w-3" /> Recusar
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setAdminNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approved" ? "✅ Aprovar Renovação" : "❌ Recusar Renovação"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "approved"
                ? `Adicionar +${actionDialog?.request.requested_hours}h ao prazo de ${actionDialog?.request.person?.nome || "usuário"}.`
                : `Recusar a solicitação de ${actionDialog?.request.person?.nome || "usuário"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Observação (opcional)</label>
              <Textarea
                placeholder="Adicione uma nota para o registro..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setAdminNotes(""); }}>Cancelar</Button>
            <Button
              onClick={handleAction}
              disabled={saving}
              className={actionDialog?.action === "approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"}
            >
              {saving ? "Processando..." : actionDialog?.action === "approved" ? "Aprovar" : "Recusar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
