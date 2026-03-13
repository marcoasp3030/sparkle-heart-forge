import { useState } from "react";
import { motion, useMotionValue, useTransform, animate, PanInfo, AnimatePresence } from "framer-motion";
import { Lock, Unlock, Wrench, User, CalendarClock, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import CountdownPorta, { useUrgencyLevel } from "./CountdownPorta";

export interface ScheduledReservation {
  id: string;
  door_id: string;
  person_name?: string;
  starts_at: string;
  expires_at?: string | null;
}

export interface LockerDoorData {
  id: string;
  door_number: number;
  label: string | null;
  size: "small" | "medium" | "large";
  status: "available" | "occupied" | "maintenance" | "reserved" | "hygienizing";
  occupied_by: string | null;
  usage_type?: string;
  expires_at?: string | null;
  occupied_at?: string | null;
  scheduledReservation?: ScheduledReservation | null;
}

interface LockerDoorProps {
  door: LockerDoorData;
  index: number;
  onSelect?: (door: LockerDoorData) => void;
  onQuickReserve?: (door: LockerDoorData) => void;
  onQuickRelease?: (door: LockerDoorData) => void;
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
  hygienizing: {
    label: "Higienização",
    bg: "from-cyan-50 to-cyan-100/80 dark:from-cyan-950/40 dark:to-cyan-900/30",
    border: "border-cyan-200/60 dark:border-cyan-700/40",
    icon: Droplets,
    iconColor: "text-cyan-600 dark:text-cyan-400",
    led: "bg-cyan-500",
    ledGlow: "shadow-[0_0_6px_2px_rgba(6,182,212,0.5)]",
    handleColor: "bg-cyan-300/60 dark:bg-cyan-600/40",
    hoverBorder: "",
    hoverShadow: "",
  },
};

const SWIPE_THRESHOLD = 50;
const ACTION_WIDTH = 64;

// LED pulse speed based on urgency
function getLedAnimation(status: string, urgency: string) {
  if (status === "available") return { opacity: [1, 0.4, 1], scale: [1, 1.1, 1] };
  if (status === "occupied" && urgency === "critical") return { opacity: [1, 0.2, 1], scale: [1, 1.3, 1] };
  if (status === "occupied" && urgency === "warning") return { opacity: [1, 0.5, 1], scale: [1, 1.15, 1] };
  return {};
}

function getLedTransition(status: string, urgency: string) {
  if (status === "available") return { repeat: Infinity, duration: 2 };
  if (status === "occupied" && urgency === "critical") return { repeat: Infinity, duration: 0.6 };
  if (status === "occupied" && urgency === "warning") return { repeat: Infinity, duration: 1.2 };
  return {};
}

// Override LED color based on urgency
function getLedUrgencyColor(urgency: string) {
  if (urgency === "critical") return "bg-rose-500 shadow-[0_0_8px_3px_rgba(244,63,94,0.7)]";
  if (urgency === "warning") return "bg-amber-500 shadow-[0_0_8px_3px_rgba(245,158,11,0.6)]";
  if (urgency === "expired") return "bg-rose-600 shadow-[0_0_10px_3px_rgba(220,38,38,0.8)]";
  return "";
}

export default function PortaArmario({ door, index, onSelect, onQuickReserve, onQuickRelease, isCurrentUser, isAdmin }: LockerDoorProps) {
  const config = statusConfig[door.status];
  const Icon = config.icon;
  const isClickable = Boolean(isAdmin || door.status === "available" || isCurrentUser || door.status === "maintenance" || door.status === "hygienizing");
  const isMobile = useIsMobile();
  const [swiped, setSwiped] = useState(false);
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [-ACTION_WIDTH, -20, 0], [1, 0.5, 0]);

  const isTemporary = door.usage_type === "temporary" && door.status === "occupied" && !!door.expires_at;
  const { urgency } = useUrgencyLevel(isTemporary ? door.expires_at : null, door.occupied_at);
  const hasSchedule = !!door.scheduledReservation;

  const canSwipe = isMobile && (
    (door.status === "available" && !!onQuickReserve) ||
    (door.status === "occupied" && isCurrentUser && !!onQuickRelease)
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD && canSwipe) {
      animate(x, -ACTION_WIDTH, { type: "spring", stiffness: 300, damping: 30 });
      setSwiped(true);
    } else {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      setSwiped(false);
    }
  };

  const handleQuickAction = () => {
    if (door.status === "available") {
      onQuickReserve?.(door);
    } else if (door.status === "occupied" && isCurrentUser) {
      onQuickRelease?.(door);
    }
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    setSwiped(false);
  };

  const handleTap = () => {
    if (swiped) {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      setSwiped(false);
      return;
    }
    if (isClickable) onSelect?.(door);
  };

  const ledAnim = getLedAnimation(door.status, urgency);
  const ledTrans = getLedTransition(door.status, urgency);
  const urgencyLedColor = isTemporary ? getLedUrgencyColor(urgency) : "";

  const doorContent = (
    <div
      className={cn(
        "relative w-full rounded-lg border-2 transition-all duration-500 flex flex-col items-center justify-center gap-1 group overflow-hidden",
        "bg-gradient-to-b",
        sizeMap[door.size],
        config.bg,
        config.border,
        config.hoverBorder,
        config.hoverShadow,
        isClickable ? "cursor-pointer" : "cursor-default",
        isCurrentUser && "ring-2 ring-primary/50 ring-offset-1 ring-offset-background",
        // Urgency border overrides
        urgency === "critical" && "border-rose-400/80 dark:border-rose-500/60",
        urgency === "warning" && "border-amber-400/60 dark:border-amber-500/40",
        urgency === "expired" && "border-rose-500 dark:border-rose-600 opacity-75"
      )}
    >
      {/* Metallic top edge */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
      {/* Inner shadow */}
      <div className="absolute inset-0 rounded-lg shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] pointer-events-none" />
      
      {/* LED with urgency-aware pulsing */}
      <div className="absolute top-2 left-2">
        <motion.div
          animate={ledAnim}
          transition={ledTrans}
          className={cn(
            "h-2 w-2 rounded-full transition-colors duration-500",
            urgencyLedColor || cn(config.led, config.ledGlow)
          )}
        />
      </div>

      {/* Countdown ring - top right for temporary occupied */}
      {isTemporary && door.expires_at && (
        <div className="absolute top-1.5 right-7">
          <CountdownPorta expiresAt={door.expires_at} size="sm" />
        </div>
      )}

      {/* Handle */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5">
        <div className={cn("w-3 h-3 rounded-full border-2 border-foreground/15 dark:border-foreground/20 transition-colors", config.handleColor)} />
        <div className="w-[2px] h-3 rounded-full bg-foreground/10 dark:bg-foreground/15" />
      </div>

      {/* Content with animated status icon */}
      <AnimatePresence mode="wait">
        <motion.div
          key={door.status}
          initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.6, opacity: 0, rotate: 15 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Icon className={cn("h-4 w-4 transition-all duration-200 drop-shadow-sm", config.iconColor, isClickable && "group-hover:scale-110")} />
        </motion.div>
      </AnimatePresence>
      <span className="text-[10px] font-bold text-foreground/60 font-mono tracking-wide">
        {door.label || `${door.door_number}`}
      </span>

      {/* Scheduled reservation badge */}
      {hasSchedule && (
        <div className="absolute top-1.5 left-6 flex items-center gap-0.5">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 2.5 }}
          >
            <CalendarClock className="h-3 w-3 text-violet-500 dark:text-violet-400 drop-shadow-sm" />
          </motion.div>
        </div>
      )}

      {/* Ventilation */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col gap-[2px]">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-5 h-[1.5px] rounded-full bg-foreground/[0.06] dark:bg-foreground/[0.08]" />
        ))}
      </div>

      {/* Hover overlay */}
      {isClickable && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 to-white/20 dark:from-white/0 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}

      {/* Urgency shimmer for critical */}
      {urgency === "critical" && (
        <motion.div
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 bg-gradient-to-t from-rose-500/20 to-transparent pointer-events-none rounded-lg"
        />
      )}

      {/* Swipe hint for mobile */}
      {canSwipe && !swiped && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-30">
          <div className="w-1 h-4 rounded-full bg-foreground/20 animate-pulse" />
        </div>
      )}
    </div>
  );

  // Mobile: swipeable version
  if (canSwipe) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.025, duration: 0.3, type: "spring", stiffness: 300 }}
        className="relative overflow-hidden rounded-lg"
      >
        {/* Action behind */}
        <motion.div
          style={{ opacity: actionOpacity }}
          className={cn(
            "absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-r-lg",
            door.status === "available"
              ? "bg-emerald-500 dark:bg-emerald-600"
              : "bg-rose-500 dark:bg-rose-600"
          )}
          onClick={handleQuickAction}
        >
          <div className="w-16 flex flex-col items-center justify-center gap-0.5 text-white">
            {door.status === "available" ? (
              <>
                <Lock className="h-4 w-4" />
                <span className="text-[8px] font-bold uppercase tracking-wider">Reservar</span>
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                <span className="text-[8px] font-bold uppercase tracking-wider">Liberar</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Draggable door */}
        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          onClick={handleTap}
          className="relative z-10"
        >
          {doorContent}
        </motion.div>
      </motion.div>
    );
  }

  // Desktop / non-swipeable: standard version with tooltip
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
          className="w-full"
        >
          {doorContent}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[220px]">
        <p className="font-semibold">{door.label || `Porta #${door.door_number}`}</p>
        <p className="text-muted-foreground">
          {config.label} • {door.size === "small" ? "P" : door.size === "medium" ? "M" : "G"}
          {isTemporary && door.expires_at && ` • Expira ${new Date(door.expires_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
        </p>
        {hasSchedule && door.scheduledReservation && (
          <div className="mt-1 pt-1 border-t border-border/50 text-violet-600 dark:text-violet-400">
            <p className="font-medium flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              Agendamento
            </p>
            {door.scheduledReservation.person_name && (
              <p className="text-muted-foreground">{door.scheduledReservation.person_name}</p>
            )}
            <p className="text-muted-foreground">
              {new Date(door.scheduledReservation.starts_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
