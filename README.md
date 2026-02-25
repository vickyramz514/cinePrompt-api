# CinePrompt AI — Backend

Production-grade backend for the CinePrompt AI video generation SaaS platform.

## Tech Stack

- **Node.js** + **Express.js**
- **Prisma ORM** + **PostgreSQL**
- **Redis** + **BullMQ** (job queue)
- **JWT** authentication
- **S3 / Cloudflare R2** storage
- **Replicate** API (AI video generation)

## Features

- Auth (signup, login, JWT, refresh token)
- User + credit system (atomic transactions)
- Video job queue (BullMQ)
- Replicate AI integration
- S3/R2 storage with signed URLs
- Rate limiting, Helmet, CORS
- Input validation (Zod)

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user (protected) |

### Video
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/video/generate` | Submit video job |
| GET | `/api/video/history` | Job history |
| GET | `/api/video/:id` | Job details + download URL |

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/balance` | Credit balance |
| POST | `/api/wallet/add` | Add credits (mock payment) |

## Setup

```bash
# Install
npm install

# Copy env
cp env.example .env
# Edit .env with your values

# Start PostgreSQL + Redis (Docker)
docker-compose up -d

# Database
npm run db:generate
npm run db:migrate

# Optional: seed
npx prisma db seed
```

## Run

```bash
# API server
npm run dev

# Worker (separate process)
npm run dev:worker
```

## Project Structure

```
src/
├── config/         # Centralized config
├── controllers/     # Route handlers
├── middlewares/     # Auth, error, validation
├── queues/         # BullMQ queue setup
├── routes/         # API routes
├── services/       # Auth, storage, credits, Replicate
├── utils/          # Logger, errors, prisma
├── workers/        # Video generation worker
└── server.js       # Entry point
```

## Environment

- **PostgreSQL** required
- **Redis** required for queue
- **Replicate** token for AI video generation
- **S3/R2** for video storage (optional for local dev)
# cinePrompt-api
