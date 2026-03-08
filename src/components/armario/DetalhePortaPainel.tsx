import { useState, useEffect } from "react";
import { Lock, Unlock, Wrench, User, Hash, Maximize2, Calendar, Clock, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";

export interface LockerDoorDataExtended {
  id: string;
  door_number: number;
  label: string | null;
  size: "small" | "medium" | "large";
  status: "available" | "occupied" | "maintenance" | "reserved";
  occupied_by: string | null;
  occupied_by_person: string | null;
  usage_type: string;
  expires_at: string | null;
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "Disponível", color: "text-emerald-600", bg: "bg-emerald-500" },
  occupied: { label: "Ocupado", color: "text-rose-600", bg: "bg-rose-500" },
  maintenance: { label: "Manutenção", color: "text-amber-600", bg: "bg-amber-500" },
  reserved: { label: "Reservado", color: "text-blue-600", bg: "bg-blue-500" },
};

const sizeLabels: Record<string, string> = { small: "Pequeno", medium: "Médio", large: "Grande" };

interface Pessoa {
  id: string;
  nome: string;
  tipo: string;
  matricula: string | null;
}

interface DoorDetailSheetProps {
  door: LockerDoorDataExtended | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReserve?: (door: LockerDoorDataExtended, personId: string, usageType: string, expiresAt: string | null) => void;
  onRelease?: (door: LockerDoorDataExtended) => void;
  isCurrentUser?: boolean;
  loading?: boolean;
  isAdmin?: boolean;
  onSetMaintenance?: (door: LockerDoorDataExtended) => void;
}

type ConfirmAction = "reserve" | "release" | "maintenance" | "unmaintenance" | null;

const confirmConfig: Record<string, { title: string; description: string; actionLabel: string; variant: "default" | "destructive" }> = {
  reserve: {
    title: "Confirmar reserva",
    description: "Tem certeza que deseja reservar esta porta para a pessoa selecionada?",
    actionLabel: "Reservar",
    variant: "default",
  },
  release: {
    title: "Confirmar liberação",
    description: "Tem certeza que deseja liberar esta porta? Ela ficará disponível para outros usuários.",
    actionLabel: "Liberar",
    variant: "destructive",
  },
  maintenance: {
    title: "Colocar em manutenção",
    description: "Tem certeza que deseja colocar esta porta em manutenção? Ela ficará indisponível para uso.",
    actionLabel: "Confirmar manutenção",
    variant: "destructive",
  },
  unmaintenance: {
    title: "Retirar da manutenção",
    description: "Tem certeza que deseja retirar esta porta da manutenção? Ela voltará a ficar disponível.",
    actionLabel: "Retirar manutenção",
    variant: "default",
  },
};

