import { Lock, Unlock, Wrench, User, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LockerDoorData } from "./LockerDoor";

const statusLabels: Record<string, { label: string; className: string }> = {
  available: { label: "Disponível", className: "bg-success/10 text-success border-success/20" },
  occupied: { label: "Ocupado", className: "bg-primary/10 text-primary border-primary/20" },
  maintenance: { label: "Manutenção", className: "bg-accent/10 text-accent border-accent/20" },
  reserved: { label: "Reservado", className: "bg-secondary/10 text-secondary border-secondary/20" },
};

interface DoorDetailSheetProps {
  door: LockerDoorData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReserve?: (door: LockerDoorData) => void;
  onRelease?: (door: LockerDoorData) => void;
  isCurrentUser?: boolean;
  loading?: boolean;
}

export default function DoorDetailSheet({ door, open, onOpenChange, onReserve, onRelease, isCurrentUser, loading }: DoorDetailSheetProps) {
  if (!door) return null;
  const status = statusLabels[door.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] sm:w-[420px] rounded-l-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border-2 ${status.className}`}>
              {door.status === "available" ? <Unlock className="h-5 w-5" /> :
               door.status === "occupied" ? <Lock className="h-5 w-5" /> :
               door.status === "maintenance" ? <Wrench className="h-5 w-5" /> :
               <User className="h-5 w-5" />}
            </div>
            <div>
              <span className="font-mono text-lg">{door.label || `Porta #${door.door_number}`}</span>
              <Badge variant="outline" className={`ml-3 text-[11px] ${status.className}`}>
                {status.label}
              </Badge>
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/50 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Tamanho</p>
              <p className="text-sm font-semibold text-foreground capitalize">{door.size === "small" ? "Pequeno" : door.size === "medium" ? "Médio" : "Grande"}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 border border-border/40">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Número</p>
              <p className="text-sm font-semibold text-foreground font-mono">#{door.door_number}</p>
            </div>
          </div>

          {door.status === "available" && (
            <Button
              onClick={() => onReserve?.(door)}
              disabled={loading}
              className="w-full h-12 gradient-primary border-0 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              <Lock className="mr-2 h-4 w-4" />
              {loading ? "Reservando..." : "Reservar este armário"}
            </Button>
          )}

          {isCurrentUser && door.status === "occupied" && (
            <Button
              onClick={() => onRelease?.(door)}
              disabled={loading}
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Unlock className="mr-2 h-4 w-4" />
              {loading ? "Liberando..." : "Liberar armário"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
