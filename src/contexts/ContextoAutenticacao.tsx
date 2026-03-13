import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import api, { post, get } from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: string | null;
  company_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  password_changed: boolean;
  created_at?: string;
  last_sign_in_at?: string;
  /** Compatibilidade com código que usa user.user_metadata.full_name */
  user_metadata?: { full_name?: string };
}

interface Session {
  token: string;
  user: User;
  expires_at?: number;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string; lockout?: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  changePassword: async () => ({}),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  /** Adiciona user_metadata para compatibilidade com código existente */
  const enrichUser = (u: User): User => ({
    ...u,
    user_metadata: { full_name: u.full_name || "" },
  });

  const maskEmail = (rawEmail: string) => {
    const [name, domain] = rawEmail.split("@");
    if (!name || !domain) return rawEmail;
    const visible = name.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
  };

  // Ao iniciar, verifica se há token salvo e busca dados do usuário
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    get<{ user: User }>("/auth/me")
      .then((data) => {
        const u = enrichUser(data.user);
        setSession({ token, user: u });
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.toLowerCase().trim();
    const attemptId = `login_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const t0 = performance.now();

    console.groupCollapsed(`[AUTH][${attemptId}] Login ${maskEmail(normalizedEmail)}`);
    console.log("[AUTH] Payload", {
      email: normalizedEmail,
      passwordLength: password.length,
    });

    try {
      const response = await api.post<{ token?: string; user?: User }>("/auth/login", {
        email: normalizedEmail,
        password,
      });

      const data = response.data;
      const elapsed = Math.round(performance.now() - t0);

      console.log("[AUTH] Resposta /auth/login", {
        status: response.status,
        hasToken: Boolean(data?.token),
        hasUser: Boolean(data?.user),
        keys: data ? Object.keys(data) : [],
        elapsedMs: elapsed,
      });

      if (!data?.token) {
        console.error("[AUTH] Resposta inválida: token ausente", data);
        return { error: "Resposta inválida do servidor (token ausente)" };
      }

      localStorage.setItem("auth_token", data.token);

      let resolvedUser = data.user;
      if (!resolvedUser) {
        console.warn("[AUTH] user ausente no login, tentando fallback /auth/me");
        try {
          const me = await get<{ user: User }>("/auth/me");
          resolvedUser = me?.user;
          console.log("[AUTH] Fallback /auth/me", { hasUser: Boolean(resolvedUser) });
        } catch (fallbackErr: any) {
          console.error("[AUTH] Falha no fallback /auth/me", fallbackErr);
        }
      }

      if (!resolvedUser) {
        localStorage.removeItem("auth_token");
        console.error("[AUTH] Não foi possível resolver usuário após login", data);
        return { error: "Login recebido, mas sem dados de usuário" };
      }

      const u = enrichUser(resolvedUser);
      setSession({ token: data.token, user: u });

      console.log("[AUTH] Sessão criada", {
        userId: u.id,
        role: u.role,
        companyId: u.company_id,
        elapsedMs: Math.round(performance.now() - t0),
      });

      return {};
    } catch (err: any) {
      const lockout = err.original?.response?.data?.lockout || null;
      console.error("[AUTH] Erro no login", {
        message: err.message,
        status: err.status,
        lockout,
        response: err.original?.response?.data || null,
        elapsedMs: Math.round(performance.now() - t0),
      });

      return {
        error: err.message || "Erro ao fazer login",
        lockout,
      };
    } finally {
      console.groupEnd();
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      await post("/auth/register", {
        email,
        password,
        full_name: fullName,
      });
      return {};
    } catch (err: any) {
      return { error: err.message || "Erro ao criar conta" };
    }
  };

  const signOut = async () => {
    localStorage.removeItem("auth_token");
    setSession(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      await post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return {};
    } catch (err: any) {
      return { error: err.message || "Erro ao alterar senha" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
