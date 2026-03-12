/**
 * Compatibility layer that mimics Supabase client API but routes through Express backend.
 * Minimizes refactoring needed across 36+ files.
 * 
 * Usage: Replace `import { supabase } from "@/integrations/supabase/client"`
 * with    `import { supabase } from "@/lib/supabase-compat"`
 */
import api from "@/lib/api";

interface QueryResult<T = any> {
  data: T | null;
  error: { message: string } | null;
  count?: number | null;
}

class QueryBuilder {
  private table: string;
  private params: Record<string, any> = {};
  private method: "GET" | "POST" | "PUT" | "DELETE" = "GET";
  private body: any = null;
  private selectFields: string = "*";
  private isSingle = false;
  private isMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = "*", _options?: { count?: string; head?: boolean }) {
    this.method = "GET";
    this.selectFields = fields;
    return this;
  }

  insert(data: any) {
    this.method = "POST";
    this.body = data;
    return this;
  }

  update(data: any) {
    this.method = "PUT";
    this.body = data;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  upsert(data: any, _options?: { onConflict?: string }) {
    this.method = "PUT";
    this.body = { ...data, _upsert: true };
    return this;
  }

  eq(column: string, value: any) {
    this.params[column] = value;
    return this;
  }

  neq(column: string, value: any) {
    this.params[`${column}__neq`] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.params[`${column}__in`] = values.join(",");
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.params[`${column}__not_${operator}`] = value;
    return this;
  }

  is(column: string, value: any) {
    this.params[`${column}__is`] = value;
    return this;
  }

  gte(column: string, value: any) {
    this.params[`${column}__gte`] = value;
    return this;
  }

  lte(column: string, value: any) {
    this.params[`${column}__lte`] = value;
    return this;
  }

  gt(column: string, value: any) {
    this.params[`${column}__gt`] = value;
    return this;
  }

  lt(column: string, value: any) {
    this.params[`${column}__lt`] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.params._order = column;
    this.params._asc = options?.ascending !== false ? "true" : "false";
    return this;
  }

  limit(count: number) {
    this.params._limit = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async then(resolve: (result: QueryResult) => void, reject?: (error: any) => void): Promise<void> {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else resolve({ data: null, error: { message: (err as any).message || "Unknown error" } });
    }
  }

  async execute(): Promise<QueryResult> {
    try {
      let result: any;

      const endpoint = `/compat/${this.table}`;

      switch (this.method) {
        case "GET": {
          const { data } = await api.get(endpoint, {
            params: { ...this.params, _fields: this.selectFields },
          });
          if (this.isSingle) {
            const item = Array.isArray(data) ? data[0] : data;
            if (!item) return { data: null, error: { message: "No rows found" } };
            return { data: item, error: null };
          }
          if (this.isMaybeSingle) {
            const item = Array.isArray(data) ? data[0] || null : data;
            return { data: item, error: null };
          }
          return { data, error: null };
        }
        case "POST": {
          const { data } = await api.post(endpoint, {
            data: this.body,
            params: this.params,
          });
          result = data;
          if (this.isSingle) {
            return { data: Array.isArray(result) ? result[0] : result, error: null };
          }
          return { data: result, error: null };
        }
        case "PUT": {
          const { data } = await api.put(endpoint, {
            data: this.body,
            params: this.params,
          });
          result = data;
          if (this.isSingle) {
            return { data: Array.isArray(result) ? result[0] : result, error: null };
          }
          return { data: result, error: null };
        }
        case "DELETE": {
          const { data } = await api.delete(endpoint, { params: this.params });
          return { data, error: null };
        }
        default:
          return { data: null, error: { message: "Invalid method" } };
      }
    } catch (err: any) {
      return {
        data: null,
        error: { message: err.message || err.response?.data?.error || "Request failed" },
      };
    }
  }
}

class CompatFunctions {
  async invoke(functionName: string, options?: { body?: any }) {
    try {
      const { data } = await api.post(`/functions/${functionName}`, options?.body);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || "Function invocation failed" } };
    }
  }
}

class CompatAuth {
  async getSession() {
    const token = localStorage.getItem("auth_token");
    if (!token) return { data: { session: null }, error: null };
    return {
      data: {
        session: {
          access_token: token,
          user: null,
        },
      },
      error: null as any,
    };
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      const { data } = await api.post("/auth/login", credentials);
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      return { data: { user: data.user, session: { access_token: data.token } }, error: null };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Login failed";
      return { data: { user: null, session: null }, error: { message: msg } };
    }
  }

  async signUp(params: { email: string; password: string; options?: { data?: any; emailRedirectTo?: string } }) {
    try {
      const { data } = await api.post("/auth/register", {
        email: params.email,
        password: params.password,
        full_name: params.options?.data?.full_name,
      });
      return { data: { user: data.user, session: null }, error: null };
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Signup failed";
      return { data: { user: null, session: null }, error: { message: msg } };
    }
  }

  async resetPasswordForEmail(email: string, _options?: { redirectTo?: string }) {
    try {
      await api.post("/auth/forgot-password", { email });
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.response?.data?.error || err.message } };
    }
  }

  async getUser() {
    try {
      const { data } = await api.get("/auth/me");
      return { data: { user: data.user }, error: null };
    } catch {
      return { data: { user: null }, error: { message: "Not authenticated" } };
    }
  }

  async signOut() {
    localStorage.removeItem("auth_token");
    window.location.href = "/auth";
  }

  async updateUser(updates: { password?: string; data?: any }) {
    try {
      if (updates.password) {
        await api.post("/auth/change-password", {
          new_password: updates.password,
        });
      }
      return { data: { user: null }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  onAuthStateChange(_callback: (event: string, session: any) => void) {
    // No-op in Express mode - auth state is managed by ContextoAutenticacao
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
}

class CompatStorage {
  from(bucket: string) {
    return {
      upload: async (path: string, file: File, _options?: { upsert?: boolean }) => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("path", path);
          const { data } = await api.post(`/upload/${bucket}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return { data: { path: data.url }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      getPublicUrl: (path: string) => {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
        const baseUrl = apiUrl.replace("/api", "");
        return { data: { publicUrl: `${baseUrl}/uploads/${bucket}/${path}` } };
      },
    };
  }
}

class CompatRpc {
  async call(fnName: string, params: Record<string, any>): Promise<QueryResult> {
    try {
      const { data } = await api.post(`/rpc/${fnName}`, params);
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

class SupabaseCompat {
  auth = new CompatAuth();
  storage = new CompatStorage();
  functions = new CompatFunctions();
  private rpcHandler = new CompatRpc();

  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }

  rpc(fnName: string, params?: Record<string, any>) {
    return this.rpcHandler.call(fnName, params || {});
  }

  channel(_name: string) {
    const self = {
      on: (..._args: any[]) => self,
      subscribe: () => self,
      unsubscribe: () => {},
    };
    return self;
  }

  removeChannel(_channel: any) {
    // No-op
  }
}

export const supabase = new SupabaseCompat();
