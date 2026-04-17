import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Palette, Image, Type, Save, RotateCcw, Upload, X, Eye, History, FileJson, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { usePlatform } from "@/contexts/ContextoPlataforma";
import { supabase } from "@/lib/supabase-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PreviewAoVivo from "@/components/personalizacao/PreviewAoVivo";
import ValidacaoContraste from "@/components/personalizacao/ValidacaoContraste";
import HistoricoConfiguracoes from "@/components/personalizacao/HistoricoConfiguracoes";
import ExportarImportar from "@/components/personalizacao/ExportarImportar";

const COLOR_PRESETS: Record<string, Record<string, string>> = {
  default: {
    primary: "330 81% 46%",
    primary_glow: "330 90% 60%",
    secondary: "224 60% 48%",
    accent: "25 95% 53%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "222 47% 11%",
  },
  ocean: {
    primary: "199 89% 48%",
    primary_glow: "199 95% 60%",
    secondary: "210 60% 48%",
    accent: "160 84% 39%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "210 40% 12%",
  },
  forest: {
    primary: "142 71% 35%",
    primary_glow: "142 80% 48%",
    secondary: "160 60% 40%",
    accent: "38 92% 50%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "150 30% 10%",
  },
  sunset: {
    primary: "12 76% 52%",
    primary_glow: "25 90% 60%",
    secondary: "340 75% 55%",
    accent: "45 93% 47%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "15 30% 10%",
  },
  royal: {
    primary: "262 83% 58%",
    primary_glow: "270 90% 68%",
    secondary: "230 70% 55%",
    accent: "45 93% 47%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "260 30% 12%",
  },
};