export default function DetalhePortaPainel({ door, open, onOpenChange, onReserve, onRelease, isCurrentUser, loading, isAdmin, onSetMaintenance }: DoorDetailSheetProps) {
  const { selectedCompany } = useCompany();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [usageType, setUsageType] = useState<string>("temporary");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [personName, setPersonName] = useState<string | null>(null);

  // Fetch people for selection
  useEffect(() => {
    if (!open || !selectedCompany) return;
    const fetchPessoas = async () => {
      const { data } = await supabase
        .from("funcionarios_clientes")
        .select("id, nome, tipo, matricula")
        .eq("company_id", selectedCompany.id)
        .eq("ativo", true)
        .order("nome");
      if (data) setPessoas(data);
    };
    fetchPessoas();
  }, [open, selectedCompany]);

  // Load person name for occupied doors
  useEffect(() => {
    if (!door?.occupied_by_person) {
      setPersonName(null);
      return;
    }
    const fetchName = async () => {
      const { data } = await supabase
        .from("funcionarios_clientes")
        .select("nome")
        .eq("id", door.occupied_by_person!)
        .single();
      setPersonName(data?.nome || null);
    };
    fetchName();
  }, [door?.occupied_by_person]);

  // Reset form when door changes
  useEffect(() => {
    setSelectedPersonId("");
    setUsageType("temporary");
    setExpiresAt("");
  }, [door?.id]);

  const status = door ? statusLabels[door.status] : statusLabels.available;
  const StatusIcon = !door ? Unlock : door.status === "available" ? Unlock : door.status === "occupied" ? Lock : door.status === "maintenance" ? Wrench : User;

  if (!door) return null;

  const handleConfirm = () => {
    if (!door) return;
    switch (confirmAction) {
      case "reserve": onReserve?.(door, selectedPersonId, usageType, usageType === "temporary" && expiresAt ? new Date(expiresAt).toISOString() : null); break;
      case "release": onRelease?.(door); break;
      case "maintenance": onSetMaintenance?.(door); break;
      case "unmaintenance": onRelease?.(door); break;
    }
    setConfirmAction(null);
  };

  const canReserve = selectedPersonId && (usageType === "permanent" || (usageType === "temporary" && expiresAt));

  const config = confirmAction ? confirmConfig[confirmAction] : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:w-[400px] md:w-[440px] rounded-l-2xl p-0 overflow-hidden">
          {/* Door illustration header */}
          <div className="relative bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 px-6 pt-8 pb-6">
            <div className="mx-auto w-28 h-40 rounded-lg bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-600 dark:to-slate-700 border-2 border-slate-300 dark:border-slate-500 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] rounded-lg" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1">
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-400 bg-slate-200 dark:bg-slate-500" />
                <div className="w-[3px] h-4 rounded-full bg-slate-300 dark:bg-slate-500" />
              </div>
              <div className="absolute top-3 left-3">
                <motion.div
                  animate={door.status === "available" ? { opacity: [1, 0.4, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className={`h-3 w-3 rounded-full ${status.bg} shadow-[0_0_8px_2px] ${
                    door.status === "available" ? "shadow-emerald-500/50" :
                    door.status === "occupied" ? "shadow-rose-500/50" :
                    door.status === "maintenance" ? "shadow-amber-500/50" : "shadow-blue-500/50"
                  }`}
                />
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                <span className="text-lg font-extrabold font-mono text-slate-500 dark:text-slate-300">{door.door_number}</span>
              </div>
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col gap-[2px]">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-8 h-[2px] rounded-full bg-slate-300/60 dark:bg-slate-500/40" />
                ))}
              </div>
            </div>

            <div className="absolute top-4 right-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 shadow-sm">
                <div className={`h-2 w-2 rounded-full ${status.bg}`} />
                <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
              </div>
            </div>
          </div>

          <div className="px-6 pt-6 pb-8 space-y-6 overflow-y-auto max-h-[calc(100vh-280px)]">
            <SheetHeader className="p-0">
              <SheetTitle className="text-xl font-extrabold">
                {door.label || `Porta #${door.door_number}`}
              </SheetTitle>
            </SheetHeader>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/50 border border-border/40 text-center">
                <Hash className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Número</p>
                <p className="text-sm font-bold text-foreground font-mono mt-0.5">#{door.door_number}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/40 text-center">
                <Maximize2 className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tamanho</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{sizeLabels[door.size]}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 border border-border/40 text-center">
                <StatusIcon className={`h-4 w-4 mx-auto mb-1 ${status.color}`} />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</p>
                <p className={`text-sm font-bold mt-0.5 ${status.color}`}>{status.label}</p>
              </div>
            </div>

            {/* Occupied info */}
            {door.status === "occupied" && (personName || door.usage_type || door.expires_at) && (
              <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                {personName && (
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{personName}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {door.usage_type === "permanent" ? "Uso permanente" : "Uso temporário"}
                  </span>
                </div>
                {door.expires_at && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Expira em: {new Date(door.expires_at).toLocaleDateString("pt-BR")} às {new Date(door.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Reservation form */}
            {door.status === "available" && isAdmin && (
              <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vincular pessoa</p>
                
                <div className="space-y-2">
                  <Label className="text-xs">Pessoa</Label>
                  <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecione uma pessoa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pessoas.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-sm">
                          <span>{p.nome}</span>
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({p.tipo === "funcionario" ? "Funcionário" : "Cliente"}{p.matricula ? ` • ${p.matricula}` : ""})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tipo de uso</Label>
                  <Select value={usageType} onValueChange={setUsageType}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanente</SelectItem>
                      <SelectItem value="temporary">Temporário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {usageType === "temporary" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Data de expiração</Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="h-9 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {door.status === "available" && isAdmin && (
                <Button
                  onClick={() => setConfirmAction("reserve")}
                  disabled={loading || !canReserve}
                  className="w-full h-12 gradient-primary border-0 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Reservar para pessoa selecionada
                </Button>
              )}

              {(isCurrentUser || isAdmin) && door.status === "occupied" && (
                <Button
                  onClick={() => setConfirmAction("release")}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-12 rounded-xl font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Unlock className="mr-2 h-4 w-4" />
                  Liberar armário
                </Button>
              )}

              {isAdmin && door.status !== "maintenance" && (
                <Button
                  onClick={() => setConfirmAction("maintenance")}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-10 rounded-xl text-sm font-medium border-amber-300/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Wrench className="mr-2 h-3.5 w-3.5" />
                  Colocar em manutenção
                </Button>
              )}

              {isAdmin && door.status === "maintenance" && (
                <Button
                  onClick={() => setConfirmAction("unmaintenance")}
                  disabled={loading}
                  variant="outline"
                  className="w-full h-10 rounded-xl text-sm font-medium border-emerald-300/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <Unlock className="mr-2 h-3.5 w-3.5" />
                  Retirar da manutenção
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{config?.title}</AlertDialogTitle>
            <AlertDialogDescription>{config?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className={`rounded-xl ${config?.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary border-0 text-primary-foreground hover:opacity-90"}`}
            >
              {loading ? "Processando..." : config?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
