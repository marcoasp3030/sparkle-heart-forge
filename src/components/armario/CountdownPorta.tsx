import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CountdownPortaProps {
  expiresAt: string;
  size?: "sm" | "md";
}

function getTimeRemaining(expiresAt: string) {
  const now = Date.now();
  const end = new Date(expiresAt).getTime();
  const diff = Math.max(0, end - now);
  return {
    total: diff,
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function getUrgencyLevel(totalMs: number, totalDurationMs: number) {
  const ratio = totalDurationMs > 0 ? totalMs / totalDurationMs : 0;
  if (ratio <= 0) return "expired";
  if (ratio <= 0.15) return "critical";  // <15% remaining
  if (ratio <= 0.35) return "warning";   // <35% remaining
  return "safe";
}

const urgencyColors = {
  safe: { stroke: "stroke-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" },
  warning: { stroke: "stroke-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" },
  critical: { stroke: "stroke-rose-500", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500" },
  expired: { stroke: "stroke-rose-600", text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-600" },
};

export function useCountdown(expiresAt: string | null | undefined) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? getTimeRemaining(expiresAt) : { total: 0, hours: 0, minutes: 0, seconds: 0 }
  );

  useEffect(() => {
    if (!expiresAt) return;
    setRemaining(getTimeRemaining(expiresAt));
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

export function useUrgencyLevel(expiresAt: string | null | undefined, createdAt?: string | null) {
  const remaining = useCountdown(expiresAt);
  
  const totalDuration = useMemo(() => {
    if (!expiresAt) return 0;
    const start = createdAt ? new Date(createdAt).getTime() : Date.now() - remaining.total;
    return new Date(expiresAt).getTime() - start;
  }, [expiresAt, createdAt, remaining.total]);

  return {
    remaining,
    urgency: expiresAt ? getUrgencyLevel(remaining.total, totalDuration) : "safe" as const,
    progress: totalDuration > 0 ? Math.max(0, Math.min(100, (remaining.total / totalDuration) * 100)) : 0,
  };
}

/** Mini circular countdown for the locker door */
export default function CountdownPorta({ expiresAt, size = "sm" }: CountdownPortaProps) {
  const { remaining, urgency, progress } = useUrgencyLevel(expiresAt);
  const colors = urgencyColors[urgency];
  
  const dim = size === "sm" ? 28 : 36;
  const strokeWidth = size === "sm" ? 2.5 : 3;
  const radius = (dim - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress / 100);

  const timeLabel = urgency === "expired"
    ? "!"
    : remaining.hours > 0
      ? `${remaining.hours}h`
      : remaining.minutes > 0
        ? `${remaining.minutes}m`
        : `${remaining.seconds}s`;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative flex items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      {/* Background ring */}
      <svg width={dim} height={dim} className="absolute -rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-foreground/[0.06]"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={dim / 2}
          cy={dim / 2}
          r={radius}
          fill="none"
          className={cn(colors.stroke, "transition-colors duration-500")}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </svg>
      {/* Time label */}
      <motion.span
        key={timeLabel}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "font-mono font-bold leading-none",
          colors.text,
          size === "sm" ? "text-[7px]" : "text-[9px]",
          urgency === "critical" && "animate-pulse"
        )}
      >
        {timeLabel}
      </motion.span>
    </motion.div>
  );
}
