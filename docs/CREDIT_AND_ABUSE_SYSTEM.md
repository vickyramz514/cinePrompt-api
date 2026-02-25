# Credit & Abuse Prevention System

## Overview

Enterprise-grade system for safe credit deduction, cost monitoring, and abuse prevention.

## Request Flow

```
Auth → AbuseGuard → CreditGuard → Create Job + Lock → Queue → Worker
                                                          ↓
                                              Success: Consume Lock + Deduct + Log Cost
                                              Failure: Release Lock (no deduction)
```

## Credit Lock Flow

1. **Before job**: `abuseGuard` + `creditGuard` validate
2. **Job creation**: Create `VideoJob` + `CreditLock` (status: LOCKED) in same transaction
3. **Queue**: Job pushed to BullMQ
4. **Worker success**: `consumeCreditLock` → deduct wallet, mark CONSUMED
5. **Worker failure**: `releaseCreditLock` → no deduction, mark RELEASED

## Abuse Checks

| Check | Limit | Config |
|-------|-------|--------|
| Daily requests | 10/day | `ABUSE_MAX_REQUESTS_DAY` |
| Concurrent jobs | 1 active | Hardcoded |
| Prompt spam | 3 same prompt in 1 min | `PROMPT_SPAM_THRESHOLD`, `PROMPT_SPAM_WINDOW_MS` |
| Daily videos | Plan-based | `PLAN_LIMIT_*` |

## Plan Limits (videos/day)

- FREE: 1
- STARTER: 2
- CREATOR: 4
- ULTRA: 6

## Cost Monitoring

- Every completed job logged to `ApiCostLog`
- Cost = seconds × provider_rate (USD)
- Rates: `RUNWAY_COST_PER_SECOND`, `REPLICATE_COST_PER_SECOND`

## Analytics APIs (Admin only)

| Endpoint | Description |
|----------|-------------|
| GET /api/analytics/overview | Revenue, cost, profit, users, jobs |
| GET /api/analytics/usage-trends | Daily jobs + seconds |
| GET /api/analytics/api-cost | Daily/monthly cost by provider |
| GET /api/analytics/top-users | Highest usage users |
| GET /api/analytics/profit-metrics | Revenue - cost trends |

## Environment Variables

See `env.example` for full list. Key additions:

```
CREDIT_COST_PER_VIDEO=5
MAX_VIDEO_SECONDS=5
MAX_RESOLUTION=720p
PLAN_LIMIT_STARTER=2
PLAN_LIMIT_ULTRA=6
ABUSE_MAX_REQUESTS_DAY=10
REPLICATE_COST_PER_SECOND=0.02
```
