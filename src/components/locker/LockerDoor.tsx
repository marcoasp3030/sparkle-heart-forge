import { motion } from "framer-motion";
import { Lock, Unlock, Wrench, User } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const sizeMap = {
  small: "h-16",
  medium: "h-24",
  large: "h-32",
};

const statusConfig = {
  available: {
    bg: "bg-success/8 hover:bg-success/15 border-success/25",
    icon: Unlock,
    iconColor: "text-success",
    glow: "hover:shadow-[0_0_20px_-4px_hsl(var(--success)/0.3)]",
  },
  occupied: {
    bg: "bg-primary/8 border-primary/25",
    icon: Lock,
    iconColor: "text-primary",
    glow: "",
  },
  maintenance: {
    bg: "bg-accent/8 border-accent/25",
    icon: Wrench,
    iconColor: "text-accent",
    glow: "",
  },
  reserved: {
    bg: "bg-secondary/8 border-secondary/25",
    icon: User,
    iconColor: "text-secondary",
    glow: "",
  },
};

export default function LockerDoor({ door, index, onSelect, isCurrentUser }: LockerDoorProps) {
  const config = statusConfig[door.status];
  const Icon = config.icon;
  const isClickable = door.status === "available" || isCurrentUser;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      onClick={() => isClickable && onSelect?.(door)}
      disabled={!isClickable}
      className={cn(
        "relative w-full rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1.5 group",
        sizeMap[door.size],
        config.bg,
        config.glow,
        isClickable ? "cursor-pointer" : "cursor-default opacity-80",
        isCurrentUser && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
      )}
    >
      {/* Door handle */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-foreground/10" />
      
      {/* Vent lines */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-0.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-3 h-px bg-foreground/8" />
        ))}
      </div>

      <Icon className={cn("h-4 w-4 transition-transform duration-200", config.iconColor, isClickable && "group-hover:scale-110")} />
      <span className="text-[10px] font-bold text-foreground/70 font-mono">
        {door.label || `#${door.door_number}`}
      </span>
    </motion.button>
  );
}
