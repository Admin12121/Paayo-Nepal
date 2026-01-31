# Tourism Platform 🏔️

Modern, full-stack tourism platform built with Next.js 16, Rust, and MySQL.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- (Optional) Bun 1.1.45+ for local development

### 1. Setup Environment
```bash
cp .env.development .env
```

### 2. Start All Services
```bash
# Start development environment
docker compose up -d

# View logs
docker compose logs -f
```

### 3. Initialize Database
```bash
# Wait 30 seconds for services to be healthy, then:
docker compose exec frontend bun run db:push
```

### 4. Create Admin User
```bash
# Access MySQL
docker compose exec mysql mysql -u tourism -ptourism_dev_password tourism

# Run this SQL (replace email with yours)
INSERT INTO user (id, email, emailVerified, name, role, createdAt, updatedAt)
VALUES (UUID(), 'admin@example.com', NOW(), 'Admin', 'admin', NOW(), NOW());
EXIT;
```

### 5. Access Application
- **Website**: http://localhost
- **Frontend Direct**: http://localhost:3000  
- **Backend API**: http://localhost:8080/api
- **Database Studio**: `cd tour_frontend && bun run db:studio`

Register at http://localhost/register with the admin email you created.

---

## 📦 Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Next.js + React | 16.1.4 / 19.2.3 |
| Runtime | Bun | 1.1.45 |
| UI | Tailwind CSS | 4.0 |
| Editor | Lexical | 0.12.6 |
| Auth | Better Auth | 1.2.0 |
| ORM | Drizzle | 0.44.0 |
| Backend | Rust + Axum | 1.85 / 0.7 |
| Database | MariaDB | 11.5 |
| Cache | Redis | 7.4 |
| Proxy | Nginx | 1.27 |
| Testing | Vitest | 2.1.8 |

---

## 📁 Project Structure

```
tourism/
├── tour_frontend/          # Next.js app (Bun)
│   ├── app/                # App Router pages
│   ├── components/         # React components
│   ├── lib/
│   │   ├── db/schema/      # Drizzle schemas
│   │   └── auth.ts         # Better Auth config
│   ├── package.json        # Bun package manager
│   ├── vitest.config.ts    # Test configuration
│   └── Dockerfile          # Multi-stage build
│
├── tour_backend/           # Rust API
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── config/         # Settings, CORS
│   │   ├── routes/         # API routes
│   │   ├── handlers/       # Request handlers
│   │   ├── services/       # Business logic
│   │   └── middleware/     # Auth, rate limiting
│   ├── Cargo.toml          # Dependencies
│   └── Dockerfile          # Optimized build
│
├── docker/
│   ├── nginx/              # Reverse proxy config
│   ├── mysql/              # DB initialization
│   └── redis/              # Cache config
│
├── docker-compose.yml      # Unified dev/prod setup
├── .env.development        # Dev environment
├── .env.production         # Prod environment (template)
└── README.md               # This file
```

---

## 🛠️ Development

### Frontend Scripts
```bash
cd tour_frontend

bun install              # Install dependencies
bun run dev              # Start dev server
bun run build            # Build for production
bun run lint             # Run ESLint
bun run format           # Format with Prettier
bun run test             # Run tests
bun run type-check       # TypeScript check

# Database
bun run db:push          # Push schema changes
bun run db:studio        # Open Drizzle Studio
bun run db:generate      # Generate migrations
```

### Backend Scripts
```bash
cd tour_backend

cargo run                # Run development server
cargo build --release    # Build for production
cargo test               # Run tests
cargo watch -x run       # Watch mode (needs cargo-watch)
cargo clippy             # Lint
```

### Docker Commands
```bash
# Start all services
docker compose up -d

# Start with production profile (includes Nginx)
docker compose --profile prod up -d

# View logs
docker compose logs -f
docker compose logs -f backend      # Specific service

# Restart service
docker compose restart backend

# Rebuild after code changes
docker compose build
docker compose up -d

# Stop all
docker compose down

# Stop and remove all data (⚠️ WARNING)
docker compose down -v
```

---

## 🔐 Security Features

### Authentication (Better Auth)
- Email/Password with bcrypt
- Google OAuth (optional)
- WebAuthn/Passkey support
- TOTP 2FA ready
- Session-based with secure cookies

### Authorization
- **Admin**: Full control, user management, content approval
- **Editor**: Create/edit content, upload media
- **User**: View content, comment, like

### CORS Protection
- Configured allowed origins
- Credentials support
- Method whitelisting

### Rate Limiting (Nginx - Production)
- API: 10 req/s (burst 20)
- Upload: 1 req/s (burst 5)
- Auth: 5 req/s (burst 10)

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin

---

## 📊 Database Management

### Migrations (Drizzle)
Drizzle ORM owns ALL database migrations. Rust backend reads but never modifies schema.

```bash
cd tour_frontend

# Modify schema in lib/db/schema/*.ts

# Push changes to database (dev)
bun run db:push

# Or generate migration file (prod)
bun run db:generate
bun run db:migrate
```

