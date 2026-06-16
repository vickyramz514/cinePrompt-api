# Debugging production (Railway)

## Find logs for a failed request

1. Open [Railway](https://railway.app) → your project → **cineprompt-api** service.
2. Go to **Deployments** → latest deployment → **View logs** (or **Observability** → Logs).
3. Reproduce the error (e.g. click **Regenerate** on API Keys).
4. In logs, search for:
   - `api-keys/regenerate failed`
   - The **`errorId`** from the JSON response (e.g. `"errorId": "a1b2c3d4e5f6"`)

Every error response now includes `errorId` so you can match browser ↔ server logs.

## Common fix: `/api/api-keys/regenerate` → 500

Usually one of these on Railway:

### 1. Missing `ApiKeySecret` table

**Symptom:** Response code `DB_MIGRATION_REQUIRED`, or startup log:

`Startup: ApiKeySecret table missing`

**Fix** (from your machine, with production `DATABASE_URL`):

```bash
cd cinePrompt-api
DATABASE_URL="postgresql://..." npm run db:migrate:prod
```

Or one-off:

```bash
DATABASE_URL="postgresql://..." npm run db:api-key-secrets
```

Or set Railway **Start Command** to:

```bash
npm run start:prod
```

(`prisma migrate deploy` then starts the server.)

### 2. Missing encryption secret

**Symptom:** Code `CONFIG_ERROR`, hint mentions `API_KEY_ENCRYPTION_SECRET`.

**Fix:** In Railway → **Variables**, add:

```env
API_KEY_ENCRYPTION_SECRET=<long random string, 32+ chars>
```

Use the **same** value across deploys (if it changes, old encrypted keys cannot be decrypted).

Redeploy after saving variables.

### 3. Outdated `api_keys.key_prefix` column

**Symptom:** `DB_MIGRATION_REQUIRED` mentioning `key_prefix`.

**Fix:** Same as (1) — run `npm run db:migrate:prod`.

## Temporarily show error details in API responses

For debugging only (not long-term in production):

```env
EXPOSE_API_ERRORS=true
```

Redeploy. Responses will include `details` with the raw error message. Remove when done.

## Health check after deploy

1. Railway logs should show:
   - `Startup: API key encryption OK`
   - `Startup: ApiKeySecret table OK`
2. Call `GET https://datacaptain.up.railway.app/api/health` → `{ "status": "ok" }`
3. Retry `POST /api/api-keys/regenerate` with a valid JWT.

## Razorpay webhook (production)

1. Razorpay Dashboard → **Webhooks** → URL:
   `https://datacaptain.up.railway.app/api/payment/webhook`
2. Railway → **Variables** → `RAZORPAY_WEBHOOK_SECRET` must match the secret in Razorpay (same mode as `RAZORPAY_KEY_ID`: test vs live).
3. Optional: `PUBLIC_API_URL=https://datacaptain.up.railway.app` (logged at startup as the expected webhook base).
4. After deploy, Railway logs should include:
   `Razorpay webhook URL (configure in Dashboard → Webhooks)`
5. Test: complete a subscription checkout; plan should update on `/api/auth/me` within seconds. If not, check Railway logs for `Invalid webhook` or missing secret warnings.
