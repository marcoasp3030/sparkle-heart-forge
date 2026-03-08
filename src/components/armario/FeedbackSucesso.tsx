import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type FeedbackType = "reserve" | "release" | "maintenance" | "renew" | "schedule";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  distance: number;
  rotation: number;
  delay: number;
  shape: "circle" | "square" | "star";
}

const feedbackConfig: Record<FeedbackType, { colors: string[]; icon: string; label: string }> = {
  reserve: {
    colors: ["#10b981", "#34d399", "#6ee7b7", "#059669", "#a7f3d0"],
    icon: "🔒",
    label: "Reservado!",
  },
  release: {
    colors: ["#3b82f6", "#60a5fa", "#93c5fd", "#2563eb", "#bfdbfe"],
    icon: "🔓",
    label: "Liberado!",
  },
  maintenance: {
    colors: ["#f59e0b", "#fbbf24", "#fde68a", "#d97706", "#fef3c7"],
    icon: "🔧",
    label: "Manutenção",
  },
  renew: {
    colors: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed", "#ddd6fe"],
    icon: "🔄",
    label: "Renovado!",
  },
  schedule: {
    colors: ["#06b6d4", "#22d3ee", "#67e8f9", "#0891b2", "#a5f3fc"],
    icon: "📅",
    label: "Agendado!",
  },
};

function generateParticles(count: number, colors: string[]): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 0,
    y: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: 4 + Math.random() * 6,
    angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
    distance: 60 + Math.random() * 80,
    rotation: Math.random() * 720 - 360,
    delay: Math.random() * 0.15,
    shape: (["circle", "square", "star"] as const)[Math.floor(Math.random() * 3)],
  }));
}

function ParticleShape({ shape, size, color }: { shape: string; size: number; color: string }) {
  if (shape === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 10 10">
        <polygon points="5,0 6.5,3.5 10,4 7.5,6.5 8,10 5,8 2,10 2.5,6.5 0,4 3.5,3.5" fill={color} />
      </svg>
    );
  }
  if (shape === "square") {
    return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: 2 }} />;
  }
  return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: "50%" }} />;
}

export function useFeedbackSucesso() {
  const [active, setActive] = useState<{ type: FeedbackType; particles: Particle[] } | null>(null);

  const trigger = useCallback((type: FeedbackType) => {
    const config = feedbackConfig[type];
    const particles = generateParticles(24, config.colors);
    setActive({ type, particles });
    setTimeout(() => setActive(null), 1800);
  }, []);

  return { active, trigger };
}

interface FeedbackSucessoOverlayProps {
  active: { type: FeedbackType; particles: Particle[] } | null;
}

export default function FeedbackSucessoOverlay({ active }: FeedbackSucessoOverlayProps) {
  if (!active) return null;
  const config = feedbackConfig[active.type];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
        {/* Center burst icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          className="absolute flex flex-col items-center gap-2"
        >
          <motion.span
            className="text-5xl drop-shadow-lg"
            animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {config.icon}
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg font-extrabold text-foreground bg-background/80 backdrop-blur-sm px-4 py-1 rounded-full shadow-elevated border border-border/50"
          >
            {config.label}
          </motion.span>
        </motion.div>

        {/* Particles */}
        {active.particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(p.angle) * p.distance,
              y: Math.sin(p.angle) * p.distance,
              scale: 0,
              opacity: 0,
              rotate: p.rotation,
            }}
            transition={{
              duration: 0.8 + Math.random() * 0.4,
              delay: p.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className="absolute"
          >
            <ParticleShape shape={p.shape} size={p.size} color={p.color} />
          </motion.div>
        ))}

        {/* Ring burst */}
        <motion.div
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute w-16 h-16 rounded-full border-2"
          style={{ borderColor: config.colors[0] }}
        />
        <motion.div
          initial={{ scale: 0, opacity: 0.4 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
          className="absolute w-12 h-12 rounded-full border"
          style={{ borderColor: config.colors[2] }}
        />
      </div>
    </AnimatePresence>
  );
}
