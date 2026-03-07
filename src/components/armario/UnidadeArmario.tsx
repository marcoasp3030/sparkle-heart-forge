import { motion } from "framer-motion";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PortaArmario, { LockerDoorData } from "./PortaArmario";

export interface LockerData {
  id: string;
  name: string;
  location: string;
  orientation: "vertical" | "horizontal";
  columns: number;
  rows: number;
}

interface LockerUnitProps {
  locker: LockerData;
  doors: LockerDoorData[];
  onSelectDoor?: (door: LockerDoorData) => void;
  onEdit?: (locker: LockerData) => void;
  onDelete?: (locker: LockerData) => void;
  currentUserId?: string;
  isAdmin?: boolean;
  index?: number;
}

export default function LockerUnit({ locker, doors, onSelectDoor, onEdit, onDelete, currentUserId, isAdmin, index = 0 }: LockerUnitProps) {
  const gridCols = locker.orientation === "horizontal" ? locker.rows : locker.columns;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="group/locker"
    >
      <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
        <div className="h-2 gradient-primary opacity-80" />

        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">{locker.name}</h3>
            {locker.location && <p className="text-[11px] text-muted-foreground">{locker.location}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {locker.orientation === "vertical" ? "Vertical" : "Horizontal"}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {doors.length} portas
            </span>
            {isAdmin && (
              <div className="flex items-center gap-1 opacity-0 group-hover/locker:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit?.(locker)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(locker)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-muted/20">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
            {doors
              .sort((a, b) => a.door_number - b.door_number)
              .map((door, i) => (
                <LockerDoor key={door.id} door={door} index={i} onSelect={onSelectDoor} isCurrentUser={door.occupied_by === currentUserId} />
              ))}
          </div>
        </div>

        <div className="h-1.5 bg-border/30" />
      </div>
    </motion.div>
  );
}
