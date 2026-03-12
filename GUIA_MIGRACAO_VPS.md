# 🚀 Guia de Migração para VPS com PostgreSQL Próprio

## Índice

1. [Visão Geral da Arquitetura Atual](#1-visão-geral-da-arquitetura-atual)
2. [Pré-requisitos na VPS](#2-pré-requisitos-na-vps)
3. [Exportação do Código](#3-exportação-do-código)
4. [Migração do Banco de Dados](#4-migração-do-banco-de-dados)
5. [Refatoração da Autenticação](#5-refatoração-da-autenticação)
6. [Refatoração do Cliente de Dados](#6-refatoração-do-cliente-de-dados)
7. [Conversão das Edge Functions para API REST](#7-conversão-das-edge-functions-para-api-rest)
8. [Migração do Storage](#8-migração-do-storage)
9. [Implementação de Permissões (RLS → Backend)](#9-implementação-de-permissões-rls--backend)
10. [Configuração de Deploy na VPS](#10-configuração-de-deploy-na-vps)
11. [Checklist Final](#11-checklist-final)

---

## 1. Visão Geral da Arquitetura Atual

### Stack Atual (Lovable Cloud / Supabase)
```
Frontend (React + Vite + Tailwind)
    ↓
Supabase Client SDK (@supabase/supabase-js)
    ↓
┌─────────────────────────────────────────┐
│ Supabase Backend                        │
│  ├── Auth (login, sessões, JWT)         │
│  ├── PostgREST (API REST auto-gerada)   │
│  ├── PostgreSQL (banco + RLS policies)  │
│  ├── Edge Functions (Deno)              │
│  ├── Storage (buckets de arquivos)      │
│  └── Realtime (WebSockets)              │
└─────────────────────────────────────────┘
```

### Stack Alvo (VPS)
```
Frontend (React + Vite + Tailwind) → Nginx/Caddy
    ↓
API REST (Express/Fastify + Node.js)
    ↓
┌─────────────────────────────────────────┐
│ VPS Backend                             │
│  ├── Auth (JWT próprio + bcrypt)        │
│  ├── ORM (Prisma/Drizzle/Knex)         │
│  ├── PostgreSQL (seu banco existente)   │
│  ├── API Routes (Express/Fastify)       │
│  ├── Storage (filesystem/S3/MinIO)      │
│  └── Realtime (Socket.io ou SSE)        │
└─────────────────────────────────────────┘
```

---

## 2. Pré-requisitos na VPS

### Software necessário
```bash
# Node.js 18+ (recomendado: 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15+ (se ainda não tiver)
sudo apt-get install -y postgresql postgresql-contrib

# Nginx (proxy reverso)
sudo apt-get install -y nginx

# PM2 (gerenciador de processos Node.js)
npm install -g pm2

# Certbot (SSL gratuito)
sudo apt-get install -y certbot python3-certbot-nginx
```

### Estrutura de diretórios recomendada
```
/opt/locker-system/
├── frontend/          # Build do React (arquivos estáticos)
├── backend/           # API Node.js (Express/Fastify)
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── config/
│   ├── uploads/       # Storage local
│   └── package.json
└── .env               # Variáveis de ambiente
```

---

## 3. Exportação do Código

### Passo 1: Conectar ao GitHub
1. No Lovable: **Settings → GitHub → Connect project**
2. Criar repositório e aguardar sincronização
3. Na VPS: `git clone <url-do-repo>`

### Passo 2: Build do Frontend
```bash
cd /opt/locker-system/frontend
npm install
npm run build
# Output em dist/ → servir com Nginx
```

---

## 4. Migração do Banco de Dados

### 4.1 Tabelas a Criar no seu PostgreSQL

Execute as migrations na ordem. Todas as tabelas do sistema:

```sql
-- ============================================
-- EXTENSÕES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABELA: users (substitui auth.users do Supabase)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_confirmed BOOLEAN DEFAULT FALSE,
  raw_user_meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: profiles
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  company_id UUID,
  avatar_url TEXT,
  password_changed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- TABELA: companies
-- ============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'employee',
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  cnpj TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar FK após criar companies
ALTER TABLE profiles ADD CONSTRAINT profiles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id);

-- ============================================
-- TABELA: company_branding
-- ============================================
CREATE TABLE company_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  logo_url TEXT DEFAULT '',
  sidebar_logo_url TEXT DEFAULT '',
  favicon_url TEXT DEFAULT '',
  login_bg_url TEXT DEFAULT '',
  platform_name TEXT DEFAULT '',
  login_title TEXT DEFAULT '',
  login_subtitle TEXT DEFAULT '',
  theme_colors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: company_permissions
-- ============================================
CREATE TABLE company_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  permission TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: company_whatsapp
-- ============================================
CREATE TABLE company_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  instance_name TEXT DEFAULT '',
  instance_token TEXT DEFAULT '',
  phone_number TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: company_notification_templates
-- ============================================
CREATE TABLE company_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  template_text TEXT DEFAULT '',
  footer TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: departamentos
-- ============================================
CREATE TABLE departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: setores
-- ============================================
CREATE TABLE setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  departamento_id UUID REFERENCES departamentos(id),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: funcionarios_clientes
-- ============================================
CREATE TABLE funcionarios_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  departamento_id UUID REFERENCES departamentos(id),
  setor_id UUID REFERENCES setores(id),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cargo TEXT DEFAULT '',
  tipo TEXT DEFAULT 'funcionario',
  matricula TEXT,
  avatar_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  notification_whatsapp BOOLEAN DEFAULT TRUE,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_renewal BOOLEAN DEFAULT TRUE,
  notification_expiry BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: lockers
-- ============================================
CREATE TABLE lockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  rows INTEGER DEFAULT 4,
  columns INTEGER DEFAULT 1,
  orientation TEXT DEFAULT 'vertical',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: locker_doors
-- ============================================
CREATE TABLE locker_doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID NOT NULL REFERENCES lockers(id),
  door_number INTEGER NOT NULL,
  label TEXT,
  size TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'available',
  usage_type TEXT DEFAULT 'temporary',
  occupied_by UUID REFERENCES users(id),
  occupied_by_person UUID REFERENCES funcionarios_clientes(id),
  occupied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  scheduled_reservation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: locker_reservations
-- ============================================
CREATE TABLE locker_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID NOT NULL REFERENCES lockers(id),
  door_id UUID NOT NULL REFERENCES locker_doors(id),
  reserved_by UUID REFERENCES users(id),
  person_id UUID REFERENCES funcionarios_clientes(id),
  status TEXT DEFAULT 'active',
  usage_type TEXT DEFAULT 'temporary',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  renewed_count INTEGER DEFAULT 0,
  expiry_notified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK circular
ALTER TABLE locker_doors ADD CONSTRAINT locker_doors_scheduled_reservation_id_fkey
  FOREIGN KEY (scheduled_reservation_id) REFERENCES locker_reservations(id);

-- ============================================
-- TABELA: locker_waitlist
-- ============================================
CREATE TABLE locker_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  locker_id UUID NOT NULL REFERENCES lockers(id),
  person_id UUID NOT NULL REFERENCES funcionarios_clientes(id),
  requested_by UUID REFERENCES users(id),
  preferred_size TEXT DEFAULT 'any',
  status TEXT DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: renewal_requests
-- ============================================
CREATE TABLE renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  door_id UUID NOT NULL REFERENCES locker_doors(id),
  person_id UUID NOT NULL REFERENCES funcionarios_clientes(id),
  requested_hours INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: notifications
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: audit_logs
-- ============================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID REFERENCES companies(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  category TEXT DEFAULT 'system',
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: login_attempts
-- ============================================
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: platform_settings
-- ============================================
CREATE TABLE platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELA: platform_settings_history
-- ============================================
CREATE TABLE platform_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  value JSONB DEFAULT '{}',
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Funções do Banco a Recriar

```sql
-- Função: get_login_lockout_status (manter no banco)
-- Copiar exatamente como está definida no projeto atual
-- (ver seção db-functions no código fonte)

-- Função: register_login_attempt (manter no banco)
-- Copiar exatamente como está definida no projeto atual

-- Função: get_user_role (manter no banco)
CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = _user_id LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ... repetir para todas as tabelas com updated_at
```

---

## 5. Refatoração da Autenticação

### 5.1 Arquivo atual a substituir
**`src/integrations/supabase/client.ts`** → Não será mais usado

### 5.2 Criar serviço de autenticação no backend

```typescript
// backend/src/services/auth.service.ts
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export async function signUp(email: string, password: string, fullName: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, raw_user_meta_data)
     VALUES ($1, $2, $3) RETURNING id, email`,
    [email, passwordHash, JSON.stringify({ full_name: fullName })]
  );

  const user = rows[0];

  // Criar profile automaticamente
  await pool.query(
    `INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)`,
    [user.id, fullName]
  );

  return user;
}

export async function signIn(email: string, password: string) {
  const { rows } = await pool.query(
    `SELECT id, email, password_hash FROM users WHERE email = $1`,
    [email]
  );

  if (!rows[0]) throw new Error('Credenciais inválidas');

  const valid = await bcrypt.compare(password, rows[0].password_hash);
  if (!valid) throw new Error('Credenciais inválidas');

  const token = jwt.sign(
    { sub: rows[0].id, email: rows[0].email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return { token, user: { id: rows[0].id, email: rows[0].email } };
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
}
```

### 5.3 Refatorar o contexto de autenticação no frontend

```typescript
// src/contexts/ContextoAutenticacao.tsx (REFATORADO)
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api"; // Novo client HTTP

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("auth_token")
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get("/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => setUser(res.data.user))
        .catch(() => { setToken(null); localStorage.removeItem("auth_token"); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const signIn = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("auth_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    await api.post("/auth/register", { email, password, full_name: fullName });
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 5.4 Criar client HTTP (substitui supabase client)

```typescript
// src/lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);
```

---

## 6. Refatoração do Cliente de Dados

### 6.1 Mapeamento: Supabase SDK → API REST

Cada chamada `supabase.from("tabela")` precisa ser convertida para chamadas HTTP:

| Supabase (antes) | API REST (depois) |
|---|---|
| `supabase.from("companies").select("*")` | `api.get("/companies")` |
| `supabase.from("companies").insert({...})` | `api.post("/companies", {...})` |
| `supabase.from("companies").update({...}).eq("id", id)` | `api.put("/companies/:id", {...})` |
| `supabase.from("companies").delete().eq("id", id)` | `api.delete("/companies/:id")` |
| `supabase.from("companies").select("*").eq("active", true)` | `api.get("/companies?active=true")` |
| `supabase.rpc("get_login_lockout_status", {...})` | `api.post("/rpc/login-lockout", {...})` |

### 6.2 Arquivos que precisam ser refatorados

Lista completa de arquivos que importam `supabase`:

```
src/contexts/ContextoAutenticacao.tsx     → usar api.ts
src/contexts/ContextoEmpresa.tsx          → usar api.ts
src/contexts/ContextoPlataforma.tsx       → usar api.ts
src/services/auditoria.ts                → usar api.ts
src/hooks/useCompanyBranding.ts          → usar api.ts
src/hooks/useSessionTimeout.ts           → usar api.ts (ou remover, JWT tem expiração)
src/pages/Armarios.tsx                   → usar api.ts
src/pages/Empresas.tsx                   → usar api.ts
src/pages/Departamentos.tsx              → usar api.ts
src/pages/Setores.tsx                    → usar api.ts
src/pages/Pessoas.tsx                    → usar api.ts
src/pages/PainelDeControle.tsx           → usar api.ts
src/pages/Administracao.tsx              → usar api.ts
src/pages/Autenticacao.tsx               → usar api.ts
src/pages/Configuracoes.tsx              → usar api.ts
src/pages/HistoricoPortas.tsx            → usar api.ts
src/pages/Renovacoes.tsx                 → usar api.ts
src/pages/Auditoria.tsx                  → usar api.ts
src/pages/Portal.tsx                     → usar api.ts
src/pages/Personalizacao.tsx             → usar api.ts
src/pages/PersonalizacaoEmpresa.tsx      → usar api.ts
src/pages/StatusConexao.tsx              → usar api.ts
src/components/armario/*.tsx             → usar api.ts
src/components/configuracoes/*.tsx       → usar api.ts
src/components/dashboard/*.tsx           → usar api.ts
src/components/pessoas/*.tsx             → usar api.ts
src/components/portal/*.tsx              → usar api.ts
src/components/personalizacao/*.tsx      → usar api.ts
src/components/layout/SinoNotificacoes.tsx → usar api.ts
```

### 6.3 Exemplo de conversão (ContextoEmpresa.tsx)

**Antes:**
```typescript
const { data } = await supabase.from("companies").select("*").eq("active", true).order("name");
```

**Depois:**
```typescript
const { data } = await api.get("/companies", { params: { active: true, order: "name" } });
```

---

## 7. Conversão das Edge Functions para API REST

### 7.1 Mapeamento de Edge Functions → Rotas Express

| Edge Function | Rota Express |
|---|---|
| `create-company-user` | `POST /api/admin/users` |
| `create-person-login` | `POST /api/admin/person-login` |
| `email-locker-notify` | `POST /api/notifications/email` |
| `whatsapp-locker-notify` | `POST /api/notifications/whatsapp` |
| `waitlist-notify` | `POST /api/notifications/waitlist` |
| `expire-locker-doors` | `POST /api/cron/expire-doors` (cron job) |
| `send-smtp-email` | `POST /api/email/send` |
| `test-smtp` | `POST /api/email/test` |
| `uazapi-proxy` | `POST /api/whatsapp/proxy` |
| `whatsapp-webhook` | `POST /api/webhooks/whatsapp` |

### 7.2 Estrutura do backend Express

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth';
import { companiesRouter } from './routes/companies';
import { lockersRouter } from './routes/lockers';
import { peopleRouter } from './routes/people';
import { notificationsRouter } from './routes/notifications';
import { auditRouter } from './routes/audit';
import { settingsRouter } from './routes/settings';
import { authMiddleware } from './middleware/auth';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Rotas públicas
app.use('/api/auth', authRouter);
app.use('/api/webhooks', webhooksRouter);

// Rotas protegidas
app.use('/api/companies', authMiddleware, companiesRouter);
app.use('/api/lockers', authMiddleware, lockersRouter);
app.use('/api/people', authMiddleware, peopleRouter);
app.use('/api/notifications', authMiddleware, notificationsRouter);
app.use('/api/audit', authMiddleware, auditRouter);
app.use('/api/settings', authMiddleware, settingsRouter);
app.use('/api/admin', authMiddleware, adminRouter);

app.listen(3001, () => console.log('API rodando na porta 3001'));
```

### 7.3 Middleware de autenticação

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service';
import { pool } from '../config/database';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = verifyToken(token);
    const { rows } = await pool.query(
      `SELECT p.*, u.email FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [decoded.sub]
    );
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
```

### 7.4 Middleware de permissão (substitui RLS)

```typescript
// backend/src/middleware/permissions.ts
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso não autorizado' });
    }
    next();
  };
}

export function requireCompanyAccess(req: Request, res: Response, next: NextFunction) {
  const companyId = req.params.companyId || req.body.company_id;
  if (req.user.role === 'superadmin') return next();
  if (req.user.company_id !== companyId) {
    return res.status(403).json({ error: 'Acesso restrito à sua empresa' });
  }
  next();
}
```

### 7.5 Cron Job (substitui expire-locker-doors)

```typescript
// backend/src/cron/expire-doors.ts
import cron from 'node-cron';
import { pool } from '../config/database';

// Executar a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  await pool.query(`
    UPDATE locker_doors
    SET status = 'available',
        occupied_by = NULL,
        occupied_by_person = NULL,
        occupied_at = NULL,
        expires_at = NULL
    WHERE status = 'occupied'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  `);

  await pool.query(`
    UPDATE locker_reservations
    SET status = 'expired', released_at = NOW()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  `);

  console.log('[CRON] Portas expiradas processadas');
});
```

---

## 8. Migração do Storage

### 8.1 Buckets atuais
- **platform-assets** (público) → logos, favicons, backgrounds
- **avatars** (público) → fotos de perfil

### 8.2 Opção A: Filesystem local

```typescript
// backend/src/routes/upload.ts
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.params.bucket; // 'avatars' ou 'platform-assets'
    cb(null, path.join(__dirname, '../../uploads', folder));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/upload/:bucket', upload.single('file'), (req, res) => {
  const url = `${process.env.API_URL}/uploads/${req.params.bucket}/${req.file.filename}`;
  res.json({ url });
});
```

### 8.3 Opção B: MinIO (S3-compatível, self-hosted)

```bash
# Instalar MinIO na VPS
docker run -p 9000:9000 -p 9001:9001 \
  -v /data/minio:/data \
  minio/minio server /data --console-address ":9001"
```

### 8.4 Substituições no frontend

| Antes (Supabase Storage) | Depois |
|---|---|
| `supabase.storage.from("avatars").upload(...)` | `api.post("/upload/avatars", formData)` |
| `supabase.storage.from("avatars").getPublicUrl(...)` | URL direta retornada pelo upload |

---

## 9. Implementação de Permissões (RLS → Backend)

### 9.1 Regras de acesso atuais (extraídas das RLS policies)

```
┌─────────────────────────────────────────────────────────┐
│ SUPERADMIN                                              │
│  ✅ Acesso total a todas as tabelas e empresas          │
├─────────────────────────────────────────────────────────┤
│ ADMIN                                                   │
│  ✅ CRUD completo nos dados da SUA empresa              │
│  ❌ Sem acesso a dados de outras empresas               │
├─────────────────────────────────────────────────────────┤
│ USER                                                    │
│  ✅ Leitura dos dados da sua empresa                    │
│  ✅ Atualização do próprio perfil/pessoa                │
│  ✅ Criar solicitações de renovação                     │
│  ❌ Sem acesso administrativo                           │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Exemplo: Rota de companies com permissões

```typescript
// backend/src/routes/companies.ts
import { Router } from 'express';
import { requireRole } from '../middleware/permissions';
import { pool } from '../config/database';

const router = Router();

// GET /api/companies - listar empresas
router.get('/', async (req, res) => {
  if (req.user.role === 'superadmin') {
    const { rows } = await pool.query(
      'SELECT * FROM companies WHERE active = true ORDER BY name'
    );
    return res.json(rows);
  }

  // Admin/User: apenas sua empresa
  const { rows } = await pool.query(
    'SELECT * FROM companies WHERE id = $1 AND active = true',
    [req.user.company_id]
  );
  res.json(rows);
});

// POST /api/companies - criar empresa (apenas superadmin)
router.post('/', requireRole('superadmin'), async (req, res) => {
  const { name, type, description } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO companies (name, type, description) VALUES ($1, $2, $3) RETURNING *',
    [name, type, description]
  );
  res.json(rows[0]);
});

export { router as companiesRouter };
```

---

## 10. Configuração de Deploy na VPS

### 10.1 Variáveis de ambiente (.env)

```env
# Banco de dados
DATABASE_URL=postgresql://usuario:senha@localhost:5432/locker_system

# JWT
JWT_SECRET=sua_chave_secreta_super_segura_aqui_min_64_chars

# API
API_URL=https://api.seudominio.com
FRONTEND_URL=https://seudominio.com
PORT=3001

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=sua_senha_app

# WhatsApp (UaZapi)
UAZAPI_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=seu_token
```

### 10.2 Nginx - Configuração

```nginx
# /etc/nginx/sites-available/locker-system
server {
    listen 80;
    server_name seudominio.com;

    # Frontend (arquivos estáticos)
    location / {
        root /opt/locker-system/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Backend (proxy)
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads (storage local)
    location /uploads/ {
        alias /opt/locker-system/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 10.3 PM2 - Gerenciar o backend

```bash
cd /opt/locker-system/backend
pm2 start dist/index.js --name locker-api
pm2 save
pm2 startup
```

### 10.4 SSL com Certbot

```bash
sudo certbot --nginx -d seudominio.com -d api.seudominio.com
```

### 10.5 Variáveis do Frontend (build)

```env
# frontend/.env.production
VITE_API_URL=https://seudominio.com/api
```

---

## 11. Checklist Final

### Banco de Dados
- [ ] Todas as 16 tabelas criadas no PostgreSQL
- [ ] Funções `get_login_lockout_status` e `register_login_attempt` criadas
- [ ] Triggers de `updated_at` aplicados
- [ ] Triggers de auditoria recriados (ou movidos para o backend)
- [ ] Dados existentes migrados (se aplicável)

### Backend (API Node.js)
- [ ] Express/Fastify configurado com CORS
- [ ] Rotas CRUD para todas as tabelas
- [ ] Autenticação JWT implementada (login, registro, refresh)
- [ ] Middleware de permissões (substitui RLS)
- [ ] Upload de arquivos (substitui Supabase Storage)
- [ ] Envio de e-mails SMTP
- [ ] Integração WhatsApp (UaZapi proxy)
- [ ] Cron job para expiração de portas
- [ ] Logging e tratamento de erros

### Frontend (React)
- [ ] `src/lib/api.ts` criado (Axios com interceptors)
- [ ] `ContextoAutenticacao.tsx` refatorado para JWT
- [ ] `ContextoEmpresa.tsx` refatorado para API REST
- [ ] `ContextoPlataforma.tsx` refatorado para API REST
- [ ] Todas as páginas convertidas (supabase → api)
- [ ] Todos os componentes convertidos
- [ ] `services/auditoria.ts` refatorado
- [ ] Hooks refatorados
- [ ] Build testado sem erros

### Infraestrutura VPS
- [ ] Node.js 20 LTS instalado
- [ ] PostgreSQL acessível
- [ ] Nginx configurado (proxy + static files)
- [ ] PM2 rodando o backend
- [ ] SSL/HTTPS configurado
- [ ] Firewall configurado (portas 80, 443)
- [ ] Backup automático do banco configurado
- [ ] Monitoramento (opcional: Uptime Kuma, Grafana)

### Segurança
- [ ] JWT_SECRET forte (mín. 64 caracteres)
- [ ] Senhas com bcrypt (salt rounds ≥ 12)
- [ ] Rate limiting nas rotas de autenticação
- [ ] Helmet.js para headers de segurança
- [ ] Input validation (zod/joi) em todas as rotas
- [ ] CORS restrito ao domínio do frontend
- [ ] Variáveis sensíveis nunca no código

---

## Estimativa de Esforço

| Tarefa | Complexidade | Tempo estimado |
|---|---|---|
| Setup do banco (tabelas + funções) | Média | 2-4h |
| Backend API completo | Alta | 20-30h |
| Refatoração do frontend | Alta | 15-25h |
| Storage / uploads | Baixa | 2-4h |
| Testes e debug | Média | 8-12h |
| Deploy e infraestrutura | Média | 4-6h |
| **Total estimado** | | **50-80h** |

---

## Pacotes NPM necessários no Backend

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.11.0",
    "multer": "^1.4.5",
    "node-cron": "^3.0.0",
    "nodemailer": "^6.9.0",
    "zod": "^3.22.0",
    "express-rate-limit": "^7.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/pg": "^8.10.0",
    "@types/multer": "^1.4.0",
    "typescript": "^5.3.0",
    "tsx": "^4.0.0"
  }
}
```

---

> **⚠️ Nota importante:** Este guia cobre a migração técnica. Recomenda-se fortemente implementar testes automatizados antes de iniciar a refatoração para garantir que o comportamento do sistema seja preservado.
