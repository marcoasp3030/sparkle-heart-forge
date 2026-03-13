# 🐳 Deploy PBLocker com Docker

Deploy completo do sistema em **https://pblocker.sistembr.com.br** usando Docker.

---

## Pré-requisitos

- VPS com Ubuntu 22+ (ou qualquer Linux com Docker)
- Docker e Docker Compose instalados
- Domínio `pblocker.sistembr.com.br` apontando para o IP da VPS

### Instalar Docker (se necessário)

```bash
# Instala Docker
curl -fsSL https://get.docker.com | sh

# Adiciona seu usuário ao grupo docker
sudo usermod -aG docker $USER

# Instala Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Verifica instalação
docker --version
docker compose version
```

---

## 🚀 Deploy em 4 passos

### 1. Clonar o projeto na VPS

```bash
cd /opt
git clone <URL_DO_REPOSITORIO> locker-system
cd locker-system
```

### 2. Configurar variáveis de ambiente

```bash
# Copiar template
cp .env.docker .env

# Editar com suas credenciais
nano .env
```

Preencha:
```env
DB_PASSWORD=SuaSenhaForteAqui123!
JWT_SECRET=$(openssl rand -base64 64)
```

> ⚡ **Dica**: Gere o JWT_SECRET com `openssl rand -base64 64`

### 3. Subir os containers

```bash
docker compose up -d --build
```

Isso vai:
- ✅ Criar o banco PostgreSQL com todas as tabelas
- ✅ Compilar e iniciar o backend Express
- ✅ Fazer build do frontend React
- ✅ Configurar Nginx como proxy reverso

### 4. Criar o superadmin

```bash
# Acessar o container do banco
docker exec -it pblocker-db psql -U admin -d pblocker

# Dentro do psql, executar:
INSERT INTO users (email, password_hash, email_confirmed)
VALUES (
  'admin@pblocker.sistembr.com.br',
  crypt('SuaSenhaAdmin123!', gen_salt('bf', 12)),
  TRUE
);

INSERT INTO companies (name, type) VALUES ('PBLocker', 'employee');

INSERT INTO profiles (user_id, full_name, role, company_id, password_changed)
SELECT
  u.id, 'Administrador', 'superadmin',
  (SELECT id FROM companies LIMIT 1), TRUE
FROM users u WHERE u.email = 'admin@pblocker.sistembr.com.br';

\q
```

> Se o schema não tiver `crypt()`, use o script auxiliar abaixo.

---

## 🔒 Configurar HTTPS (SSL)

### Opção A — Certbot direto (recomendado para simplicidade)

```bash
# Instalar certbot
sudo apt install -y certbot python3-certbot-nginx

# No docker-compose.yml, mapeie a porta 443 do frontend:
# ports:
#   - "80:80"
#   - "443:443"

# Ou instale Nginx no host e use como proxy:
sudo apt install -y nginx

# Criar config do Nginx no host
sudo tee /etc/nginx/sites-available/pblocker << 'EOF'
server {
    listen 80;
    server_name pblocker.sistembr.com.br;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pblocker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Gerar certificado SSL
sudo certbot --nginx -d pblocker.sistembr.com.br --non-interactive --agree-tos -m admin@pblocker.sistembr.com.br
```

### Opção B — Traefik (HTTPS automático dentro do Docker)

No `docker-compose.yml`, descomente o serviço `traefik` e adicione labels ao frontend:

```yaml
frontend:
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.pblocker.rule=Host(`pblocker.sistembr.com.br`)"
    - "traefik.http.routers.pblocker.entrypoints=websecure"
    - "traefik.http.routers.pblocker.tls.certresolver=letsencrypt"
  # Remova os ports: do frontend quando usar Traefik
```

---

## 📋 Comandos úteis

```bash
# Ver status dos containers
docker compose ps

# Ver logs em tempo real
docker compose logs -f

# Logs só do backend
docker compose logs -f backend

# Reiniciar tudo
docker compose restart

# Rebuild após atualização do código
docker compose up -d --build

# Parar tudo
docker compose down

# Parar e APAGAR dados (⚠️ cuidado!)
docker compose down -v

# Acessar o banco
docker exec -it pblocker-db psql -U admin -d pblocker

# Acessar shell do backend
docker exec -it pblocker-api sh

# Backup do banco
docker exec pblocker-db pg_dump -U admin pblocker > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup.sql | docker exec -i pblocker-db psql -U admin -d pblocker
```

---

## 🔄 Atualizar o sistema

```bash
cd /opt/locker-system

# Puxar atualizações
git pull

# Rebuild e restart (sem perder dados)
docker compose up -d --build
```

---

## 🏗️ Arquitetura Docker

```
┌─────────────────────────────────────────────┐
│              VPS (76.13.165.156)            │
│                                             │
│  ┌──────────┐   ┌──────────┐   ┌─────────┐ │
│  │  Nginx   │──▶│ Backend  │──▶│ Postgres│ │
│  │ (React)  │   │ (Express)│   │  :5432  │ │
│  │  :80/443 │   │  :3001   │   │         │ │
│  └──────────┘   └──────────┘   └─────────┘ │
│   frontend       backend        postgres    │
│                                             │
│  Volumes: pgdata, uploads                   │
└─────────────────────────────────────────────┘
```

---

## ❓ Troubleshooting

| Problema | Solução |
|----------|---------|
| Container não sobe | `docker compose logs <serviço>` |
| Banco não conecta | Verifique `DB_PASSWORD` no `.env` |
| Frontend em branco | Verifique `VITE_API_URL` no build |
| 502 Bad Gateway | Backend ainda iniciando, aguarde |
| Sem HTTPS | Configure Certbot ou Traefik |
| Porta 80 ocupada | `sudo lsof -i :80` e pare o serviço |
