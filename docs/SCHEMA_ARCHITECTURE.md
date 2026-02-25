# CinePrompt AI - Enterprise Database Architecture

## Overview

Production-grade Prisma schema designed for **1M+ users**, **millions of video jobs**, heavy async processing, and SaaS monetization.

---

## 1. Entity Relationship Summary

```
User ──┬── UserProfile (1:1)
       ├── RefreshToken (1:n)
       ├── Wallet (1:1) ─── CreditLedgerEntry (1:n)
       │                  └── CreditUsageLog (1:n)
       ├── Transaction (1:n)
       ├── VideoJob (1:n) ─── JobStep (1:n)
       │                  └── VideoAsset (1:n)
       ├── UserSubscription (1:n) ─── SubscriptionPlan (n:1)
       ├── Payment (1:n)
       ├── ApiUsage (1:n)
       ├── Notification (1:n)
       ├── NotificationPreference (1:n)
       └── AuditLog (1:n)

Standalone: ErrorLog, SystemSettings, SystemMetrics
```

---

## 2. Table Descriptions

### Authentication & User

| Table | Purpose |
|-------|---------|
| **User** | Core identity. `credits` cached for fast reads; Wallet is source of truth. `provider` for OAuth. |
| **UserProfile** | Extended profile (bio, timezone, locale). Optional 1:1. |
| **RefreshToken** | JWT refresh tokens. `revokedAt` for invalidation. |

### Credit System (Immutable Ledger)

| Table | Purpose |
|-------|---------|
| **Wallet** | Per-user balance. `version` for optimistic locking. `totalCreditsIn/Out` for analytics. |
| **CreditLedgerEntry** | Append-only ledger. Every credit change creates an entry. `balanceAfter` for audit. |
| **CreditUsageLog** | Denormalized usage log for quick analytics per job/plan. |

### Video Processing Pipeline

| Table | Purpose |
|-------|---------|
| **VideoJob** | Main job record. `priority` for queue ordering. `retryCount`/`maxRetries` for resilience. |
| **JobStep** | Step-based pipeline: UPLOADED → QUEUED → AI_GENERATION → RENDERING → COMPLETED. Tracks retries, duration, errors. |
| **VideoAsset** | Output assets (video, thumbnail). Multiple per job. |

### Transactions & Payments

| Table | Purpose |
|-------|---------|
| **Transaction** | Legacy + new. Credits delta, type, reference to job/payment. |
| **SubscriptionPlan** | Plan definitions (price, credits, features). |
| **UserSubscription** | Active subscription. `currentPeriodStart/End`, `externalId` for Stripe. |
| **Payment** | Payment provider records. `providerId` for idempotency. |

### Analytics & Monitoring

| Table | Purpose |
|-------|---------|
| **ApiUsage** | Per-request usage (endpoint, duration, credits). |
| **Notification** | User notifications. `readAt` for read state. |
| **NotificationPreference** | Per-channel, per-type preferences. |
| **ErrorLog** | Application errors. `severity`, `context` for debugging. |
| **AuditLog** | Admin actions. `oldValue`/`newValue` for audit trail. |
| **SystemMetrics** | Time-series metrics for dashboards. |
| **SystemSettings** | Key-value config (feature flags, limits). |

---

## 3. Video Processing Pipeline

### JobStepType Enum Flow

```
UPLOADED → QUEUED → PROCESSING → AI_GENERATION → RENDERING → UPLOADING → COMPLETED
                                                                    ↘ FAILED
```

### Retry Strategy

- `JobStep.retryCount` / `maxRetries` per step
- `VideoJob.retryCount` / `maxRetries` for full job
- `error`, `errorCode` for debugging
- `durationMs` for performance monitoring

### Query Patterns

```sql
-- Next job to process (queue)
SELECT * FROM "VideoJob"
WHERE status = 'QUEUED'
ORDER BY priority DESC, createdAt ASC
LIMIT 1;

-- Job steps for a job
SELECT * FROM "JobStep"
WHERE "jobId" = $1
ORDER BY "stepOrder";
```

---

## 4. Credit System Design

### Ledger Pattern

1. **Deduct**: Insert negative `CreditLedgerEntry`, update `Wallet.balance`
2. **Refund**: Insert positive `CreditLedgerEntry`, update `Wallet.balance`
3. **Audit**: Full history in `CreditLedgerEntry` with `balanceAfter`

### Atomic Operations

Use Prisma `$transaction` for:

- Wallet update + CreditLedgerEntry insert
- VideoJob create + Wallet deduct + Transaction create

### Optimistic Locking

`Wallet.version` increments on each update. Use for concurrent credit operations.

---

## 5. Indexing Strategy

### Composite Indexes (Critical)

| Index | Use Case |
|-------|----------|
| `VideoJob(status, priority, createdAt)` | Queue processing |
| `VideoJob(userId, createdAt)` | User history |
| `CreditLedgerEntry(walletId, createdAt)` | Ledger history |
| `ApiUsage(userId, createdAt)` | Usage analytics |
| `Notification(userId, readAt)` | Unread count |
| `SystemMetrics(metric, timestamp)` | Time-series queries |

### Single-Column Indexes

- Foreign keys (auto-indexed by Prisma)
- `email`, `provider`, `status`, `createdAt` for filters
- `referenceId` for lookups

### Partitioning (Future)

For 1M+ jobs, consider **time-based partitioning** on `VideoJob.createdAt`:

```sql
-- Example: Monthly partitions
CREATE TABLE "VideoJob_2025_02" PARTITION OF "VideoJob"
FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

---

## 6. Scalability Notes

### Read Scaling

- **Read replicas**: Route analytics (ApiUsage, SystemMetrics) to replicas
- **Connection pooling**: PgBouncer or Prisma Accelerate
- **Caching**: Redis for `Wallet.balance`, `User.credits`

### Write Scaling

- **Queue workers**: BullMQ workers update JobStep, VideoJob
- **Batch inserts**: ApiUsage, ErrorLog — batch every N seconds
- **Async**: Notifications, AuditLog via queue

### Data Retention

- **ApiUsage**: Aggregate daily, archive after 90 days
- **ErrorLog**: Archive after 30 days
- **CreditLedgerEntry**: Keep forever (audit)
- **VideoJob**: Soft delete or archive completed jobs after 1 year

---

## 7. Performance Tips

1. **Select only needed fields** — avoid `select: true` on large tables
2. **Pagination** — use `cursor`-based for large lists (VideoJob, CreditLedgerEntry)
3. **Avoid N+1** — use `include` or `findMany` with `where: { id: { in: [...] } }`
4. **Background jobs** — move heavy writes (metrics, usage) to workers
5. **Connection pool** — tune `connection_limit` for your workload

---

## 8. Migration Notes

- **User.credits** retained for backward compatibility; Wallet is source of truth
- **Wallet** backfilled from `User.credits` during migration
- **provider** kept as `String` for OAuth compatibility
- **Transaction.type** kept as `String`; use `TransactionType` enum in app layer

---

## 9. Next Steps

1. Update `creditService.js` to use Wallet + CreditLedgerEntry
2. Implement JobStep pipeline in video worker
3. Add SubscriptionPlan seed data
4. Create admin API for SystemMetrics, ErrorLog, AuditLog
5. Add notification service using Notification + NotificationPreference
