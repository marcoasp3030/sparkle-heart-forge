# 🚀 Guia de Deploy — Locker System (Backend Express + Frontend React)

Este guia descreve como fazer o deploy completo do sistema em uma VPS com PostgreSQL próprio. **A migração do Supabase para Express já foi concluída** — o backend está 100% funcional com todas as rotas implementadas.

---

## Índice

1. [Arquitetura Final](#1-arquitetura-final)
2. [Pré-requisitos na VPS](#2-pré-requisitos-na-vps)
3. [Configuração do Banco de Dados](#3-configuração-do-banco-de-dados)
4. [Configuração do Backend](#4-configuração-do-backend)
5. [Build do Frontend](#5-build-do-frontend)
6. [Variáveis de Ambiente](#6-variáveis-de-ambiente)
7. [Configuração do Nginx](#7-configuração-do-nginx)
8. [PM2 — Gerenciador de Processos](#8-pm2--gerenciador-de-processos)
9. [SSL/HTTPS](#9-sslhttps)
10. [Referência Completa de Rotas](#10-referência-completa-de-rotas)
11. [Checklist de Deploy](#11-checklist-de-deploy)

---

## 1. Arquitetura Final

```
Frontend (React + Vite + Tailwind) → Nginx (estáticos)
    ↓ HTTP/HTTPS
API REST (Express + Node.js)
    ↓
┌─────────────────────────────────────────────────────┐
│ VPS Backend                                         │
│  ├── Auth (JWT + bcrypt)                            │
│  ├── PostgreSQL (pg driver, pool de conexões)       │
│  ├── 23 grupos de rotas Express                     │
│  ├── Storage (filesystem + multer)                  │
│  ├── SMTP (nodemailer para e-mails transacionais)   │
│  ├── WhatsApp (UaZapi proxy)                        │
│  ├── Cron Jobs (node-cron: expiração de portas)     │
│  └── Webhooks (WhatsApp UaZapi)                     │
└─────────────────────────────────────────────────────┘
```

### Frontend → Backend: Camada de Compatibilidade

O frontend usa `src/lib/supabase-compat.ts` que traduz chamadas no formato Supabase SDK para requests HTTP ao backend Express via `src/lib/api.ts` (Axios). Isso permitiu migrar sem reescrever cada componente individualmente.

---

## 2. Pré-requisitos na VPS

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15+
sudo apt-get install -y postgresql postgresql-contrib

# Traefik (proxy reverso + SSL automático)
# Ver seção 7 para instalação detalhada

# PM2 (gerenciador de processos)
npm install -g pm2

# Git
sudo apt-get install -y git
```

### Estrutura de diretórios

```
/opt/locker-system/
├── dist/                # Build do React (Traefik roteia para servidor estático)
├── backend/
│   ├── src/
│   │   ├── config/      # database.ts, migrate.ts
│   │   ├── cron/        # expire-doors.ts
│   │   ├── middleware/   # auth.ts, permissions.ts, validate.ts
│   │   ├── routes/      # 23 arquivos de rotas
│   │   ├── services/    # auth.service.ts, email.service.ts
│   │   ├── types/       # express.d.ts
│   │   └── index.ts     # Entry point
│   ├── uploads/         # Storage local (avatars, assets)
│   ├── dist/            # Build compilado (tsc)
│   ├── package.json
│   └── tsconfig.json
└── .env                 # Variáveis de ambiente
```

---

## 3. Configuração do Banco de Dados

### 3.1 Criar o banco

```bash
sudo -u postgres psql
CREATE DATABASE locker_system;
CREATE USER locker_user WITH ENCRYPTED PASSWORD 'senha_forte_aqui';
GRANT ALL PRIVILEGES ON DATABASE locker_system TO locker_user;
\q
```

### 3.2 Criar as tabelas

Execute o SQL abaixo no banco `locker_system`:

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

-- ============================================
-- TABELA: password_reset_tokens
-- ============================================
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Funções do Banco

```sql
-- Função: get_user_role
CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = _user_id LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Função: get_login_lockout_status
CREATE OR REPLACE FUNCTION get_login_lockout_status(_email TEXT)
RETURNS TABLE(
  bloqueado BOOLEAN,
  mensagem TEXT,
  minutos_restantes INTEGER,
  nivel TEXT,
  segundos_restantes INTEGER,
  tentativas_restantes INTEGER,
  total_falhas BIGINT
) AS $$
DECLARE
  _total BIGINT;
  _last TIMESTAMPTZ;
BEGIN
  SELECT COUNT(*), MAX(created_at) INTO _total, _last
  FROM login_attempts
  WHERE email = _email AND success = FALSE
    AND created_at > NOW() - INTERVAL '30 minutes';

  IF _total >= 10 THEN
    RETURN QUERY SELECT TRUE, 'Conta bloqueada por excesso de tentativas'::TEXT,
      EXTRACT(EPOCH FROM (_last + INTERVAL '30 minutes' - NOW()))::INTEGER / 60,
      'critical'::TEXT,
      EXTRACT(EPOCH FROM (_last + INTERVAL '30 minutes' - NOW()))::INTEGER,
      0::INTEGER, _total;
  ELSIF _total >= 5 THEN
    RETURN QUERY SELECT TRUE, 'Muitas tentativas. Aguarde alguns minutos.'::TEXT,
      EXTRACT(EPOCH FROM (_last + INTERVAL '5 minutes' - NOW()))::INTEGER / 60,
      'warning'::TEXT,
      EXTRACT(EPOCH FROM (_last + INTERVAL '5 minutes' - NOW()))::INTEGER,
      (10 - _total)::INTEGER, _total;
  ELSE
    RETURN QUERY SELECT FALSE, 'OK'::TEXT, 0, 'ok'::TEXT, 0, (5 - _total)::INTEGER, _total;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Função: register_login_attempt
CREATE OR REPLACE FUNCTION register_login_attempt(_email TEXT, _success BOOLEAN)
RETURNS VOID AS $$
BEGIN
  INSERT INTO login_attempts (email, success) VALUES (_email, _success);
  IF _success THEN
    DELETE FROM login_attempts WHERE email = _email AND success = FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers de updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','profiles','companies','company_branding','company_permissions',
    'company_whatsapp','company_notification_templates','departamentos','setores',
    'funcionarios_clientes','lockers','locker_doors','locker_reservations',
    'locker_waitlist','renewal_requests','platform_settings'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;
```

### 3.4 Criar superadmin inicial

```sql
-- Gere o hash com: node -e "require('bcryptjs').hash('SuaSenha123', 12).then(h => console.log(h))"
INSERT INTO users (email, password_hash, email_confirmed)
VALUES ('admin@seudominio.com', '$2a$12$HASH_GERADO_AQUI', TRUE);

INSERT INTO profiles (user_id, full_name, role)
SELECT id, 'Administrador', 'superadmin' FROM users WHERE email = 'admin@seudominio.com';
```

---

## 4. Configuração do Backend

### 4.1 Instalar dependências

```bash
cd /opt/locker-system/backend
npm install
```

### 4.2 Compilar TypeScript

```bash
npm run build
# Output em dist/
```

### 4.3 Dependências do backend (package.json)

```json
{
  "dependencies": {
    "axios": "^1.7.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.14",
    "pg": "^8.12.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.14.0",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.15",
    "@types/pg": "^8.11.6",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0"
  }
}
```

### 4.4 Criar pasta de uploads

```bash
mkdir -p /opt/locker-system/backend/uploads/avatars
mkdir -p /opt/locker-system/backend/uploads/platform-assets
chmod 755 /opt/locker-system/backend/uploads
```

---

## 5. Build do Frontend

```bash
cd /opt/locker-system
npm install
npm run build
# Output em dist/ → copiar para frontend/dist ou servir direto
```

Crie o arquivo `.env.production` na raiz antes do build:

```env
VITE_API_URL=https://seudominio.com/api
```

---

## 6. Variáveis de Ambiente

Crie o arquivo `/opt/locker-system/backend/.env`:

```env
# ============================================
# Banco de Dados (OBRIGATÓRIO)
# ============================================
DATABASE_URL=postgresql://locker_user:senha_forte@localhost:5432/locker_system

# ============================================
# JWT (OBRIGATÓRIO)
# ============================================
JWT_SECRET=troque_por_uma_chave_secreta_com_pelo_menos_64_caracteres_aqui_use_openssl_rand
JWT_EXPIRES_IN=7d

# ============================================
# Servidor (OBRIGATÓRIO)
# ============================================
PORT=3001
FRONTEND_URL=https://seudominio.com
API_URL=https://seudominio.com/api

# ============================================
# Email SMTP (opcional - pode configurar via painel)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=sua_senha_de_app

# ============================================
# WhatsApp UaZapi (opcional - pode configurar via painel)
# ============================================
UAZAPI_URL=https://sua-instancia.uazapi.com
UAZAPI_TOKEN=seu_token_aqui

# ============================================
# Upload (opcional)
# ============================================
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

> **Dica:** Gere o JWT_SECRET com: `openssl rand -base64 64`

---

## 7. Configuração do Traefik (Proxy Reverso + SSL Automático)

Traefik gerencia proxy reverso, load balancing e certificados SSL automaticamente via Let's Encrypt.

### 7.1 Instalar Traefik

```bash
# Criar diretórios
sudo mkdir -p /opt/traefik
sudo mkdir -p /opt/traefik/config
sudo touch /opt/traefik/acme.json
sudo chmod 600 /opt/traefik/acme.json

# Baixar binário (ou usar Docker)
wget https://github.com/traefik/traefik/releases/latest/download/traefik_linux-amd64.tar.gz
tar xzf traefik_linux-amd64.tar.gz
sudo mv traefik /usr/local/bin/
```

### 7.2 Arquivo de configuração estática

```yaml
# /opt/traefik/traefik.yml
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: seu@email.com
      storage: /opt/traefik/acme.json
      httpChallenge:
        entryPoint: web

providers:
  file:
    filename: /opt/traefik/config/dynamic.yml
    watch: true

log:
  level: INFO

accessLog: {}
```

### 7.3 Configuração dinâmica (rotas)

```yaml
# /opt/traefik/config/dynamic.yml
http:
  routers:
    # Frontend (arquivos estáticos servidos pelo próprio Express ou servidor de arquivos)
    locker-frontend:
      rule: "Host(`seudominio.com`) && !PathPrefix(`/api`) && !PathPrefix(`/uploads`)"
      service: locker-frontend
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt

    # API Backend
    locker-api:
      rule: "Host(`seudominio.com`) && PathPrefix(`/api`)"
      service: locker-api
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - api-ratelimit
        - api-headers

    # Uploads (storage local)
    locker-uploads:
      rule: "Host(`seudominio.com`) && PathPrefix(`/uploads`)"
      service: locker-uploads
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      middlewares:
        - uploads-cache

  services:
    locker-frontend:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3002"  # Servidor de arquivos estáticos (ver 7.5)

    locker-api:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3001"

    locker-uploads:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3001"

  middlewares:
    api-ratelimit:
      rateLimit:
        average: 100
        burst: 50
        period: 1m

    api-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        accessControlAllowOriginList:
          - "https://seudominio.com"
        accessControlAllowMethods:
          - GET
          - POST
          - PUT
          - PATCH
          - DELETE
          - OPTIONS
        accessControlAllowHeaders:
          - Authorization
          - Content-Type

    uploads-cache:
      headers:
        customResponseHeaders:
          Cache-Control: "public, max-age=2592000, immutable"
```

### 7.4 Systemd service para Traefik

```ini
# /etc/systemd/system/traefik.service
[Unit]
Description=Traefik Proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/traefik --configFile=/opt/traefik/traefik.yml
Restart=on-failure
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable traefik
sudo systemctl start traefik
```

### 7.5 Servir frontend estático

**Opção A: Servir via Express (mais simples)**

Adicione ao `backend/src/index.ts` antes do error handler:

```typescript
// Servir frontend em produção
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}
```

Nesse caso, aponte o `locker-frontend` service para `http://127.0.0.1:3001` também.

**Opção B: Servidor estático separado (serve/http-server)**

```bash
npm install -g serve
pm2 start "serve -s /opt/locker-system/dist -l 3002" --name locker-frontend
```

### 7.6 Alternativa: Traefik com Docker Compose

Se preferir usar Docker para tudo:

```yaml
# /opt/locker-system/docker-compose.yml
version: "3.9"

services:
  traefik:
    image: traefik:v3.2
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=seu@email.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./acme.json:/acme.json
    restart: unless-stopped

  api:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://locker_user:senha@db:5432/locker_system
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=https://seudominio.com
      - PORT=3001
    volumes:
      - ./backend/uploads:/app/uploads
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`seudominio.com`) && PathPrefix(`/api`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.services.api.loadbalancer.server.port=3001"
    depends_on:
      - db
    restart: unless-stopped

  frontend:
    image: nginx:alpine
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx-spa.conf:/etc/nginx/conf.d/default.conf:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`seudominio.com`) && !PathPrefix(`/api`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: locker_system
      POSTGRES_USER: locker_user
      POSTGRES_PASSWORD: senha_forte
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

```nginx
# nginx-spa.conf (para o container frontend)
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Deploy com Docker Compose
touch acme.json && chmod 600 acme.json
docker compose up -d
```

---

## 8. PM2 — Gerenciador de Processos

```bash
cd /opt/locker-system/backend

# Iniciar a API
pm2 start dist/index.js --name locker-api --env production

# Salvar e configurar auto-start
pm2 save
pm2 startup

# Comandos úteis
pm2 logs locker-api        # Ver logs em tempo real
pm2 restart locker-api     # Reiniciar
pm2 monit                  # Monitor interativo
```

---

## 9. SSL/HTTPS

O Traefik gerencia SSL automaticamente via Let's Encrypt. Os certificados são armazenados em `/opt/traefik/acme.json` e renovados automaticamente.

Para verificar o status:

```bash
sudo systemctl status traefik
# Verificar se o certificado foi emitido
curl -vI https://seudominio.com 2>&1 | grep "subject:"
```

---

## 10. Referência Completa de Rotas

### Rotas Públicas (sem autenticação)

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login (retorna JWT) |
| `POST` | `/api/auth/register` | Cadastro de usuário |
| `POST` | `/api/auth/forgot-password` | Recuperação de senha |
| `GET`  | `/api/auth/me` | Dados do usuário autenticado |
| `GET`  | `/api/health` | Health check (status do banco e API) |
| `POST` | `/api/webhooks/whatsapp` | Webhook de entrada do UaZapi |

### Rotas Protegidas (requerem `Authorization: Bearer <token>`)

| Grupo | Rota Base | Descrição |
|-------|-----------|-----------|
| **Empresas** | `/api/companies` | CRUD de empresas |
| **Armários** | `/api/lockers` | CRUD de armários e portas |
| **Pessoas** | `/api/people` | CRUD de funcionários/clientes |
| **Departamentos** | `/api/departments` | CRUD de departamentos |
| **Setores** | `/api/sectors` | CRUD de setores |
| **Notificações** | `/api/notifications` | Notificações do sistema |
| **Renovações** | `/api/renewals` | Solicitações de renovação de portas |
| **Fila de Espera** | `/api/waitlist` | Fila de espera por armários |
| **Reservas** | `/api/reservations` | Reservas agendadas |
| **Auditoria** | `/api/audit` | Logs de auditoria |
| **Configurações** | `/api/settings` | Configurações da plataforma |
| **Admin** | `/api/admin` | Gerenciamento de usuários (criar, editar roles) |
| **Upload** | `/api/upload` | Upload de arquivos (avatars, logos) |
| **E-mail** | `/api/email` | Configuração de e-mail |
| **WhatsApp** | `/api/whatsapp` | Configuração WhatsApp por empresa |
| **Compat** | `/api/compat` | Camada de compatibilidade Supabase |
| **RPC** | `/api/rpc` | Funções de banco (lockout, roles) |
| **SMTP** | `/api/smtp/send` | Envio de e-mail via SMTP customizado |
| **SMTP Test** | `/api/smtp/test` | Teste de conexão SMTP |
| **Email Notify** | `/api/email-notify` | Notificações por e-mail (ocupação, expiração, liberação) |
| **WhatsApp Notify** | `/api/whatsapp-notify` | Notificações WhatsApp (ocupação, expiração, liberação) |
| **UaZapi Proxy** | `/api/uazapi-proxy` | Proxy para API UaZapi (criar instância, QR, status, enviar) |
| **Waitlist Notify** | `/api/waitlist-notify` | Notificação de vaga disponível (fila de espera) |
| **Functions** | `/api/functions/:name` | Proxy legado (mapeia `supabase.functions.invoke()` para rotas internas) |

### Cron Jobs Internos

| Job | Frequência | Descrição |
|-----|-----------|-----------|
| Expiração de portas | A cada 5 minutos | Libera portas com `expires_at` vencido e marca reservas como expiradas |

---

## 11. Checklist de Deploy

### Banco de Dados
- [ ] PostgreSQL instalado e rodando
- [ ] Banco `locker_system` criado
- [ ] Todas as 16 tabelas criadas
- [ ] Funções `get_login_lockout_status`, `register_login_attempt`, `get_user_role` criadas
- [ ] Triggers de `updated_at` aplicados
- [ ] Superadmin inicial criado

### Backend
- [ ] Node.js 20 LTS instalado
- [ ] Dependências instaladas (`npm install`)
- [ ] TypeScript compilado (`npm run build`)
- [ ] `.env` configurado com todas as variáveis obrigatórias
- [ ] Pasta `uploads/` criada com subpastas
- [ ] PM2 rodando a API
- [ ] Health check respondendo: `curl http://localhost:3001/api/health`

### Frontend
- [ ] `.env.production` com `VITE_API_URL` correto
- [ ] Build gerado (`npm run build`)
- [ ] Arquivos estáticos copiados para o diretório do Nginx

### Infraestrutura
- [ ] Traefik configurado (proxy reverso + rotas dinâmicas)
- [ ] SSL/HTTPS ativo (Let's Encrypt via Traefik)
- [ ] PM2 com auto-start configurado
- [ ] Firewall liberando portas 80 e 443
- [ ] Backup automático do PostgreSQL configurado

### Segurança
- [ ] `JWT_SECRET` forte (mín. 64 caracteres aleatórios)
- [ ] Senhas com bcrypt (salt rounds = 12)
- [ ] Rate limiting ativo nas rotas de autenticação
- [ ] Helmet.js habilitado para headers de segurança
- [ ] CORS restrito ao `FRONTEND_URL`
- [ ] `.env` com permissões `600` (`chmod 600 .env`)

### Opcional
- [ ] SMTP configurado para e-mails transacionais
- [ ] UaZapi configurada para WhatsApp
- [ ] Monitoramento (Uptime Kuma, Grafana)
- [ ] Log rotation configurado

---

## Comandos Úteis

```bash
# Logs em tempo real
pm2 logs locker-api

# Reiniciar após update
cd /opt/locker-system/backend && npm run build && pm2 restart locker-api

# Testar saúde da API
curl -s http://localhost:3001/api/health | jq

# Backup do banco
pg_dump -U locker_user locker_system > backup_$(date +%Y%m%d).sql

# Restaurar backup
psql -U locker_user locker_system < backup_20260312.sql
```

---

> **✅ Migração concluída.** O sistema está 100% independente do Supabase. Todas as Edge Functions foram convertidas para rotas Express, a autenticação usa JWT próprio com bcrypt, e o frontend se comunica via camada de compatibilidade HTTP.
