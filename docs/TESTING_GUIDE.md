# Testing Guide - Credit, Abuse & Analytics

## Prerequisites

1. **Backend running**: `npm run dev` (port 4000)
2. **Worker running**: `npm run worker` (or `node src/workers/videoWorker.js`)
3. **Redis running**: For rate limits and queue
4. **Auth token**: Login via `/api/auth/login` or Google OAuth to get JWT

## 1. Get Auth Token

```bash
# Login (replace with your credentials)
curl -X POST http://localhost:4000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Or use Google OAuth from frontend, then copy token from localStorage
# key: cineprompt_access_token
```

## 2. Test Video Generation (Full Flow)

```bash
# Replace YOUR_JWT with actual token
TOKEN="YOUR_JWT"

# Success - should return 202 and queue job
curl -X POST http://localhost:4000/v1/video/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cinematic sunset over mountains","duration":5}'
```

**What to verify:**
- 202 response with job id
- 401 if no token
- 402 if insufficient credits
- 429 if abuse (rate limit, concurrent job, daily cap, prompt spam)

## 3. Test Abuse Limits

| Test | How to trigger | Expected |
|------|----------------|----------|
| **Concurrent job** | Send 2 generate requests quickly (don't wait for first to complete) | 2nd returns 429 |
| **Daily cap** | Generate N+1 videos where N = plan limit | 429 on excess |
| **Rate limit** | 11+ requests in a day | 429 after 10th |
| **Prompt spam** | Same prompt 3 times in 1 min | 429 on 3rd |

## 4. Test Analytics APIs (Admin only)

First, ensure you have an admin user. Update in DB:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

Then:

```bash
TOKEN="YOUR_ADMIN_JWT"

# Overview
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/v1/analytics/overview"

# Usage trends (last 30 days)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/v1/analytics/usage-trends?days=30"

# API cost
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/v1/analytics/api-cost?days=30"

# Top users
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/v1/analytics/top-users?limit=10"

# Profit metrics
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/v1/analytics/profit-metrics?days=30"
```

Non-admin users get **403 Forbidden**.

## 5. Quick Test Script

```bash
# Save as test-flows.sh

API="http://localhost:4000/v1"
TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "Usage: ./test-flows.sh YOUR_JWT_TOKEN"
  exit 1
fi

echo "1. Testing video generate..."
curl -s -X POST "$API/video/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Test video generation","duration":5}' | jq .

echo "2. Testing analytics (admin only)..."
curl -s -H "Authorization: Bearer $TOKEN" "$API/analytics/overview" | jq .
```

## 6. Frontend Integration

No changes needed for basic flow. The frontend already:
- Calls `POST /v1/video/generate` with auth
- Handles 402 (insufficient credits)
- Handles 429 (rate limit) - you may want to show a user-friendly message

**Optional**: Add an analytics dashboard page that calls `/api/analytics/*` for admin users.
