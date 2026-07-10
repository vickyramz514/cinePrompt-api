# Data Captain — Complete Database Table Guide

One PostgreSQL database (`DATABASE_URL`) powers everything. Tables fall into **three layers**:

| Layer | ORM | Naming | Role |
|-------|-----|--------|------|
| **Platform** | Prisma | `"User"`, `"Payment"`, … (PascalCase) | Login, billing, subscriptions, support |
| **Market ingest** | Prisma | `"Instrument"`, `"MarketData"` | Bulk CSV import staging |
| **Market API** | Sequelize | `stocks`, `historical_prices`, … (snake_case) | What `/api/etf`, backtest, screener read at runtime |

---

## Quick answer: “Where is the ETF list?”

**Not in `companies`.**

| What you want | Table | Notes |
|---------------|-------|-------|
| **ETF / symbol master list** | `stocks` | `symbol` PK, `name`, `type='ETF'`, exchange |
| **Daily OHLCV prices** | `historical_prices` | FK → `stocks(symbol)` |
| **Pre-computed returns / screener** | `etf_metrics` | FK → `stocks(symbol)` |
| **Extra profile (sector, cap)** | `companies` | Same `symbol` as `stocks`; optional join |
| **Bulk import metadata** | `"Instrument"` | Source: ETF universe CSV (`firstbridge_id`) |
| **Bulk import prices** | `"MarketData"` | Source: DMD / market CSV; synced → `historical_prices` |

```
ETF universe CSV ──► Instrument ──► stocks (+ companies copy)
DMD / price CSV    ──► MarketData ──► historical_prices
                                      └──► etf_metrics (nightly job)
```

**Runtime API never reads CSV or `companies` alone for the ETF list** — it reads `stocks` joined with `historical_prices` / `etf_metrics`.

---

## Architecture diagram

```mermaid
flowchart TB
  subgraph ingest [Ingest layer - Prisma]
    CSV1[ETF universe CSV]
    CSV2[DMD batch CSV]
    CSV1 --> Instrument[Instrument]
    CSV2 --> MarketData[MarketData]
    Instrument --> MarketData
  end

  subgraph runtime [Runtime layer - Sequelize API]
    stocks[stocks - symbol index]
    hp[historical_prices]
    em[etf_metrics]
    co[companies - profile]
    stocks --> hp
    stocks --> em
    stocks -.-> co
  end

  Instrument -->|syncToStocksTable| stocks
  Instrument -->|syncToStocksTable| co
  MarketData -->|syncHistoricalPrices| hp

  subgraph api [HTTP API]
    etf[/api/etf/*]
    bt[/api/backtest/*]
    scr[/api/screener]
  end

  stocks --> etf
  hp --> etf
  em --> etf
  hp --> bt
  co --> scr
  hp --> scr
```

---

## Part 1 — Market data tables (Data Captain product)

### `stocks` — **Master symbol index (ETF list)**

| Column | Purpose |
|--------|---------|
| `symbol` (PK) | Ticker, e.g. `SPY`, `QQQ` |
| `name` | Fund name |
| `type` | `ETF` or `STOCK` (product is ETF-focused) |
| `exchange_code` | e.g. `ARCX`, `XNAS` |
| `is_active` | Filter inactive listings |

**Used by:** `/api/etf/list`, `/api/etf/{symbol}`, backtest, portfolio, batch prices, screener base.

**Populated by:** `scripts/seed-market-data.js` and DMD import — copies from `"Instrument"`.

---

### `historical_prices` — **Daily price history (what APIs query)**

| Column | Purpose |
|--------|---------|
| `symbol` (FK → `stocks`) | Links to ETF |
| `date` | Trading day |
| `open`, `high`, `low`, `close` | OHLCV |
| `volume` | Shares traded |

**Unique:** `(symbol, date)`

**Used by:** `/api/stocks/{symbol}/history`, `/api/stocks/{symbol}/candles`, backtesting, indicators, ETF latest price, `/api/status` freshness.

**Populated by:** Sync SQL from `"MarketData"` + `"Instrument"` (see `import-dmd-batches.js`, `seed-market-data.js`).

**Important:** `stocks` can list ~29k global ETFs from the universe CSV, while `historical_prices` may only have ~5.5k US symbols from DMD import (`US_ONLY=1`). ETFs without a matching `historical_prices` row show `price: null` in `/api/etf/list`. Use query `hasPrice=1` to list only symbols with prices.

