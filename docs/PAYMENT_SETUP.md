# Payment & Subscription Setup

## Overview

CinePrompt uses **Razorpay** for subscription billing in India. The flow:

1. User selects a plan on Pricing or Wallet page
2. Backend creates a Razorpay subscription and returns checkout URL
3. User completes payment on Razorpay hosted page
4. Razorpay sends webhook to our backend
5. Backend verifies signature, adds credits, updates subscription

## Environment Variables

Add to `.env`:

```env
# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Credits (new users get 30 free)
DEFAULT_CREDITS=30
CREDIT_COST_PER_VIDEO=10
```

## Razorpay Dashboard Setup

1. Create account at [Razorpay](https://razorpay.com)
2. Get API keys: Dashboard → Settings → API Keys
3. Enable Subscriptions: Dashboard → Settings → Configuration
4. Create webhook: Dashboard → Settings → Webhooks
   - URL: `https://your-domain.com/api/payment/webhook`
   - Events: `subscription.charged`, `subscription.activated`, `subscription.cancelled`
   - Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET`

## Create Razorpay Plans

**Option A: Via API** (requires Subscriptions enabled on your Razorpay account)

```bash
npx node scripts/create-razorpay-plans.js
```

If you get "requested URL was not found", Subscriptions may not be enabled. Contact Razorpay support or use Option B.

**Option B: Via Dashboard + link script**

1. Razorpay Dashboard → **Subscriptions** → **Plans** → Create Plan
2. Create monthly plans: Creator (₹999), Starter (₹499), Ultra (₹1999)
3. Copy each `plan_xxx` ID and run:

```bash
RAZORPAY_PLAN_CREATOR=plan_xxx RAZORPAY_PLAN_STARTER=plan_yyy RAZORPAY_PLAN_ULTRA=plan_zzz npx node scripts/link-razorpay-plans.js
```

Or link one at a time, e.g. for Creator only:

```bash
RAZORPAY_PLAN_CREATOR=plan_xxxxxxxxxxxxx npx node scripts/link-razorpay-plans.js
```

## API Reference

### Subscription

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/subscriptions/plans | No | List plans |
| GET | /api/subscriptions/me | Yes | Current subscription |
| GET | /api/subscriptions/status | Yes | Subscription status |
| POST | /api/subscriptions/create | Yes | Create checkout (body: `{ planSlug }`) |
| POST | /api/subscriptions/cancel | Yes | Cancel (body: `{ subscriptionId }`) |

### Payment

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/payment/create-subscription | Yes | Same as subscriptions/create |
| POST | /api/payment/webhook | No | Razorpay webhook (signature verified) |

### Wallet

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/wallet/balance | Yes | Credit balance |
| GET | /api/wallet/history | Yes | Ledger entries (query: limit, offset) |
| POST | /api/wallet/add | Yes | Mock add credits (dev only) |

## Webhook Events Handled

- `subscription.charged` → Add credits, update period, create Payment record
- `subscription.activated` → Create/update UserSubscription
- `subscription.cancelled` → Mark subscription cancelled

## Credit Flow

- **New user**: 30 credits (one-time)
- **Subscription payment**: Credits added per plan (500/4000)
- **Video generation**: Credits deducted (10 per video by default)
- **Insufficient credits**: 402 with `INSUFFICIENT_CREDITS` code
