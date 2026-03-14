import axios from "axios";

/**
 * Client HTTP configurado para comunicação com o backend Express.
 * Substitui o supabase client quando rodando em VPS própria.
 *
 * No .env.production do frontend, defina preferencialmente:
 *   VITE_API_URL=https://seudominio.com/api
 */
const resolveApiBaseUrl = () => {
  const rawBase = String(import.meta.env.VITE_API_URL || "").trim();
  if (!rawBase) return "/api";

  const normalized = rawBase.replace(/\/+$/, "");
  const hasApiSegment = /(^|\/)api(\/|$)/i.test(normalized);

  if (hasApiSegment) return normalized;

  const withApi = `${normalized}/api`;
  console.warn(`[API] VITE_API_URL sem '/api'. Ajustando automaticamente para: ${withApi}`);
  return withApi;
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================
// Interceptor de Request: injeta JWT automaticamente
// ============================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// Interceptor de Response: trata erros globais
// ============================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Token expirado ou inválido → redireciona para login
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // Evita loop de redirecionamento na página de auth
      if (currentPath !== "/auth") {
        localStorage.removeItem("auth_token");
        window.location.href = "/auth";
      }
    }

    // Extrai mensagem de erro do backend para uso nos componentes
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      "Erro de conexão com o servidor";

    // Preserva detalhes de validação (Zod)
    const details = error.response?.data?.details || null;

    return Promise.reject({
      message,
      details,
      status: error.response?.status || 0,
      original: error,
    });
  }
);

// ============================================
// Helpers tipados para uso nos componentes
// ============================================

/** GET com tipagem genérica */
export async function get<T = any>(url: string, params?: Record<string, any>): Promise<T> {
  const { data } = await api.get<T>(url, { params });
  return data;
}

/** POST com tipagem genérica */
export async function post<T = any>(url: string, body?: any): Promise<T> {
  const { data } = await api.post<T>(url, body);
  return data;
}

/** PUT com tipagem genérica */
export async function put<T = any>(url: string, body?: any): Promise<T> {
  const { data } = await api.put<T>(url, body);
  return data;
}

/** DELETE com tipagem genérica */
export async function del<T = any>(url: string): Promise<T> {
  const { data } = await api.delete<T>(url);
  return data;
}

/** Upload de arquivo (multipart/form-data) */
export async function upload<T = any>(
  bucket: string,
  file: File
): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post<T>(`/upload/${bucket}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// Export default para uso direto: import api from "@/lib/api"
export { api };
export default api;
