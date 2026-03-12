import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import lockerLogo from "@/assets/locker-logo.png";

const RedefinirSenha = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setError("Link de redefinição inválido. Solicite um novo link na página de login.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
      toast({ title: data.message || "Senha redefinida com sucesso!" });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Erro ao redefinir senha";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="flex justify-center mb-8">
          <img src={lockerLogo} alt="Logo" className="h-12" />
        </div>

        {success ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground">
              Sua senha foi alterada com sucesso. Faça login com sua nova senha.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-11 font-semibold gradient-primary border-0 hover:opacity-90 transition-opacity"
            >
              Ir para o login
            </Button>
          </div>
        ) : error && !token ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Link inválido</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-11 font-semibold gradient-primary border-0 hover:opacity-90 transition-opacity"
            >
              Voltar ao login
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Crie uma nova senha para sua conta
              </p>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-9 pr-10 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    className="pl-9 h-11"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-semibold gradient-primary border-0 hover:opacity-90 transition-opacity"
                disabled={loading || !password || !confirmPassword || password !== confirmPassword}
              >
                {loading ? "Redefinindo..." : "Redefinir senha"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => navigate("/auth")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default RedefinirSenha;
