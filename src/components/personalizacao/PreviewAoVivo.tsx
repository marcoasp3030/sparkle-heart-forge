import { usePlatform } from "@/contexts/ContextoPlataforma";

interface PreviewAoVivoProps {
  colors: Record<string, string>;
  branding: {
    platform_name: string;
    login_title: string;
    login_subtitle: string;
    sidebar_description: string;
  };
  images: {
    logo_url: string;
    favicon_url: string;
    login_bg_url: string;
    sidebar_logo_url: string;
  };
}

export default function PreviewAoVivo({ colors, branding, images }: PreviewAoVivoProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Sidebar Preview */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-2 uppercase tracking-wider">Sidebar</p>
        <div
          className="m-2 rounded-lg p-4 flex flex-col gap-3 min-h-[200px]"
          style={{ backgroundColor: `hsl(${colors.sidebar_bg})` }}
        >
          {images.sidebar_logo_url || images.logo_url ? (
            <img
              src={images.sidebar_logo_url || images.logo_url}
              alt="Logo"
              className="h-8 object-contain self-start"
            />
          ) : (
            <div className="h-8 w-24 rounded bg-white/10" />
          )}
          <span className="text-white/90 text-sm font-bold">{branding.platform_name || "Locker System"}</span>
          {branding.sidebar_description && (
            <span className="text-white/50 text-[10px]">{branding.sidebar_description}</span>
          )}
          <div className="mt-2 space-y-1.5">
            {["Painel", "Armários", "Pessoas", "Departamentos"].map((item, i) => (
              <div
                key={item}
                className="rounded-md px-3 py-1.5 text-xs text-white/70 flex items-center gap-2"
                style={i === 0 ? { backgroundColor: `hsl(${colors.primary} / 0.2)`, color: `hsl(${colors.primary_glow})` } : {}}
              >
                <div className="h-3 w-3 rounded-sm" style={i === 0 ? { backgroundColor: `hsl(${colors.primary})` } : { backgroundColor: "rgba(255,255,255,0.15)" }} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login Preview */}
      <div className="rounded-xl border border-border overflow-hidden shadow-sm">
        <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-2 uppercase tracking-wider">Tela de Login</p>
        <div className="m-2 rounded-lg overflow-hidden relative min-h-[200px] flex items-center justify-center bg-muted/30">
          {images.login_bg_url && (
            <img src={images.login_bg_url} alt="BG" className="absolute inset-0 w-full h-full object-cover opacity-20" />
          )}
          <div className="relative z-10 text-center space-y-2 p-4">
            {(images.logo_url || images.sidebar_logo_url) && (
              <img src={images.logo_url || images.sidebar_logo_url} alt="Logo" className="h-8 mx-auto mb-2 object-contain" />
            )}
            <h3 className="font-bold text-foreground text-sm">{branding.login_title || "Bem-vindo"}</h3>
            <p className="text-[10px] text-muted-foreground">{branding.login_subtitle || "Entre com suas credenciais"}</p>
            <div className="space-y-1.5 mt-3">
              <div className="h-7 rounded-md border border-border bg-background w-40 mx-auto" />
              <div className="h-7 rounded-md border border-border bg-background w-40 mx-auto" />
              <div
                className="h-7 rounded-md w-40 mx-auto text-[10px] font-semibold text-white flex items-center justify-center"
                style={{ backgroundColor: `hsl(${colors.primary})` }}
              >
                Entrar
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Colors Preview */}
      <div className="md:col-span-2 rounded-xl border border-border overflow-hidden shadow-sm">
        <p className="text-[10px] font-semibold text-muted-foreground px-3 pt-2 uppercase tracking-wider">Paleta de Cores</p>
        <div className="p-3 flex flex-wrap gap-2">
          {[
            { key: "primary", label: "Primária" },
            { key: "primary_glow", label: "Brilho" },
            { key: "secondary", label: "Secundária" },
            { key: "accent", label: "Destaque" },
            { key: "success", label: "Sucesso" },
            { key: "destructive", label: "Erro" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: `hsl(${colors[key]})` }} />
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
