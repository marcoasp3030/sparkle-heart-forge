import { AlertTriangle, CheckCircle2 } from "lucide-react";

function hslToRgb(hslStr: string): [number, number, number] {
  const parts = hslStr.split(" ").map(parseFloat);
  if (parts.length < 3) return [0, 0, 0];
  const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const sRGB = [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function contrastRatio(hsl1: string, hsl2: string): number {
  const l1 = relativeLuminance(hslToRgb(hsl1));
  const l2 = relativeLuminance(hslToRgb(hsl2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface Props {
  colors: Record<string, string>;
}

const CHECKS = [
  { fg: "primary", bg: "sidebar_bg", label: "Primária sobre Sidebar" },
  { fg: "primary_glow", bg: "sidebar_bg", label: "Brilho sobre Sidebar" },
  { fg: "accent", bg: "sidebar_bg", label: "Destaque sobre Sidebar" },
];

export default function ValidacaoContraste({ colors }: Props) {
  const whiteOnPrimary = contrastRatio("0 0% 100%", colors.primary);
  const whiteOnDestructive = contrastRatio("0 0% 100%", colors.destructive);

  const results = [
    { label: "Texto branco sobre Primária", ratio: whiteOnPrimary },
    { label: "Texto branco sobre Erro", ratio: whiteOnDestructive },
    ...CHECKS.map((c) => ({
      label: c.label,
      ratio: contrastRatio(colors[c.fg], colors[c.bg]),
    })),
  ];

  return (
    <div className="space-y-2">
      {results.map(({ label, ratio }) => {
        const ok = ratio >= 3;
        const good = ratio >= 4.5;
        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            {good ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : ok ? (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className="text-muted-foreground flex-1">{label}</span>
            <span className={`font-mono font-semibold ${good ? "text-green-500" : ok ? "text-yellow-500" : "text-destructive"}`}>
              {ratio.toFixed(1)}:1
            </span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground mt-1">
        Mínimo recomendado: 3:1 (texto grande) / 4.5:1 (texto normal — WCAG AA)
      </p>
    </div>
  );
}