**This is the table linked to prices — not `companies`.**

---

### `companies` — **Profile / sector overlay (not the ETF list)**

| Column | Purpose |
|--------|---------|
| `symbol` (PK) | Same ticker as `stocks` |
| `company_name` | Display name (often same as ETF name) |
| `sector`, `industry` | Classification (often empty for ETFs) |
| `market_cap` | For stock screener filters |
| `exchange` | Exchange string |

**Used by:** `/api/stocks/{symbol}/profile`, stock screener (`LEFT JOIN companies`), earnings calendar labels.

**Populated by:** Copied from `"Instrument"` during `syncToStocksTable()` — **not** a separate company CSV.

**Common misconception:** This is **not** “all ETF companies with price history.” It is optional metadata keyed by symbol. The ETF universe lives in `stocks`.

---

### `etf_metrics` — **Cached performance (screener + heatmap)**

| Column | Purpose |
|--------|---------|
| `symbol` (PK, FK → `stocks`) | One row per ETF |
| `as_of_date` | When metrics were computed |
| `return_ytd`, `return_1y`, `return_3y`, `return_5y` | Performance |
| `dividend_yield_ttm`, `volatility_1y` | Screener filters |
| `latest_price`, `latest_price_date` | Denormalized for speed |
| `asset_class` | e.g. Equity, Fixed Income (from `Instrument` when available) |

**Used by:** `/api/etf/screener`, `/api/etf/rankings`, `/api/etf/heatmap`, status page.

**Populated by:** `npm run etf:compute-metrics` (reads `historical_prices` + `dividends` + `Instrument.assetClass`).

---

### `"Instrument"` (Prisma) — **Import staging: ETF metadata**

| Column | Purpose |
|--------|---------|
| `id` | `firstbridge_id` from data vendor |
| `symbol` | `composite_ticker` |
| `name`, `assetClass`, `exchangeCode`, `listingCountryCode`, … | Universe fields |

**Used by:** Import scripts, `etfMetricsService` (asset class lookup), status checks.

**Not used directly** by public ETF list API at scale — data is synced to `stocks`.

---

### `"MarketData"` (Prisma) — **Import staging: daily OHLCV**

| Column | Purpose |
|--------|---------|
| `instrumentId` (FK → `Instrument.id`) | Vendor ID, not symbol |
| `asOfDate` | Date |
| `open`, `high`, `low`, `close`, `volume`, `nav` | Prices |

**Used by:** Bulk import only (`import-dmd-batches.js`, `seed-market-data.js`).

**Why it exists:** Efficient upsert during multi-GB CSV import. After import, rows are **copied** to `historical_prices` (symbol-based) for API queries.

```sql
-- Simplified sync (actual script in import-dmd-batches.js)
INSERT INTO historical_prices (symbol, date, open, high, low, close, volume, ...)
SELECT i.symbol, m."asOfDate", m.open, m.high, m.low, m.close, m.volume, ...
FROM "MarketData" m
JOIN "Instrument" i ON m."instrumentId" = i.id
ON CONFLICT (symbol, date) DO UPDATE ...
```

---

### Other market tables (Sequelize)

| Table | Purpose | API | Data today |
|-------|---------|-----|------------|
| `dividends` | Ex-dividend history | `/api/stocks/{symbol}/dividends`, backtest yield | Read paths exist; may be empty without import |
| `earnings` | Earnings calendar | `/api/stocks/{symbol}/earnings`, snapshot | Seeded for demos (`seed-snapshot-demo-data.js`) |
| `stock_news` | Headlines | `/api/stocks/{symbol}/news`, snapshot | Demo seed |
| `options_contracts` | Options chain | `/api/options/*` | No ingest in repo |
| `insider_trades` | Insider activity | `/api/insiders/*` | No ingest |
| `stock_sentiment` | Sentiment score | `/api/sentiment/*` | No ingest (returns neutral if empty) |
| `economic_indicators` | Macro (GDP, CPI, …) | `/api/economy/*` | No ingest |
| `dark_pool_trades` | Dark pool prints | `/api/darkpool/*` | No ingest |

---

## Part 2 — API auth & usage (Sequelize)

| Table | Purpose |
|-------|---------|
| `api_users` | DataCaptain API customer (email, plan, daily_limit) |
| `api_keys` | Hashed keys (`key_prefix` for lookup) |
| `api_usage` | Per-request log (endpoint, latency, status) — **this is live usage tracking** |

