#!/bin/bash
set -e

echo "📦 Instalando Nginx e Certbot..."
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

echo "📝 Criando configuração do site..."
sudo tee /etc/nginx/sites-available/pblocker << 'EOF'
server {
    listen 80;
    server_name pblocker.sistembr.com.br;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "🔗 Ativando site..."
sudo ln -sf /etc/nginx/sites-available/pblocker /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "🔄 Recarregando Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Nginx configurado! Para SSL, execute:"
echo "   sudo certbot --nginx -d pblocker.sistembr.com.br"
