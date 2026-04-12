# Corphia AI Platform - Security & Deployment Guide

This document provides advanced security guidelines and production deployment best practices for the Corphia AI Platform backend.

## 1. Environment Variable Security

### High Entropy SECRET_KEY
The application requires a secure `SECRET_KEY` to sign JWT tokens. In a production environment (`app_env="production"`), the backend will refuse to start if the default secret key is used.

**To generate a secure key:**
```bash
python scripts/generate_key.py
```
Copy the generated 32-bye (hex) string and place it in your `.env` file:
```env
SECRET_KEY="<YOUR_GENERATED_SECRET_KEY>"
APP_ENV="production"
```

## 2. HTTPS / TLS Encryption

For production deployments, the application should always be served over HTTPS. You can configure TLS directly via Uvicorn or by using a reverse proxy (recommended).

### Option A: Reverse Proxy with Nginx (Recommended)
Using a reverse proxy provides better performance, static file caching, and simplified certificate management using Let's Encrypt.

**Example Nginx Configuration (`/etc/nginx/sites-available/corphia`):**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # HSTS Header (Force HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Upgrade
    location /api/v1/ws {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Option B: Caddy (Simplest)
Caddy automatically handles Let's Encrypt SSL generation and renewal.

**Caddyfile Example:**
```caddyfile
api.yourdomain.com {
    reverse_proxy 127.0.0.1:8000
    header Strict-Transport-Security "max-age=31536000; includeSubDomains;"
}
```

### Option C: Uvicorn with Self-Signed Certificates (Internal testing)
Generate certificates:
```bash
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
```
Run Uvicorn:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-keyfile key.pem --ssl-certfile cert.pem
```

## 3. Data Protection & Encryption

### File Uploads (At-Rest)
When using the local filesystem (`uploads/`), data is not automatically encrypted at rest. For high-security deployments:
1.  **OS-Level**: Use Full Disk Encryption (e.g., LUKS for Linux, BitLocker for Windows).
2.  **Cloud-Level**: Use encrypted EBS volumes (AWS) or Managed Disks (Azure) with customer-managed keys (CMK).
3.  **App-Level (Future)**: The backend provides validation constraints (`MaxUploadSizeMiddleware`), and strict checking against MIME types is in place.

### Database Connection (In-Transit)
If migrating from SQLite to **PostgreSQL**, ensure the connection string enforces SSL.
```env
DATABASE_URL="postgresql+asyncpg://user:password@host:port/dbname?ssl=require"
```

## 4. Input Validation & Injection Avoidance

*   **SQL Injection**: Corphia relies on SQLAlchemy ORM and prepared statements, heavily mitigating SQLi. Avoid using raw `text()` execution dynamically.
*   **XSS (Cross-Site Scripting)**: The backend will faithfully return uploaded data. The React frontend is responsible for sanitizing Markdown output before rendering using libraries like `DOMPurify`.
*   **CORS**: In `development`, CORS defaults to broader acceptance. In `production`, you MUST set `CORS_ORIGINS` accurately in the `.env` file to prevent CSRF and external scraping.