function hslStringToHex(hsl: string): string {
  const parts = hsl.split(" ").map(parseFloat);
  if (parts.length < 3) return "#cf0989";
  const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
  const a2 = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a2 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const IMAGE_FIELDS = [
  { key: "logo_url", label: "Logo Principal", desc: "Exibido na sidebar e cabeçalho" },
  { key: "sidebar_logo_url", label: "Logo da Sidebar", desc: "Logo específico para o menu lateral" },
  { key: "favicon_url", label: "Favicon", desc: "Ícone exibido na aba do navegador" },
  { key: "login_bg_url", label: "Imagem de Fundo (Login)", desc: "Imagem decorativa na tela de login" },
];

const COLOR_FIELDS = [
  { key: "primary", label: "Primária" },
  { key: "primary_glow", label: "Primária (Brilho)" },
  { key: "secondary", label: "Secundária" },
  { key: "accent", label: "Destaque" },
  { key: "success", label: "Sucesso" },
  { key: "destructive", label: "Erro" },
  { key: "sidebar_bg", label: "Fundo da Sidebar" },
];

export default function Personalizacao() {
  const { user } = useAuth();
  const { settings, refreshSettings } = usePlatform();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const [colors, setColors] = useState(settings.theme_colors);
  const [branding, setBranding] = useState(settings.branding);
  const [images, setImages] = useState(settings.images);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("role").eq("user_id", user.id).single().then(({ data }) => {
      if (data?.role !== "superadmin") { navigate("/"); return; }
      setIsSuperAdmin(true);
    });
  }, [user]);

  useEffect(() => {
    setColors(settings.theme_colors);
    setBranding(settings.branding);
    setImages(settings.images);
  }, [settings]);

  // Apply colors in real-time as user changes them
  useEffect(() => {
    const root = document.documentElement;
    const c = colors as any;
    if (c.primary) root.style.setProperty("--primary", c.primary);
    if (c.primary_glow) root.style.setProperty("--primary-glow", c.primary_glow);
    if (c.secondary) root.style.setProperty("--secondary", c.secondary);
    if (c.accent) root.style.setProperty("--accent", c.accent);
    if (c.success) root.style.setProperty("--success", c.success);
    if (c.destructive) root.style.setProperty("--destructive", c.destructive);
    if (c.sidebar_bg) root.style.setProperty("--sidebar-background", c.sidebar_bg);
    if (c.primary) {
      root.style.setProperty("--ring", c.primary);
      root.style.setProperty("--sidebar-ring", c.primary);
      root.style.setProperty("--sidebar-primary", c.primary);
    }
    if (c.primary && c.primary_glow) {
      root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${c.primary}), hsl(${c.primary_glow}))`);
    }
    if (c.secondary) {
      root.style.setProperty("--gradient-secondary", `linear-gradient(135deg, hsl(${c.secondary}), hsl(${c.secondary}) / 0.8))`);
    }
  }, [colors]);

  // Live preview do favicon e título da aba
  useEffect(() => {
    if (images.favicon_url) {
      document
        .querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
        .forEach((el) => el.parentNode?.removeChild(el));
      const href = images.favicon_url.includes("?")
        ? `${images.favicon_url}&v=${Date.now()}`
        : `${images.favicon_url}?v=${Date.now()}`;
      ["icon", "shortcut icon", "apple-touch-icon"].forEach((rel) => {
        const link = document.createElement("link");
        link.rel = rel;
        link.href = href;
        document.head.appendChild(link);
      });
    }
  }, [images.favicon_url]);

  useEffect(() => {
    if (branding.platform_name?.trim()) {
      document.title = branding.platform_name.trim();
    }
  }, [branding.platform_name]);

  const handlePreset = (name: string) => {
    setColors({ ...COLOR_PRESETS[name], preset: name } as any);
  };

  const handleColorChange = (key: string, hex: string) => {
    setColors((prev) => ({ ...prev, [key]: hexToHslString(hex), preset: "custom" }));
  };

  const handleImageUpload = async (field: string, file: File) => {
    setUploading(field);
    const ext = file.name.split(".").pop();
    const path = `${field}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("platform-assets").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(path);
    setImages((prev) => ({ ...prev, [field]: urlData.publicUrl }));
    setUploading(null);
  };

  const handleSave = async () => {
    setSaving(true);

    // Save history of current settings before overwriting
    const { data: currentData } = await supabase.from("platform_settings").select("key, value");
    if (currentData) {
      for (const row of currentData) {
        await supabase.from("platform_settings_history").insert({
          setting_key: row.key,
          value: row.value as any,
          changed_by: user?.id,
        });
      }
    }

    const updates = [
      { key: "theme_colors", value: colors },
      { key: "branding", value: branding },
      { key: "images", value: images },
    ];

    let errors = 0;
    for (const u of updates) {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: u.key, value: u.value as any } as any, { onConflict: "key" });
      if (error) errors++;
    }

    if (errors > 0) {
      toast({ title: "Erro", description: "Algumas configurações não foram salvas.", variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: "Configurações da plataforma atualizadas." });
      await refreshSettings();
    }
    setSaving(false);
  };

  const handleImport = (data: { theme_colors?: any; branding?: any; images?: any }) => {
    if (data.theme_colors) setColors({ ...colors, ...data.theme_colors });
    if (data.branding) setBranding({ ...branding, ...data.branding });
    if (data.images) setImages({ ...images, ...data.images });
  };

  const handleRestoreHistory = (key: string, value: any) => {
    if (key === "theme_colors") setColors(value);
    if (key === "branding") setBranding(value);
    if (key === "images") setImages(value);
  };

  const handleReset = () => {
    handlePreset("default");
    setBranding(settings.branding);
    setImages(settings.images);
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            Personalização da Plataforma
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Configure cores, logotipos, textos e imagens do sistema.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportarImportar colors={colors as any} branding={branding as any} images={images as any} onImport={handleImport} />
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Resetar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 gradient-primary border-0 hover:opacity-90">
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="cores" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-6">
          <TabsTrigger value="cores" className="gap-1.5 text-xs"><Palette className="h-3.5 w-3.5" /> Cores</TabsTrigger>
          <TabsTrigger value="textos" className="gap-1.5 text-xs"><Type className="h-3.5 w-3.5" /> Textos</TabsTrigger>
          <TabsTrigger value="imagens" className="gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> Imagens</TabsTrigger>
          <TabsTrigger value="preview" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> Preview</TabsTrigger>
          <TabsTrigger value="contraste" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Contraste</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
        </TabsList>

        {/* COLORS TAB */}
        <TabsContent value="cores" className="space-y-4">
          {/* Presets */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Temas Predefinidos</CardTitle>
              <CardDescription>Escolha uma paleta pronta ou personalize abaixo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(COLOR_PRESETS).map(([name, preset]) => (
                  <button
                    key={name}
                    onClick={() => handlePreset(name)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all text-sm font-medium capitalize ${
                      colors.preset === name ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex -space-x-1">
                      {["primary", "secondary", "accent"].map((c) => (
                        <div
                          key={c}
                          className="h-4 w-4 rounded-full border-2 border-background"
                          style={{ backgroundColor: `hsl(${preset[c]})` }}
                        />
                      ))}
                    </div>
                    {name}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom colors */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Cores Customizadas</CardTitle>
              <CardDescription>Ajuste cada cor individualmente.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs font-medium">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={hslStringToHex((colors as any)[key])}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                      />
                      <div className="flex-1">
                        <div
                          className="h-10 rounded-lg border border-border"
                          style={{ backgroundColor: `hsl(${(colors as any)[key]})` }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">{(colors as any)[key]}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="px-4 py-2 rounded-lg text-white text-xs font-semibold"
                    style={{ backgroundColor: `hsl(${(colors as any)[key]})` }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TEXTS TAB */}
        <TabsContent value="textos" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Textos e Descrições</CardTitle>
              <CardDescription>Personalize os textos exibidos em diferentes áreas do sistema.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nome da Plataforma</Label>
                <Input
                  value={branding.platform_name}
                  onChange={(e) => setBranding((p) => ({ ...p, platform_name: e.target.value }))}
                  placeholder="Locker System"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Título da Tela de Login</Label>
                <Input
                  value={branding.login_title}
                  onChange={(e) => setBranding((p) => ({ ...p, login_title: e.target.value }))}
                  placeholder="Bem-vindo de volta"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Subtítulo da Tela de Login</Label>
                <Textarea
                  value={branding.login_subtitle}
                  onChange={(e) => setBranding((p) => ({ ...p, login_subtitle: e.target.value }))}
                  placeholder="Entre com suas credenciais para continuar"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Descrição na Sidebar</Label>
                <Textarea
                  value={branding.sidebar_description}
                  onChange={(e) => setBranding((p) => ({ ...p, sidebar_description: e.target.value }))}
                  placeholder="Texto exibido abaixo do logo na sidebar"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMAGES TAB */}
        <TabsContent value="imagens" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Logotipos e Imagens</CardTitle>
              <CardDescription>Faça upload de logos, favicon e imagens de fundo.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {IMAGE_FIELDS.map(({ key, label, desc }) => (
                  <ImageUploadField
                    key={key}
                    fieldKey={key}
                    label={label}
                    description={desc}
                    currentUrl={(images as any)[key]}
                    uploading={uploading === key}
                    onUpload={(file) => handleImageUpload(key, file)}
                    onClear={() => setImages((prev) => ({ ...prev, [key]: "" }))}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PREVIEW TAB */}
        <TabsContent value="preview" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview em Tempo Real</CardTitle>
              <CardDescription>Visualize como as alterações ficarão antes de salvar.</CardDescription>
            </CardHeader>
            <CardContent>
              <PreviewAoVivo colors={colors as any} branding={branding} images={images} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRAST TAB */}
        <TabsContent value="contraste" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Validação de Contraste</CardTitle>
              <CardDescription>Verifique se as combinações de cores atendem aos padrões de acessibilidade WCAG.</CardDescription>
            </CardHeader>
            <CardContent>
              <ValidacaoContraste colors={colors as any} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Histórico de Alterações</CardTitle>
              <CardDescription>Versões anteriores das configurações. Restaure qualquer versão e salve para aplicar.</CardDescription>
            </CardHeader>
            <CardContent>
              <HistoricoConfiguracoes onRestore={handleRestoreHistory} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ImageUploadField({
  fieldKey, label, description, currentUrl, uploading, onUpload, onClear,
}: {
  fieldKey: string; label: string; description: string; currentUrl: string;
  uploading: boolean; onUpload: (file: File) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <p className="text-[11px] text-muted-foreground">{description}</p>
      <div className="border-2 border-dashed border-border rounded-xl p-4 text-center relative">
        {currentUrl ? (
          <div className="relative inline-block">
            <img src={currentUrl} alt={label} className="max-h-20 object-contain mx-auto rounded" />
            <button
              onClick={onClear}
              className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="cursor-pointer py-4"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              {uploading ? "Enviando..." : "Clique para enviar"}
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}
