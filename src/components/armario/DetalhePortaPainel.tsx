import { useState } from "react";
import { Lock, Unlock, Wrench, User, Hash, Maximize2 } from "lucide-react";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { LockerDoorData } from "./PortaArmario";

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: "Disponível", color: "text-emerald-600", bg: "bg-emerald-500" },
  occupied: { label: "Ocupado", color: "text-rose-600", bg: "bg-rose-500" },
  maintenance: { label: "Manutenção", color: "text-amber-600", bg: "bg-amber-500" },
  reserved: { label: "Reservado", color: "text-blue-600", bg: "bg-blue-500" },
};

const sizeLabels: Record<string, string> = { small: "Pequeno", medium: "Médio", large: "Grande" };

interface DoorDetailSheetProps {
  door: LockerDoorData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReserve?: (door: LockerDoorData) => void;
  onRelease?: (door: LockerDoorData) => void;
  isCurrentUser?: boolean;
  loading?: boolean;
  isAdmin?: boolean;
  onSetMaintenance?: (door: LockerDoorData) => void;
}

type ConfirmAction = "reserve" | "release" | "maintenance" | "unmaintenance" | null;

const confirmConfig: Record<string, { title: string; description: string; actionLabel: string; variant: "default" | "destructive" }> = {
  reserve: {
    title: "Confirmar reserva",
    description: "Tem certeza que deseja reservar esta porta? Ela ficará vinculada ao seu usuário.",
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
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const status = door ? statusLabels[door.status] : statusLabels.available;
  const StatusIcon = !door ? Unlock : door.status === "available" ? Unlock : door.status === "occupied" ? Lock : door.status === "maintenance" ? Wrench : User;

  if (!door) return null;

  const handleConfirm = () => {
    if (!door) return;
    switch (confirmAction) {
      case "reserve": onReserve?.(door); break;
      case "release": onRelease?.(door); break;
      case "maintenance": onSetMaintenance?.(door); break;
      case "unmaintenance": onRelease?.(door); break;
    }
    setConfirmAction(null);
  };

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

          <div className="px-6 pt-6 pb-8 space-y-6">
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

            <div className="space-y-3">
              {door.status === "available" && (
                <Button
                  onClick={() => setConfirmAction("reserve")}
                  disabled={loading}
                  className="w-full h-12 gradient-primary border-0 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Reservar este armário
                </Button>
              )}

              {isCurrentUser && door.status === "occupied" && (
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
