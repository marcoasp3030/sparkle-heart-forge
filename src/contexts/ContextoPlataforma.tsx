import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase-compat";

interface ThemeColors {
  primary: string;
  primary_glow: string;
  secondary: string;
  accent: string;
  success: string;
  destructive: string;
  sidebar_bg: string;
  preset: string;
}

interface Branding {
  platform_name: string;
  login_title: string;
  login_subtitle: string;
  sidebar_description: string;
}

interface Images {
  logo_url: string;
  favicon_url: string;
  login_bg_url: string;
  sidebar_logo_url: string;
}

export interface CompanyBranding {
  company_id: string;
  logo_url: string;
  sidebar_logo_url: string;
  favicon_url: string;
  login_bg_url: string;
  platform_name: string;
  login_title: string;
  login_subtitle: string;
  theme_colors: Partial<ThemeColors>;
}

interface PlatformSettings {
  theme_colors: ThemeColors;
  branding: Branding;
  images: Images;
}

interface PlatformContextType {
  settings: PlatformSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  companyBranding: CompanyBranding | null;
  setCompanyBranding: (branding: CompanyBranding | null) => void;
  effectiveSettings: PlatformSettings;
}

const defaultSettings: PlatformSettings = {
  theme_colors: {
    primary: "330 81% 46%",
    primary_glow: "330 90% 60%",
    secondary: "224 60% 48%",
    accent: "25 95% 53%",
    success: "152 60% 42%",
    destructive: "0 72% 51%",
    sidebar_bg: "222 47% 11%",
    preset: "default",
  },
  branding: {
    platform_name: "Locker System",
    login_title: "Bem-vindo de volta",
    login_subtitle: "Entre com suas credenciais para continuar",
    sidebar_description: "",
  },
  images: {
    logo_url: "",
    favicon_url: "",
    login_bg_url: "",
    sidebar_logo_url: "",
  },
};

const PlatformContext = createContext<PlatformContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
  companyBranding: null,
  setCompanyBranding: () => {},
  effectiveSettings: defaultSettings,
});

export const usePlatform = () => useContext(PlatformContext);

function applyThemeColors(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--primary-glow", colors.primary_glow);
  root.style.setProperty("--secondary", colors.secondary);
  root.style.setProperty("--accent", colors.accent);
  root.style.setProperty("--success", colors.success);
  root.style.setProperty("--destructive", colors.destructive);
  root.style.setProperty("--sidebar-background", colors.sidebar_bg);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);
  root.style.setProperty("--sidebar-primary", colors.primary);
}

function applyFavicon(url: string) {
  if (!url) return;
  let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
}

function mergeCompanyBranding(base: PlatformSettings, cb: CompanyBranding | null): PlatformSettings {
  if (!cb) return base;
  
  const merged = { ...base };
  
  // Override images if company has them
  merged.images = {
    logo_url: cb.logo_url || base.images.logo_url,
    sidebar_logo_url: cb.sidebar_logo_url || base.images.sidebar_logo_url,
    favicon_url: cb.favicon_url || base.images.favicon_url,
    login_bg_url: cb.login_bg_url || base.images.login_bg_url,
  };
  
  // Override branding texts if company has them
  merged.branding = {
    platform_name: cb.platform_name || base.branding.platform_name,
    login_title: cb.login_title || base.branding.login_title,
    login_subtitle: cb.login_subtitle || base.branding.login_subtitle,
    sidebar_description: base.branding.sidebar_description,
  };
  
  // Override theme colors if company has them
  if (cb.theme_colors && Object.keys(cb.theme_colors).length > 0) {
    merged.theme_colors = {
      ...base.theme_colors,
      ...cb.theme_colors,
      preset: "custom",
    };
  }
  
  return merged;
}

export const PlatformProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [companyBranding, setCompanyBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value");

      if (error || !data) {
        setLoading(false);
        return;
      }

      const merged = { ...defaultSettings };
      for (const row of data) {
        if (row.key === "theme_colors") merged.theme_colors = { ...defaultSettings.theme_colors, ...(row.value as any) };
        if (row.key === "branding") merged.branding = { ...defaultSettings.branding, ...(row.value as any) };
        if (row.key === "images") merged.images = { ...defaultSettings.images, ...(row.value as any) };
      }

      setSettings(merged);
    } catch {
      // silently use defaults
    } finally {
      setLoading(false);
    }
  };

  const effectiveSettings = mergeCompanyBranding(settings, companyBranding);

  // Apply theme whenever effective settings change
  useEffect(() => {
    applyThemeColors(effectiveSettings.theme_colors);
    applyFavicon(effectiveSettings.images.favicon_url);
  }, [effectiveSettings.theme_colors, effectiveSettings.images.favicon_url]);

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <PlatformContext.Provider value={{ settings, loading, refreshSettings: fetchSettings, companyBranding, setCompanyBranding, effectiveSettings }}>
      {children}
    </PlatformContext.Provider>
  );
};
