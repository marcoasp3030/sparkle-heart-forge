import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, User, Eye, EyeOff, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { verificarBloqueioLogin, registrarTentativaLogin, registrarAuditoria, type StatusBloqueio, type NivelAlerta } from "@/services/auditoria";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { usePlatform } from "@/contexts/ContextoPlataforma";
import lockerLogo from "@/assets/locker-logo.png";

interface LoginBranding {
  logo_url: string;
  login_bg_url: string;
  login_title: string;
  login_subtitle: string;
  theme_colors: Record<string, string>;
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLogin, setStatusLogin] = useState<StatusBloqueio | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings, effectiveSettings } = usePlatform();
  const [companyLogin, setCompanyLogin] = useState<LoginBranding | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Countdown timer for lockout
  useEffect(() => {
    if (segundosRestantes <= 0) return;
    const timer = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          setStatusLogin(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [segundosRestantes]);

  // Load company branding from ?company=ID query param
  useEffect(() => {
    const companyId = searchParams.get("company");
    if (!companyId) return;

    const loadCompanyBranding = async () => {
      // Check if company has white_label enabled
      const { data: perm } = await supabase
        .from("company_permissions")
        .select("enabled")
        .eq("company_id", companyId)
        .eq("permission", "white_label")
        .maybeSingle();

      if (!perm?.enabled) return;

      const { data } = await supabase
        .from("company_branding")
        .select("logo_url, login_bg_url, login_title, login_subtitle, theme_colors")
        .eq("company_id", companyId)
        .maybeSingle();

      if (data) {
        setCompanyLogin(data as unknown as LoginBranding);
      }
    };

    loadCompanyBranding();
  }, [searchParams]);

  // Resolve final values: company branding > effective > defaults
  const logoUrl = companyLogin?.logo_url || effectiveSettings.images.logo_url || lockerLogo;
  const loginBgUrl = companyLogin?.login_bg_url || effectiveSettings.images.login_bg_url;
  const loginTitle = companyLogin?.login_title || effectiveSettings.branding.login_title || "Gestão Inteligente de Armários";
  const loginSubtitle = companyLogin?.login_subtitle || effectiveSettings.branding.login_subtitle || "Controle, monitore e gerencie seus armários em tempo real.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusLogin(null);

    try {
      if (isLogin) {
        const status = await verificarBloqueioLogin(email);
        if (status.bloqueado) {
          setStatusLogin(status);
          setSegundosRestantes(status.segundosRestantes ?? 60);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          await registrarTentativaLogin(email, false);
          await registrarAuditoria({
            action: "login_failed",
            resource_type: "auth",
            details: { email, reason: error.message },
          });

          const updated = await verificarBloqueioLogin(email);
          setStatusLogin(updated);

          if (updated.bloqueado) {
            setSegundosRestantes(updated.segundosRestantes ?? 60);
          } else {
            toast({
              title: traduzirErro(error.message),
              description: updated.mensagem,
              variant: "destructive",
            });
          }
          return;
        }

        await registrarTentativaLogin(email, true);
        await registrarAuditoria({
          action: "login_success",
          resource_type: "auth",
          details: { email },
        });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "Conta criada com sucesso!",
          description: "Enviamos um link de confirmação para seu e-mail. Verifique sua caixa de entrada e spam.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: traduzirErro(error.message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  function traduzirErro(msg: string): string {
    if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos";
    if (msg.includes("Email not confirmed")) return "E-mail não confirmado. Verifique sua caixa de entrada.";
    if (msg.includes("User already registered")) return "Este e-mail já está cadastrado.";
    if (msg.includes("Password should be")) return "A senha deve ter pelo menos 6 caracteres.";
    if (msg.includes("rate limit")) return "Muitas requisições. Aguarde um momento.";
    return msg;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden items-center justify-center">
        {loginBgUrl && (
          <img src={loginBgUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-secondary blur-[100px]" />
        </div>
        <div className="relative z-10 text-center px-12">
          <img src={logoUrl} alt="Logo" className="h-16 mx-auto mb-8" />
          <h2 className="text-3xl font-bold text-sidebar-primary-foreground mb-3">
            {loginTitle}
          </h2>
          <p className="text-sidebar-foreground text-sm leading-relaxed max-w-md mx-auto">
            {loginSubtitle}
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          <div className="flex justify-center mb-8 lg:hidden">
            <img src={logoUrl} alt="Logo" className="h-12" />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              {isLogin ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {isLogin
                ? "Entre com suas credenciais para continuar"
                : "Preencha os dados para se cadastrar"}
            </p>
          </div>

          {statusLogin && statusLogin.totalFalhas > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col gap-2 p-3 rounded-lg border text-sm mb-2 ${
                statusLogin.nivel === "bloqueado"
                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                  : statusLogin.nivel === "perigo"
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400"
                  : statusLogin.nivel === "aviso"
                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                {statusLogin.nivel === "bloqueado" ? (
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                ) : statusLogin.nivel === "perigo" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                ) : (
                  <Info className="h-4 w-4 shrink-0" />
                )}
                <span>
                  {statusLogin.bloqueado && segundosRestantes > 0
                    ? `Conta bloqueada por segurança. Desbloqueio em ${segundosRestantes}s`
                    : statusLogin.mensagem}
                </span>
              </div>
              {statusLogin.bloqueado && segundosRestantes > 0 && (
                <Progress
                  value={(segundosRestantes / 60) * 100}
                  className="h-1.5"
                />
              )}
              {!statusLogin.bloqueado && statusLogin.tentativasRestantes <= 3 && (
                <Progress
                  value={(statusLogin.tentativasRestantes / 5) * 100}
                  className="h-1.5"
                />
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Nome completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="Seu nome"
                    className="pl-9 h-11"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-9 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-9 pr-10 h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold gradient-primary border-0 hover:opacity-90 transition-opacity" disabled={loading || segundosRestantes > 0 || (statusLogin?.bloqueado ?? false)}>
              {loading ? "Aguarde..." : segundosRestantes > 0 ? `Bloqueado (${segundosRestantes}s)` : isLogin ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin
                ? "Não tem uma conta? Cadastre-se"
                : "Já tem uma conta? Faça login"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
