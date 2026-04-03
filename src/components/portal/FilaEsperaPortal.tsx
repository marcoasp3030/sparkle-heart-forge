import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Archive, MapPin, CheckCircle2, Loader2, XCircle } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WaitlistEntry {
  id: string;
  locker_id: string;
  preferred_size: string | null;
  status: string;
  created_at: string;
  notified_at: string | null;
  locker_name?: string;
  locker_location?: string;
}

interface LockerOption {
  id: string;
  name: string;
  location: string;
}

interface FilaEsperaPortalProps {
  personId: string;
  companyId: string;
  userId: string;
}

const sizeLabels: Record<string, string> = {
  any: "Qualquer tamanho",
  small: "Pequena (P)",
  medium: "Média (M)",
  large: "Grande (G)",
};

const statusLabels: Record<string, { label: string; class: string }> = {
  waiting: { label: "Na Fila", class: "bg-accent/10 text-accent border-accent/20" },
  notified: { label: "Notificado", class: "bg-green-500/10 text-green-600 border-green-500/20" },
  cancelled: { label: "Cancelado", class: "bg-muted text-muted-foreground border-border" },
  fulfilled: { label: "Atendido", class: "bg-primary/10 text-primary border-primary/20" },
};

export default function FilaEsperaPortal({ personId, companyId, userId }: FilaEsperaPortalProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [lockers, setLockers] = useState<LockerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState("");
  const [preferredSize, setPreferredSize] = useState("any");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get("/mobile/fila");
      const data = res.data?.data || {};
      setEntries(data.entries || []);
      setLockers(data.lockers || []);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [personId, companyId]);

  const handleJoinWaitlist = async () => {
    if (!selectedLocker) {
      toast.error("Selecione um armário");
      return;
    }

    const existing = entries.find(e => e.locker_id === selectedLocker && e.status === "waiting");
    if (existing) {
      toast.error("Você já está na fila de espera deste armário");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/mobile/fila", {
        locker_id: selectedLocker,
        preferred_size: preferredSize === "any" ? undefined : preferredSize,
      });

      toast.success("Você entrou na fila de espera! Será notificado quando uma porta estiver disponível.");
      setShowDialog(false);
      setSelectedLocker("");
      setPreferredSize("any");
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Erro ao entrar na fila";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEntry = async (entryId: string) => {
    try {
      await api.put(`/mobile/fila/${entryId}/cancelar`);
      toast.success("Saiu da fila de espera");
      await fetchData();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Erro ao cancelar";
      toast.error(msg);
    }
  };

  const activeEntries = entries.filter(e => e.status === "waiting" || e.status === "notified");
  const pastEntries = entries.filter(e => e.status === "cancelled" || e.status === "fulfilled");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button className="w-full gap-2" onClick={() => setShowDialog(true)}>
        <Clock className="h-4 w-4" />
        Entrar na Fila de Espera
      </Button>

      {activeEntries.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            Suas Posições na Fila
          </h2>
          <Card className="shadow-card border-border/50">
            <CardContent className="p-0 divide-y divide-border">
              {activeEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">{entry.locker_name}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusLabels[entry.status]?.class || ""}`}>
                      {statusLabels[entry.status]?.label || entry.status}
                    </Badge>
                  </div>
                  {entry.locker_location && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      {entry.locker_location}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      <span>Preferência: {sizeLabels[entry.preferred_size || "any"]}</span>
                      <span className="mx-1.5">•</span>
                      <span>{formatDistanceToNow(new Date(entry.created_at), { locale: ptBR, addSuffix: true })}</span>
                    </div>
                    {entry.status === "waiting" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive h-7 gap-1"
                        onClick={() => handleCancelEntry(entry.id)}
                      >
                        <XCircle className="h-3 w-3" />
                        Sair
                      </Button>
                    )}
                  </div>
                  {entry.status === "notified" && entry.notified_at && (
                    <div className="mt-2 rounded-lg bg-green-500/5 border border-green-500/20 p-2 text-xs text-green-600 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Porta disponível! Notificado {formatDistanceToNow(new Date(entry.notified_at), { locale: ptBR, addSuffix: true })}
                    </div>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {pastEntries.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mt-4">
            Histórico da Fila
          </h2>
          <Card className="shadow-card border-border/50">
            <CardContent className="p-0 divide-y divide-border">
              {pastEntries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{entry.locker_name}</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      {format(new Date(entry.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      {entry.preferred_size && ` • ${sizeLabels[entry.preferred_size] || entry.preferred_size}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusLabels[entry.status]?.class || ""}`}>
                    {statusLabels[entry.status]?.label || entry.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {entries.length === 0 && (
        <Card className="shadow-card border-border/50">
          <CardContent className="p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Nenhuma entrada na fila</h3>
            <p className="text-sm text-muted-foreground">
              Caso não haja portas disponíveis, entre na fila de espera para ser notificado.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Entrar na Fila de Espera
            </DialogTitle>
            <DialogDescription>
              Selecione o armário desejado e o tamanho de preferência. Você será notificado assim que uma porta estiver disponível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Armário</Label>
              <Select value={selectedLocker} onValueChange={setSelectedLocker}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um armário" />
                </SelectTrigger>
                <SelectContent>
                  {lockers.map((locker) => (
                    <SelectItem key={locker.id} value={locker.id}>
                      {locker.name} {locker.location ? `— ${locker.location}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tamanho preferido</Label>
              <Select value={preferredSize} onValueChange={setPreferredSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer tamanho</SelectItem>
                  <SelectItem value="small">Pequena (P)</SelectItem>
                  <SelectItem value="medium">Média (M)</SelectItem>
                  <SelectItem value="large">Grande (G)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Escolher um tamanho específico pode aumentar o tempo de espera.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleJoinWaitlist} disabled={submitting || !selectedLocker}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                "Entrar na Fila"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
