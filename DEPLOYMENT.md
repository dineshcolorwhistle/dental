# Dental Lab Management System — Staging Server Deployment Guide

This guide details the step-by-step process of setting up and deploying the Dental Lab Management System on a fresh Linux staging server (Ubuntu 22.04/24.04 LTS is assumed).

---

## 1. System Requirements & Package Installation

Log in to your staging VPS server via SSH and update package repositories:

```bash
sudo apt update && sudo apt upgrade -y
```

Install common required tools:

```bash
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx redis-server
```

### Install Node.js (v22.x LTS recommended)

Add the NodeSource repository and install Node.js:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node -v
npm -v
```

---

## 2. PostgreSQL Installation & Configuration

### Step 2.1: Install PostgreSQL

Install PostgreSQL database server and contrib packages:

```bash
sudo apt install -y postgresql postgresql-contrib
```

Verify the service is running:

```bash
sudo systemctl status postgresql
```

### Step 2.2: Set Up Database & User

Log in as the `postgres` system user and access the PostgreSQL prompt:

```bash
sudo -i -u postgres psql
```

Create a new PostgreSQL database and database user with password (make sure to replace placeholders or match the credentials specified in your backend `.env` file):

```sql
-- Create database
CREATE DATABASE dental_lab;

-- Create database user
CREATE USER dental_user WITH PASSWORD 'YourSecurePasswordHere';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE dental_lab TO dental_user;

-- Allow schema operations for Prisma (needed for PostgreSQL 15+)
\c dental_lab
GRANT ALL ON SCHEMA public TO dental_user;

-- Exit the prompt
\q
exit
```

### Step 2.3: Update Host Access Config (Optional/Security)

By default, PostgreSQL only listens on `localhost` (127.0.0.1). Since the backend application and the database run on the same staging server, this default config is correct and secure. Do not expose port 5432 to the public internet.

---

## 3. Redis Installation & Configuration

### Step 3.1: Verify Redis Installation

Ensure the Redis service is active and running:

```bash
sudo systemctl status redis-server
```

If it is not running, start it:

```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Step 3.2: Secure Redis for Production

By default, Redis binds to `localhost` (`127.0.0.1` and `::1`), which is secure and correct since both NestJS and Redis run on the same server. Do not expose Redis port `6379` to the public internet.

To configure a secure password:

1. Open the configuration file:
   ```bash
   sudo nano /etc/redis/redis.conf
   ```
2. Find the directive `# requirepass foobared`, uncomment it, and set a strong password:
   ```conf
   requirepass YourSecureRedisPasswordHere
   ```
3. Set the supervisor to systemd:
   ```conf
   supervised systemd
   ```
4. Save and close the file, then restart Redis to apply changes:
   ```bash
   sudo systemctl restart redis-server
   ```

---

## 4. Application Setup & Environment Configuration

Assuming you have cloned the GitHub repository to `/home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental`:

```bash
sudo mkdir -p /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental
sudo chown -R $USER:$USER /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental
```

### Step 4.1: Configure Backend Environment

Navigate to the `backend` folder and configure the `.env` file:

```bash
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/backend
cp .env.example .env
nano .env
```

Ensure the parameters match your environment:

```env
# Database (Update user, password, and host/port/dbname)
DATABASE_URL="postgresql://dental_user:YourSecurePasswordHere@localhost:5432/dental_lab?schema=public"

# JWT
JWT_ACCESS_SECRET="generate-a-long-random-string-here"
JWT_REFRESH_SECRET="generate-another-long-random-string-here"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# App
PORT=7500
NODE_ENV=production
CORS_ORIGIN="https://staging.yourdomain.com"
FRONTEND_URL="https://staging.yourdomain.com"

# Super Admin Seed Configuration
SUPER_ADMIN_EMAIL="admin@dental.com"
SUPER_ADMIN_PASSWORD="YourSuperAdminSecurePassword"
SUPER_ADMIN_FIRST_NAME="Super"
SUPER_ADMIN_LAST_NAME="Admin"

# Set this to true to ONLY seed the Super Admin (skips local mock data)
SEED_ONLY_SUPER_ADMIN=true
# SMTP (Configure for password resets and notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"
SMTP_FROM="Dental Lab <your-email@gmail.com>"

# Redis (Used by BullMQ for background job processing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD="YourSecureRedisPasswordHere"

# VAPID Keys for Web Push Notifications
VAPID_PUBLIC_KEY="YOUR_GENERATED_PUBLIC_KEY"
VAPID_PRIVATE_KEY="YOUR_GENERATED_PRIVATE_KEY"
VAPID_SUBJECT="mailto:your-email@yourdomain.com"
```

### Step 4.2: Configure Frontend Environment

Navigate to the `frontend` folder and configure the `.env` file:

```bash
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/frontend
cp .env.example .env
nano .env
```

Ensure the backend API URL matches the production staging domain, and optionally set the fallback public VAPID key:

