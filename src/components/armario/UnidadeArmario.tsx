import { motion } from "framer-motion";
import { Pencil, Trash2, MapPin, Lock, Unlock, Wrench, RotateCcw, CalendarClock, Droplets } from "lucide-react";
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
  onQuickReserve?: (door: LockerDoorData) => void;
  onQuickRelease?: (door: LockerDoorData) => void;
  onEdit?: (locker: LockerData) => void;
  onDelete?: (locker: LockerData) => void;
  currentUserId?: string;
  isAdmin?: boolean;
  index?: number;
}

export default function UnidadeArmario({ locker, doors, onSelectDoor, onQuickReserve, onQuickRelease, onEdit, onDelete, currentUserId, isAdmin, index = 0 }: LockerUnitProps) {
  const gridCols = locker.orientation === "horizontal" ? locker.rows : locker.columns;

  const available = doors.filter((d) => d.status === "available").length;
  const occupied = doors.filter((d) => d.status === "occupied").length;
  const maintenance = doors.filter((d) => d.status === "maintenance").length;
  const scheduled = doors.filter((d) => !!d.scheduledReservation).length;
  const hygienizing = doors.filter((d) => d.status === "hygienizing").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, type: "spring", stiffness: 200 }}
      className="group/locker"
    >
      <div className="rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition-all duration-500 bg-gradient-to-b from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-900 border border-slate-300/50 dark:border-slate-600/30">
        {/* Metallic top rail */}
        <div className="h-3 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300 dark:from-slate-600 dark:via-slate-500 dark:to-slate-600 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          {/* Screws */}
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-slate-400/60 dark:bg-slate-500/60 shadow-inner" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-slate-400/60 dark:bg-slate-500/60 shadow-inner" />
        </div>

        {/* Header - Engraved nameplate */}
        <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-b from-slate-200/60 to-transparent dark:from-slate-700/40 dark:to-transparent">
          <div className="flex items-center gap-3">
            {/* Metal nameplate */}
            <div className="px-3 py-1.5 rounded-md bg-gradient-to-b from-slate-300/80 to-slate-400/50 dark:from-slate-600/80 dark:to-slate-700/60 border border-slate-400/30 dark:border-slate-500/30 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-200 tracking-wider uppercase">{locker.name}</h3>
            </div>
            {locker.location && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {locker.location}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-300/50 dark:bg-slate-600/50 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider">
              {locker.orientation === "vertical" ? "V" : "H"} • {doors.length}p
            </span>
            {isAdmin && (
              <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover/locker:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEdit?.(locker)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete?.(locker)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Doors grid */}
        <div className="p-3 bg-gradient-to-b from-slate-50/50 to-slate-100/30 dark:from-slate-800/50 dark:to-slate-850/30">
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {doors
              .sort((a, b) => a.door_number - b.door_number)
              .map((door, i) => (
                <PortaArmario key={door.id} door={door} index={i} onSelect={onSelectDoor} onQuickReserve={onQuickReserve} onQuickRelease={onQuickRelease} isCurrentUser={door.occupied_by === currentUserId} isAdmin={isAdmin} />
              ))}
          </div>
        </div>

        {/* Status legend bar */}
        <div className="px-4 py-2.5 bg-gradient-to-b from-slate-100/60 to-slate-200/80 dark:from-slate-800/60 dark:to-slate-900/80 border-t border-slate-300/30 dark:border-slate-600/20 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{available}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-[10px] font-medium text-muted-foreground">{occupied}</span>
          </div>
          {maintenance > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-[10px] font-medium text-muted-foreground">{maintenance}</span>
            </div>
          )}
          {scheduled > 0 && (
            <div className="flex items-center gap-1.5" title="Portas com agendamento">
              <CalendarClock className="h-2.5 w-2.5 text-violet-500" />
              <span className="text-[10px] font-medium text-violet-600 dark:text-violet-400">{scheduled}</span>
            </div>
          )}
          {hygienizing > 0 && (
            <div className="flex items-center gap-1.5" title="Portas em higienização">
              <Droplets className="h-2.5 w-2.5 text-cyan-500" />
              <span className="text-[10px] font-medium text-cyan-600 dark:text-cyan-400">{hygienizing}</span>
            </div>
          )}
          <div className="flex-1" />
          <span className="text-[9px] text-muted-foreground/50 font-mono">
            {Math.round((available / Math.max(doors.length, 1)) * 100)}% livre
          </span>
        </div>

        {/* Metallic bottom rail */}
        <div className="h-2 bg-gradient-to-b from-slate-300 via-slate-200 to-slate-350 dark:from-slate-600 dark:via-slate-500 dark:to-slate-650 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </div>
    </motion.div>
  );
}
