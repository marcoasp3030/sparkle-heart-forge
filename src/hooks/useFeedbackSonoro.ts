import { useCallback, useRef } from "react";

type SoundType = "reserve" | "release" | "maintenance" | "renew" | "schedule";

// Frequencies and patterns for each action type
const soundPatterns: Record<SoundType, { notes: number[]; durations: number[]; type: OscillatorType; gain: number }> = {
  reserve: {
    notes: [523.25, 659.25, 783.99], // C5, E5, G5 - ascending major chord
    durations: [0.08, 0.08, 0.15],
    type: "sine",
    gain: 0.12,
  },
  release: {
    notes: [783.99, 659.25, 523.25], // G5, E5, C5 - descending
    durations: [0.08, 0.08, 0.15],
    type: "sine",
    gain: 0.1,
  },
  maintenance: {
    notes: [440, 466.16], // A4, Bb4 - alert tone
    durations: [0.12, 0.18],
    type: "triangle",
    gain: 0.08,
  },
  renew: {
    notes: [523.25, 587.33, 659.25, 783.99], // C5, D5, E5, G5 - upward scale
    durations: [0.06, 0.06, 0.06, 0.14],
    type: "sine",
    gain: 0.1,
  },
  schedule: {
    notes: [659.25, 783.99], // E5, G5 - gentle ding
    durations: [0.1, 0.16],
    type: "sine",
    gain: 0.09,
  },
};

export function useFeedbackSonoro() {
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback((type: SoundType) => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = ctxRef.current;
      const pattern = soundPatterns[type];
      let time = ctx.currentTime;

      pattern.notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = pattern.type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(pattern.gain, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + pattern.durations[i]);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + pattern.durations[i] + 0.01);
        time += pattern.durations[i] * 0.7; // slight overlap for smoothness
      });
    } catch {
      // Audio not supported, silently ignore
    }
  }, []);

  return { play };
}
