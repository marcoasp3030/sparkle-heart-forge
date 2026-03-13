# 🚀 Deploy Rápido — pblocker.sistembr.com.br

Guia passo-a-passo para colocar o sistema rodando na sua VPS.

**Dados do servidor:**
- IP: `76.13.165.156`
- Domínio: `pblocker.sistembr.com.br`
- PostgreSQL: porta `5432`, banco `pblocker`

---

## Passo 1: Conectar na VPS

```bash
ssh root@76.13.165.156
```

---

## Passo 2: Instalar dependências (se ainda não tiver)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# PM2
npm install -g pm2

# Verificar
node -v   # deve ser 20.x
npm -v
```

---

## Passo 3: Copiar o projeto para a VPS

No seu computador local, faça o build e envie:

```bash
# 1. Clone ou baixe o projeto do GitHub
git clone <URL_DO_SEU_REPO> /tmp/locker-system
cd /tmp/locker-system

# 2. Crie o arquivo .env.production na raiz
cat > .env.production << 'EOF'
VITE_API_URL=https://pblocker.sistembr.com.br/api
EOF

# 3. Build do frontend
npm install
npm run build

# 4. Envie para a VPS
scp -r dist/ root@76.13.165.156:/opt/locker-system/dist/
scp -r backend/ root@76.13.165.156:/opt/locker-system/backend/
```

Ou se preferir clonar diretamente na VPS:

```bash
# Na VPS:
mkdir -p /opt/locker-system
cd /opt/locker-system
git clone <URL_DO_SEU_REPO> .

# Criar .env.production
echo 'VITE_API_URL=https://pblocker.sistembr.com.br/api' > .env.production

# Build do frontend
npm install
npm run build
```

---

## Passo 4: Configurar o Backend

```bash
cd /opt/locker-system/backend
npm install
```

### Criar o arquivo `.env` do backend:

```bash
cat > /opt/locker-system/backend/.env << 'EOF'
# Banco de Dados
DATABASE_URL=postgresql://admin:Ma%40%40%40%23%23%2332443030@localhost:5432/pblocker

# JWT (GERE UMA CHAVE ÚNICA!)
JWT_SECRET=COLE_AQUI_SUA_CHAVE_JWT
JWT_EXPIRES_IN=7d

# Servidor
PORT=3001
FRONTEND_URL=https://pblocker.sistembr.com.br
API_URL=https://pblocker.sistembr.com.br/api

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
EOF
```

> **IMPORTANTE:** Gere o JWT_SECRET com: `openssl rand -base64 64`
> 
> **Nota:** Os caracteres especiais da senha do banco (`@`, `#`) estão URL-encoded na DATABASE_URL.
> Se o PostgreSQL estiver em outra máquina, troque `localhost` por `76.13.165.156`.

### Compilar o backend:

```bash
cd /opt/locker-system/backend
npx tsc
```

### Criar as tabelas no banco:

```bash
# Conecte ao PostgreSQL
psql -U admin -d pblocker -h localhost

# Cole o SQL do arquivo GUIA_MIGRACAO_VPS.md (seção 3.2)
# Ou execute:
# \i /opt/locker-system/scripts/schema.sql
```

### Criar o primeiro superadmin:

```bash
psql -U admin -d pblocker -h localhost
```

```sql
-- Criar usuário admin
INSERT INTO users (email, password_hash)
VALUES (
  'seu@email.com',
  crypt('sua_senha_aqui', gen_salt('bf'))
);

-- Criar perfil de superadmin
INSERT INTO profiles (user_id, full_name, role, password_changed)
VALUES (
  (SELECT id FROM users WHERE email = 'seu@email.com'),
  'Administrador',
  'superadmin',
  true
);

-- Criar empresa padrão
INSERT INTO companies (name, type) VALUES ('Minha Empresa', 'employee');

-- Vincular admin à empresa
UPDATE profiles
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE user_id = (SELECT id FROM users WHERE email = 'seu@email.com');
```

---

## Passo 5: Iniciar o Backend com PM2

```bash
cd /opt/locker-system/backend

# Criar diretórios de upload
mkdir -p uploads/avatars uploads/platform-assets

# Iniciar com PM2
pm2 start dist/index.js --name locker-api

# Testar se está rodando
curl http://localhost:3001/api/health

# Salvar para restart automático
pm2 save
pm2 startup
```

---

## Passo 6: Configurar Nginx (Proxy Reverso + SSL)

```bash
sudo nano /etc/nginx/sites-available/pblocker
```

Cole esta configuração:

```nginx
server {
    listen 80;
    server_name pblocker.sistembr.com.br;
    
    # Redirecionar para HTTPS (descomente após configurar SSL)
    # return 301 https://$host$request_uri;
    
    # Frontend (arquivos estáticos do React)
    root /opt/locker-system/dist;
    index index.html;
    
    # SPA: redireciona rotas desconhecidas para index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API Backend (proxy reverso para Express)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Uploads (arquivos estáticos)
    location /uploads/ {
        alias /opt/locker-system/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Ativar o site:

```bash
sudo ln -sf /etc/nginx/sites-available/pblocker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Configurar SSL com Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d pblocker.sistembr.com.br
```

---

## Passo 7: Verificar

```bash
# Backend rodando?
curl http://localhost:3001/api/health

# Nginx rodando?
curl http://pblocker.sistembr.com.br/api/health

# Frontend carregando?
curl http://pblocker.sistembr.com.br
```

---

## Checklist Final

- [ ] PostgreSQL acessível e tabelas criadas
- [ ] Backend `.env` configurado com JWT_SECRET único
- [ ] Backend compilado (`npx tsc`) e rodando com PM2
- [ ] `curl http://localhost:3001/api/health` retorna OK
- [ ] Nginx configurado e reload feito
- [ ] SSL configurado com Certbot
- [ ] Superadmin criado no banco
- [ ] Testar login em `https://pblocker.sistembr.com.br/auth`

---

## Comandos Úteis

```bash
# Ver logs do backend
pm2 logs locker-api

# Reiniciar backend
pm2 restart locker-api

# Ver status
pm2 status

# Logs do Nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

---

## Resolução de Problemas

| Problema | Solução |
|----------|---------|
| `ECONNREFUSED` no login | Backend não está rodando. `pm2 status` e `pm2 restart locker-api` |
| `502 Bad Gateway` | Nginx não consegue conectar ao backend. Verifique porta 3001 |
| `CORS error` | Verifique `FRONTEND_URL` no `.env` do backend |
| Senha do banco não conecta | Verifique URL encoding dos caracteres especiais na DATABASE_URL |
| `relation does not exist` | Tabelas não foram criadas. Execute o SQL do schema |
