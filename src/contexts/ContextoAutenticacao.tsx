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
}

interface Session {
  token: string;
  user: User;
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

  // Ao iniciar, verifica se há token salvo e busca dados do usuário
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    get<{ user: User }>("/auth/me")
      .then((data) => {
        setSession({ token, user: data.user });
      })
      .catch(() => {
        localStorage.removeItem("auth_token");
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const data = await post<{ token: string; user: User }>("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("auth_token", data.token);
      setSession({ token: data.token, user: data.user });
      return {};
    } catch (err: any) {
      return {
        error: err.message || "Erro ao fazer login",
        lockout: err.original?.response?.data?.lockout || null,
      };
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
