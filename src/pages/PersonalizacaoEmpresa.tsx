import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Palette, Image, Type, Save, RotateCcw, Upload, X } from "lucide-react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { supabase } from "@/lib/supabase-compat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const COLOR_FIELDS = [
  { key: "primary", label: "Primária" },
  { key: "primary_glow", label: "Primária (Brilho)" },
  { key: "secondary", label: "Secundária" },
  { key: "accent", label: "Destaque" },
  { key: "sidebar_bg", label: "Fundo da Sidebar" },
];

const IMAGE_FIELDS = [
  { key: "logo_url", label: "Logo Principal", desc: "Exibido na sidebar e cabeçalho" },
  { key: "sidebar_logo_url", label: "Logo da Sidebar", desc: "Logo específico para o menu lateral" },
  { key: "favicon_url", label: "Favicon", desc: "Ícone exibido na aba do navegador" },
  { key: "login_bg_url", label: "Imagem de Fundo (Login)", desc: "Imagem decorativa na tela de login" },
];

function hslStringToHex(hsl: string): string {
  if (!hsl) return "#888888";
  const parts = hsl.split(" ").map(parseFloat);
  if (parts.length < 3) return "#888888";
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

interface BrandingData {
  logo_url: string;
  sidebar_logo_url: string;
  favicon_url: string;
  login_bg_url: string;
  platform_name: string;
  login_title: string;
  login_subtitle: string;
  theme_colors: Record<string, string>;
}

const defaultBranding: BrandingData = {
  logo_url: "",
  sidebar_logo_url: "",
  favicon_url: "",
  login_bg_url: "",
  platform_name: "",
  login_title: "",
  login_subtitle: "",
  theme_colors: {},
};

export default function PersonalizacaoEmpresa() {
  const { user } = useAuth();
  const { selectedCompany, isSuperAdmin, hasPermission } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [branding, setBranding] = useState<BrandingData>(defaultBranding);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  const companyId = isSuperAdmin ? selectedCompany?.id : userCompanyId;

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("role, company_id").eq("user_id", user.id).single().then(({ data }) => {
      setUserRole(data?.role || null);
      setUserCompanyId(data?.company_id || null);
    });
  }, [user]);

  // Check access
  useEffect(() => {
    if (userRole === null) return;
    if (userRole !== "superadmin" && userRole !== "admin") {
      navigate("/");
    }
  }, [userRole]);

  // Load existing branding
  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("company_branding")
        .select("*")
        .eq("company_id", companyId)
        .single();

      if (data) {
        setBranding({
          logo_url: (data as any).logo_url || "",
          sidebar_logo_url: (data as any).sidebar_logo_url || "",
          favicon_url: (data as any).favicon_url || "",
          login_bg_url: (data as any).login_bg_url || "",
          platform_name: (data as any).platform_name || "",
          login_title: (data as any).login_title || "",
          login_subtitle: (data as any).login_subtitle || "",
          theme_colors: ((data as any).theme_colors as Record<string, string>) || {},
        });
      } else {
        setBranding(defaultBranding);
      }
      setLoading(false);
    };
    load();
  }, [companyId]);

  const handleImageUpload = async (field: string, file: File) => {
    if (!companyId) return;
    setUploading(field);
    const ext = file.name.split(".").pop();
    const path = `company-branding/${companyId}/${field}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("platform-assets").upload(path, file);
    if (error) {
      toast({ title: "Erro no upload", description: error.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { data: urlData } = supabase.storage.from("platform-assets").getPublicUrl(path);
    setBranding((prev) => ({ ...prev, [field]: urlData.publicUrl }));
    setUploading(null);
  };

  const handleColorChange = (key: string, hex: string) => {
    setBranding((prev) => ({
      ...prev,
      theme_colors: { ...prev.theme_colors, [key]: hexToHslString(hex) },
    }));
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);

    const payload = {
      company_id: companyId,
      logo_url: branding.logo_url,
      sidebar_logo_url: branding.sidebar_logo_url,
      favicon_url: branding.favicon_url,
      login_bg_url: branding.login_bg_url,
      platform_name: branding.platform_name,
      login_title: branding.login_title,
      login_subtitle: branding.login_subtitle,
      theme_colors: branding.theme_colors,
    };

    const { error } = await supabase
      .from("company_branding")
      .upsert(payload as any, { onConflict: "company_id" });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: "Personalização da empresa atualizada." });
    }
    setSaving(false);
  };

  const handleReset = () => setBranding(defaultBranding);

  const canEdit = hasPermission("white_label");
  const companyName = isSuperAdmin ? selectedCompany?.name : "Sua Empresa";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Palette className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">Selecione uma empresa</p>
        <p className="text-sm">Escolha uma empresa na sidebar para configurar seu white label.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Palette className="h-12 w-12 mb-4 opacity-40" />
        <p className="text-lg font-medium">White Label não habilitado</p>
        <p className="text-sm">A permissão de white label não está ativa para esta empresa.</p>
        {isSuperAdmin && (
          <p className="text-xs mt-2">Habilite a permissão "white_label" na página de Empresas.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            White Label — {companyName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalize logotipos, cores e textos exclusivos para esta empresa.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Resetar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2 gradient-primary border-0 hover:opacity-90">
            <Save className="h-3.5 w-3.5" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="imagens" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="imagens" className="gap-1.5 text-xs"><Image className="h-3.5 w-3.5" /> Imagens</TabsTrigger>
          <TabsTrigger value="textos" className="gap-1.5 text-xs"><Type className="h-3.5 w-3.5" /> Textos</TabsTrigger>
          <TabsTrigger value="cores" className="gap-1.5 text-xs"><Palette className="h-3.5 w-3.5" /> Cores</TabsTrigger>
        </TabsList>

        {/* IMAGES TAB */}
        <TabsContent value="imagens" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Logotipos e Imagens</CardTitle>
              <CardDescription>Upload de logos e imagens exclusivas da empresa. Campos vazios herdam as configurações globais.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {IMAGE_FIELDS.map(({ key, label, desc }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs font-medium">{label}</Label>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                    {(branding as any)[key] ? (
                      <div className="relative group">
                        <img
                          src={(branding as any)[key]}
                          alt={label}
                          className="h-20 w-auto rounded-lg border border-border object-contain bg-muted/30 p-2"
                        />
                        <button
                          onClick={() => setBranding((prev) => ({ ...prev, [key]: "" }))}
                          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors">
                        {uploading === key ? (
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <Upload className="h-4 w-4" />
                            Upload
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(key, f);
                          }}
                        />
                      </label>
                    )}
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
              <CardTitle className="text-base">Textos Personalizados</CardTitle>
              <CardDescription>Campos vazios herdam as configurações globais da plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Nome da Plataforma</Label>
                <Input
                  value={branding.platform_name}
                  onChange={(e) => setBranding((p) => ({ ...p, platform_name: e.target.value }))}
                  placeholder="Herdar do global"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Título da Tela de Login</Label>
                <Input
                  value={branding.login_title}
                  onChange={(e) => setBranding((p) => ({ ...p, login_title: e.target.value }))}
                  placeholder="Herdar do global"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Subtítulo da Tela de Login</Label>
                <Textarea
                  value={branding.login_subtitle}
                  onChange={(e) => setBranding((p) => ({ ...p, login_subtitle: e.target.value }))}
                  placeholder="Herdar do global"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COLORS TAB */}
        <TabsContent value="cores" className="space-y-4">
          <Card className="shadow-card border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Cores da Empresa</CardTitle>
              <CardDescription>Defina cores exclusivas. Cores não definidas herdam as globais.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-2">
                    <Label className="text-xs font-medium">{label}</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={hslStringToHex(branding.theme_colors[key] || "")}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                      />
                      <div className="flex-1">
                        <div
                          className="h-10 rounded-lg border border-border"
                          style={{ backgroundColor: branding.theme_colors[key] ? `hsl(${branding.theme_colors[key]})` : "transparent" }}
                        />
                      </div>
                      {branding.theme_colors[key] && (
                        <button
                          onClick={() => {
                            const newColors = { ...branding.theme_colors };
                            delete newColors[key];
                            setBranding((prev) => ({ ...prev, theme_colors: newColors }));
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 transition-colors"
                          title="Remover (herdar global)"
                        >
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {branding.theme_colors[key] || "Herdando global"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
