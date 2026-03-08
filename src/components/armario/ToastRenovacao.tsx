import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCountdown } from "./CountdownPorta";

interface RenewalToastProps {
  doorId: string;
  doorLabel: string;
  expiresAt: string;
  onRenew: (doorId: string, hours: number) => Promise<void>;
  onDismiss: () => void;
}

export default function ToastRenovacao({ doorId, doorLabel, expiresAt, onRenew, onDismiss }: RenewalToastProps) {
  const remaining = useCountdown(expiresAt);
  const [renewing, setRenewing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedHours, setSelectedHours] = useState(2);

  const handleRenew = useCallback(async () => {
    setRenewing(true);
    try {
      await onRenew(doorId, selectedHours);
      setSuccess(true);
      setTimeout(onDismiss, 2000);
    } catch {
      setRenewing(false);
    }
  }, [doorId, selectedHours, onRenew, onDismiss]);

  const timeLabel = remaining.hours > 0
    ? `${remaining.hours}h ${remaining.minutes}m`
    : remaining.minutes > 0
      ? `${remaining.minutes}m ${remaining.seconds}s`
      : `${remaining.seconds}s`;

  const isUrgent = remaining.total < 30 * 60 * 1000; // < 30min

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "fixed bottom-6 right-6 z-[100] w-80 rounded-2xl border shadow-elevated overflow-hidden",
        "bg-card/95 backdrop-blur-xl border-border/50",
        isUrgent && "border-destructive/30"
      )}
    >
      {/* Progress bar at top */}
      <motion.div
        className={cn(
          "h-1 rounded-full",
          isUrgent ? "bg-destructive" : "bg-primary"
        )}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: remaining.total / 1000, ease: "linear" }}
      />

      <div className="p-4 space-y-3">
        {success ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-3"
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center"
            >
              <RefreshCw className="h-5 w-5 text-success" />
            </motion.div>
            <div>
              <p className="text-sm font-bold text-foreground">Renovado!</p>
              <p className="text-xs text-muted-foreground">Reserva estendida com sucesso.</p>
            </div>
          </motion.div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <motion.div
                  animate={isUrgent ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center",
                    isUrgent ? "bg-destructive/10" : "bg-primary/10"
                  )}
                >
                  <Clock className={cn("h-4.5 w-4.5", isUrgent ? "text-destructive" : "text-primary")} />
                </motion.div>
                <div>
                  <p className="text-sm font-bold text-foreground">{doorLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira em <span className={cn("font-mono font-semibold", isUrgent ? "text-destructive" : "text-primary")}>{timeLabel}</span>
                  </p>
                </div>
              </div>
              <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>

            {/* Quick renew buttons */}
            <div className="flex gap-1.5">
              {[1, 2, 4].map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHours(h)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                    selectedHours === h
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  )}
                >
                  +{h}h
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={handleRenew}
              disabled={renewing}
              className="w-full gap-1.5 rounded-xl gradient-primary border-0 text-primary-foreground hover:opacity-90 shadow-md shadow-primary/20"
            >
              <motion.div animate={renewing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <RefreshCw className="h-3.5 w-3.5" />
              </motion.div>
              {renewing ? "Renovando..." : `Renovar por ${selectedHours}h`}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