### Backup & Restore
```bash
# Backup
docker compose exec mysql mysqldump -u tourism -ptourism_dev_password tourism > backup.sql

# Restore
docker compose exec -i mysql mysql -u tourism -ptourism_dev_password tourism < backup.sql
```

---

## 🎨 Image Optimization

### Upload Process
1. User uploads image (JPEG, PNG, WebP, GIF)
2. Rust backend processes:
   - Resizes to max 1920px width
   - Converts to AVIF (50% smaller than JPEG)
   - Generates 400px thumbnail
   - Creates blur hash placeholder
3. Stores in `/uploads` volume
4. Saves metadata to database

### Frontend Display
- Next.js `<Image>` component
- Blur placeholders for instant loading
- Responsive sizes: 640, 750, 828, 1080, 1200, 1920
- Lazy loading

---

## 🚀 Production Deployment

### 1. Update Environment
```bash
cp .env.production .env

# Generate secure secret
openssl rand -base64 32

# Edit .env and set:
# - BETTER_AUTH_SECRET (generated above)
# - DATABASE_PASSWORD (strong password)
# - MYSQL_ROOT_PASSWORD (strong password)
# - REDIS_PASSWORD (strong password)
# - NEXT_PUBLIC_APP_URL (your domain)
# - CORS_ALLOWED_ORIGINS (your domain)
```

### 2. SSL Certificates
Place certificates in `docker/nginx/ssl/`:
- `fullchain.pem`
- `privkey.pem`

Update `docker/nginx/conf.d/default.conf` for HTTPS.

### 3. Deploy
```bash
# Build with production target
BUILD_TARGET=production docker compose --profile prod up -d --build

# View logs
docker compose logs -f

# Check health
docker compose ps
```

### 4. Initialize Database
```bash
docker compose exec frontend bun run db:push

# Create admin user (same as development)
```

---

## 🧪 Testing

```bash
cd tour_frontend

# Run tests
bun run test

# Watch mode
bun run test:watch

# With UI
bun run test:ui

# Coverage report
bun run test:coverage
```

---

## 📝 Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_PASSWORD` | MySQL user password | `secure_pass_123` |
| `MYSQL_ROOT_PASSWORD` | MySQL root password | `root_secure_pass` |
| `REDIS_PASSWORD` | Redis password | `redis_secure_pass` |
| `BETTER_AUTH_SECRET` | Auth secret (32+ chars) | `openssl rand -base64 32` |

### Optional
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost` | Comma-separated allowed origins |
| `MAX_UPLOAD_SIZE` | `52428800` | Max upload size in bytes (50MB) |
| `MAX_IMAGE_WIDTH` | `1920` | Max image width in pixels |
| `THUMBNAIL_WIDTH` | `400` | Thumbnail width in pixels |
| `RUST_LOG` | `debug` | Rust logging level (debug/info/warn/error) |

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check MySQL is healthy
docker compose ps mysql

# View logs
docker compose logs mysql

# Restart
docker compose restart mysql
```

### Frontend Build Errors
```bash
# Clear cache
cd tour_frontend
rm -rf .next node_modules
bun install
docker compose build frontend
docker compose up -d frontend
```

### Backend Not Starting
```bash
# View logs
docker compose logs backend

# Rebuild
docker compose build backend --no-cache
docker compose up -d backend
```

---

## 📖 API Documentation

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/posts` - List posts (paginated)
- `GET /api/posts/:slug` - Get post by slug
- `GET /api/events` - List events
- `GET /api/regions` - List regions
- `GET /api/attractions` - List attractions
- `GET /api/activities` - List activities
- `GET /api/search?q=query` - Global search

### Protected Endpoints (requires auth)
- `POST /api/posts` - Create post (editor+)
- `PUT /api/posts/:slug` - Update post (author/admin)
- `DELETE /api/posts/:slug` - Delete post (admin)
- `POST /api/posts/:id/approve` - Approve post (admin)
- `POST /api/media` - Upload image (editor+)
- `POST /api/posts/:id/comments` - Add comment
- `POST /api/comments/:id/like` - Like comment

---

## 🎯 Performance

### Caching Strategy
```
Layer 1: Nginx (5min API cache, 1yr static)
    ↓
Layer 2: Next.js (ISR + unstable_cache)
    ↓
Layer 3: Redis (5-15min API responses)
    ↓
Layer 4: Database (connection pooling)
```

### Redis Cache Keys
- `post:slug:{slug}` - 5 minutes
- `posts:list:{page}:{limit}` - 5 minutes
- `attractions:top` - 15 minutes
- `gallery:{page}:{limit}` - 10 minutes

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - See LICENSE file for details.

---

## 🙏 Support

- **Issues**: Create an issue in the repository
- **Documentation**: Check this README
- **Troubleshooting**: See troubleshooting section above

---

**Built with ❤️ using modern web technologies**

Bun + Next.js 16 + React 19 + Rust + Axum + MariaDB + Redis + Docker