Synced from platform `User` on signup/subscription via `syncApiUserPlan.js`.

**Note:** Old Prisma `"ApiUsage"` table was removed; do not confuse with `api_usage`.

---

## Part 3 — Platform tables (Prisma — app & billing)

### Authentication & users

| Table | Purpose |
|-------|---------|
| `User` | Account, plan, role, cached credits |
| `UserProfile` | Bio, timezone, locale |
| `RefreshToken` | JWT refresh rotation |

### Billing & subscriptions

| Table | Purpose |
|-------|---------|
| `SubscriptionPlan` | Plan catalog (slug, price, Razorpay plan id, features) |
| `UserSubscription` | Active subscription periods |
| `Payment` | Razorpay payment records |
| `Wallet` | Credit balance (source of truth) |
| `CreditLedgerEntry` | Immutable credit ledger |
| `Transaction` | Legacy credit log (still written on purchases) |

### API keys (platform side)

| Table | Purpose |
|-------|---------|
| `ApiKeySecret` | Encrypted full API key for “show my key again” in dashboard |

Links logically to `api_keys.id` in Sequelize (no DB FK).

### Support, growth, admin

| Table | Purpose |
|-------|---------|
| `SupportTicket`, `SupportMessage` | Customer support |
| `Referral`, `Affiliate`, `AffiliatePayout` | Referral program |
| `GrowthEvent` | Funnel analytics (signup, payment, subscription) |
| `AdminAuditLog` | Admin actions |
| `Notification` | In-app notifications (read/mark-read; rarely created) |

### Removed (legacy video pipeline)

These were dropped in migration `20260710130000_drop_video_pipeline`:

`VideoJob`, `JobStep`, `CreditLock`, `ApiCostLog`, `AbuseLog`

---

## Data pipeline cheat sheet

### Initial / universe load

```bash
cd cinePrompt-api
npm run db:seed:etf          # Instrument → stocks + companies
npm run db:seed:market       # + MarketData → historical_prices
```

### Bulk DMD import (your ~393 batch files)

```bash
DMD_DIR=/path/to/output US_ONLY=1 SINCE=2010-01-01 npm run db:import:dmd
```

Flow: `dmd_batch_*.csv` → `"MarketData"` → `historical_prices`

### Nightly / after import

```bash
npm run etf:compute-metrics  # historical_prices → etf_metrics
```

---

## Which API reads which table?

| Endpoint | Primary tables |
|----------|----------------|
| `GET /api/etf/list` | `stocks` + `historical_prices` (latest price) |
| `GET /api/etf/screener` | `etf_metrics` + `stocks` |
| `GET /api/etf/heatmap` | `etf_metrics` |
| `GET /api/etf/rankings` | `etf_metrics` |
| `POST /api/backtest/*` | `historical_prices` (+ `dividends` optional) |
| `POST /api/portfolio/rebalance` | `stocks`, `historical_prices` |
| `GET /api/stocks/{symbol}/profile` | `companies` + `stocks` |
| `GET /api/screener` | `stocks` + `companies` + `historical_prices` |
| `GET /api/developer/usage` | `api_usage`, `api_users` |
| `GET /api/status` | `historical_prices`, `etf_metrics`, `"Instrument"` counts |
| Login / billing | `User`, `Payment`, `UserSubscription`, … |

---

## Row counts & freshness

Check live status:

```bash
curl https://datacaptain.up.railway.app/api/status
```

Or SQL:

```sql
SELECT COUNT(*) FROM stocks WHERE type = 'ETF';
SELECT COUNT(*) FROM historical_prices;
SELECT MAX(date) FROM historical_prices;
SELECT COUNT(*) FROM etf_metrics;
SELECT COUNT(*) FROM "Instrument";
SELECT COUNT(*) FROM "MarketData";
```

---

## Future simplification (optional)

Today you have **duplicate storage**:

- Ingest: `"Instrument"` + `"MarketData"`
- Runtime: `stocks` + `historical_prices`

Long-term you could import directly into `stocks` / `historical_prices` and drop the Prisma market tables — but only after updating all import scripts and moving `assetClass` onto `stocks` or `etf_metrics`.

---

## Related docs

- [MARKET_DATA_README.md](../../MARKET_DATA_README.md) — CSV columns & commands
- [src/datacaptain/schema.sql](../src/datacaptain/schema.sql) — Sequelize DDL reference
- [prisma/schema.prisma](../prisma/schema.prisma) — Platform + ingest models