```env
VITE_API_URL="https://staging.yourdomain.com/api"
VITE_IDLE_TIMEOUT=3600000
VITE_VAPID_PUBLIC_KEY="YOUR_GENERATED_PUBLIC_KEY"
```

### Step 4.3: Generate and Configure VAPID Keys

Web Push notifications require a VAPID keypair (public and private key) to authenticate your application server with push notification service providers.

1. **Generate the Keys**:
   You can generate a new VAPID keypair using one of the following methods:

   * **Option A: Using the project's custom npm script (Recommended)**
     ```bash
     cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/backend
     npm run vapid:generate
     ```
   * **Option B: Using `npx web-push` directly**
     ```bash
     npx web-push generate-vapid-keys
     ```
   
   Either command will output a `Public Key` and a `Private Key` printed to the console.

2. **Insert into `.env`**:
   Add the public key, private key, and a contact email/website URL (`VAPID_SUBJECT`) to your backend `.env` file, and optionally the public key to your frontend `.env` file.

3. **Verify Configuration**:
   When you start/restart the backend, check the logs to verify VAPID initialization:
   ```bash
   pm2 logs dental-backend
   ```
   Look for the log output:
   `VAPID details configured successfully.`



---

## 5. Run Database Migrations & Seeding

Install dependencies and run Prisma commands on the backend:

```bash
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/backend
npm install

# Run database migrations (apply schema changes)
npx prisma migrate deploy

# Seed the database (will read .env and only seed Super Admin)
npm run seed
```

---

## 6. Process Management with PM2 (Backend)

Install **PM2** globally to manage the backend Node.js process:

```bash
sudo npm install -g pm2
```

Build the NestJS backend application:

```bash
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/backend
npm run build
```

Start the backend application with PM2:

```bash
pm2 start dist/main.js --name "dental-backend"
```

Configure PM2 to automatically start the backend application on server boot:

```bash
pm2 startup
```
*(Copy and paste the command generated by the output of `pm2 startup` into the terminal to run it as root.)*

Save the current running process list:

```bash
pm2 save
```

Verify status:
```bash
pm2 status
```

---

## 7. Frontend Compilation & Web Server Configuration (Nginx)

### Step 7.1: Build Frontend Assets

Navigate to the `frontend` directory, install dependencies, and build the static assets:

```bash
cd /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/frontend
npm install
npm run build
```

The compiled static files are generated under `/home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/frontend/dist`.

### Step 7.2: Configure Nginx

Create a new Nginx server configuration block:

```bash
sudo nano /etc/nginx/sites-available/dental-lab
```

Paste the configuration block below (replace `staging.yourdomain.com` with your domain name or staging IP address). Make sure to include the `location /socket.io` proxy block so real-time features work properly:

```nginx
server {
    listen 80;
    server_name staging.yourdomain.com;

    # Frontend Static Site
    location / {
        root /home/agentwhistle-dental/htdocs/dental.agentwhistle.com/dental/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://localhost:7500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Rewrite API prefix if backend does not use /api route prefix
        # rewrite ^/api/(.*)$ /$1 break;
    }

    # Socket.IO WebSocket Proxy (Critical for real-time dashboard events and notifications)
    location /socket.io {
        proxy_pass http://localhost:7500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend Swagger Docs (Optional)
    location /api-docs {
        proxy_pass http://localhost:7500/api-docs;
        proxy_set_header Host $host;
    }
}
```

Enable the configuration and disable the default site:

```bash
sudo ln -s /etc/nginx/sites-available/dental-lab /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

Test the Nginx config and restart:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## 8. SSL Certificate Setup with Let's Encrypt

Secure the connection with HTTPS using `certbot`:

```bash
sudo certbot --nginx -d staging.yourdomain.com
```

Follow the interactive prompts to configure SSL. Certbot will automatically rewrite the Nginx virtual host configuration to use SSL and redirect HTTP traffic to HTTPS.

Verify automatic renewal:

```bash
sudo certbot renew --dry-run
```

---

## 9. Troubleshooting Checklist

1. **Database connection issues**: Ensure PostgreSQL is running (`sudo systemctl status postgresql`) and test access manually:
   ```bash
   psql -h localhost -U dental_user -d dental_lab
   ```
2. **Backend logs**: Use PM2 logs to inspect errors in runtime (e.g., BullMQ failing to connect to Redis):
   ```bash
   pm2 logs dental-backend
   ```
3. **Redis connection issues**: Verify Redis service is running (`sudo systemctl status redis-server`). Check that the connection variables in `backend/.env` (especially `REDIS_PASSWORD`) match the password configured in `/etc/redis/redis.conf`.
4. **Nginx configuration errors**: Inspect Nginx access and error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```
5. **CORS issues**: Ensure the backend `.env` variables `CORS_ORIGIN` and `FRONTEND_URL` exactly match the frontend staging domain (including `https://` protocol).
6. **Socket.IO connection issues (fallback or handshake failure)**: Ensure that Nginx configuration includes the `location /socket.io` proxy block with `Connection "Upgrade"` headers. Without it, WebSocket connections will fail.
