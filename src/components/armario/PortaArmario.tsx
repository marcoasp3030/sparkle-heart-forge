import { motion } from "framer-motion";
import { Lock, Unlock, Wrench, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface LockerDoorData {
  id: string;
  door_number: number;
  label: string | null;
  size: "small" | "medium" | "large";
  status: "available" | "occupied" | "maintenance" | "reserved";
  occupied_by: string | null;
}

interface LockerDoorProps {
  door: LockerDoorData;
  index: number;
  onSelect?: (door: LockerDoorData) => void;
  isCurrentUser?: boolean;
  isAdmin?: boolean;
}

const sizeMap = {
  small: "h-16 md:h-20",
  medium: "h-20 md:h-28",
  large: "h-28 md:h-36",
};

const statusConfig = {
  available: {
    label: "Disponível",
    bg: "from-emerald-50 to-emerald-100/80 dark:from-emerald-950/40 dark:to-emerald-900/30",
    border: "border-emerald-200/60 dark:border-emerald-700/40",
    icon: Unlock,
    iconColor: "text-emerald-600 dark:text-emerald-400",
    led: "bg-emerald-500",
    ledGlow: "shadow-[0_0_6px_2px_rgba(16,185,129,0.6)]",
    handleColor: "bg-emerald-300/60 dark:bg-emerald-600/40",
    hoverBorder: "hover:border-emerald-400/80 dark:hover:border-emerald-500/60",
    hoverShadow: "hover:shadow-[0_4px_20px_-4px_rgba(16,185,129,0.25)]",
  },
  occupied: {
    label: "Ocupado",
    bg: "from-rose-50 to-rose-100/80 dark:from-rose-950/40 dark:to-rose-900/30",
    border: "border-rose-200/60 dark:border-rose-700/40",
    icon: Lock,
    iconColor: "text-rose-600 dark:text-rose-400",
    led: "bg-rose-500",
    ledGlow: "shadow-[0_0_6px_2px_rgba(244,63,94,0.5)]",
    handleColor: "bg-rose-300/60 dark:bg-rose-600/40",
    hoverBorder: "",
    hoverShadow: "",
  },
  maintenance: {
    label: "Manutenção",
    bg: "from-amber-50 to-amber-100/80 dark:from-amber-950/40 dark:to-amber-900/30",
    border: "border-amber-200/60 dark:border-amber-700/40",
    icon: Wrench,
    iconColor: "text-amber-600 dark:text-amber-400",
    led: "bg-amber-500",
    ledGlow: "shadow-[0_0_6px_2px_rgba(245,158,11,0.5)]",
    handleColor: "bg-amber-300/60 dark:bg-amber-600/40",
    hoverBorder: "",
    hoverShadow: "",
  },
  reserved: {
    label: "Reservado",
    bg: "from-blue-50 to-blue-100/80 dark:from-blue-950/40 dark:to-blue-900/30",
    border: "border-blue-200/60 dark:border-blue-700/40",
    icon: User,
    iconColor: "text-blue-600 dark:text-blue-400",
    led: "bg-blue-500",
    ledGlow: "shadow-[0_0_6px_2px_rgba(59,130,246,0.5)]",
    handleColor: "bg-blue-300/60 dark:bg-blue-600/40",
    hoverBorder: "",
    hoverShadow: "",
  },
};

export default function PortaArmario({ door, index, onSelect, isCurrentUser, isAdmin }: LockerDoorProps) {
  const config = statusConfig[door.status];
  const Icon = config.icon;
  const isClickable = Boolean(isAdmin || door.status === "available" || isCurrentUser || door.status === "maintenance");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.025, duration: 0.3, type: "spring", stiffness: 300 }}
          whileHover={isClickable ? { scale: 1.03, y: -2 } : undefined}
          whileTap={isClickable ? { scale: 0.97 } : undefined}
          onClick={() => isClickable && onSelect?.(door)}
          disabled={!isClickable}
          className={cn(
            "relative w-full rounded-lg border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 group overflow-hidden",
            "bg-gradient-to-b",
            sizeMap[door.size],
            config.bg,
            config.border,
            config.hoverBorder,
            config.hoverShadow,
            isClickable ? "cursor-pointer" : "cursor-default",
            isCurrentUser && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
          )}
        >
          {/* Metallic top edge */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />

          {/* Inner shadow for depth */}
          <div className="absolute inset-0 rounded-lg shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] pointer-events-none" />

          {/* LED indicator */}
          <div className="absolute top-2 left-2">
            <div className={cn(
              "h-2 w-2 rounded-full transition-all duration-500",
              config.led, config.ledGlow,
              door.status === "available" && "animate-pulse"
            )} />
          </div>

          {/* Door handle - circular realistic */}
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5">
            <div className={cn(
              "w-3 h-3 rounded-full border-2 border-foreground/15 dark:border-foreground/20 transition-colors",
              config.handleColor
            )} />
            <div className="w-[2px] h-3 rounded-full bg-foreground/10 dark:bg-foreground/15" />
          </div>

          {/* Content */}
          <Icon className={cn(
            "h-4 w-4 transition-all duration-200 drop-shadow-sm",
            config.iconColor,
            isClickable && "group-hover:scale-110"
          )} />
          <span className="text-[10px] font-bold text-foreground/60 font-mono tracking-wide">
            {door.label || `${door.door_number}`}
          </span>

          {/* Ventilation slots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col gap-[2px]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-5 h-[1.5px] rounded-full bg-foreground/[0.06] dark:bg-foreground/[0.08]" />
            ))}
          </div>

          {/* Hover overlay */}
          {isClickable && (
            <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-white/20 dark:from-white/0 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          )}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p className="font-semibold">{door.label || `Porta #${door.door_number}`}</p>
        <p className="text-muted-foreground">{config.label} • {door.size === "small" ? "P" : door.size === "medium" ? "M" : "G"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
