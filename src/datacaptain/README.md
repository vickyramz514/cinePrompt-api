# DataCaptain Module

US ETF Data API - merged into CinePrompt API server.

## Structure (maintainable separately)

```
datacaptain/
├── config/       # Sequelize DB, Redis, Swagger
├── controllers/  # Stock, market, ETF, options, insiders, sentiment, economy, darkpool
├── middlewares/ # apiKeyAuth, rateLimiter, usageLogger, cache
├── models/      # Sequelize models (stocks, api_keys, api_users, etc.)
├── routes/      # API routes
├── services/    # Business logic
├── utils/       # redis, logger, runMigrations, seedApiKey
└── ws/          # WebSocket price stream
```

## Auth

- Uses `x-api-key` header (DataCaptain API keys)
- Separate from CinePrompt JWT (Bearer) auth

## Database

- Sequelize + PostgreSQL (same DATABASE_URL as CinePrompt)
- Tables: stocks, historical_prices, companies, api_keys, api_users, api_usage, etc.

## Scripts

```bash
npm run datacaptain:db:migrate  # Sync Sequelize tables
npm run datacaptain:db:seed     # Seed API key
```

## API Paths (under /api)

### Free plan
- `/api/developer/usage`
- `/api/market/status`
- `/api/stocks/prices`
- `/api/stocks/:symbol/history`
- `/api/etf/list`, `/api/etf/:symbol`
- `/api/etf/heatmap`, `/api/etf/heatmap/baskets`
- `/api/etf/screener`, `/api/etf/rankings` (top 10 on Free)

### Paid plan (Starter+)
- `/api/backtest/buy-and-hold` (GET/POST) — strategies: buy_and_hold, dca, sma_crossover, ema_crossover, rsi, macd, custom
- `/api/backtest/compare` (GET/POST)
- `/api/portfolio/rebalance` (GET/POST)
- `/api/options/:symbol`, `/api/insiders/:symbol`, `/api/sentiment/:symbol`
- `/api/economy/indicators`, `/api/darkpool/:symbol`
- Other stock/market endpoints (snapshot, news, screener, indicators, AI score, etc.)

### Also available (plan-gated per path)
- `/api/stocks/:symbol/price`, `/candles`, `/profile`, `/dividends`, `/earnings`, `/snapshot`, `/news`
- `/api/market/earnings-calendar`, `/top-gainers`, `/top-losers`, `/most-active`
- `/api/search`, `/api/screener`, `/api/indicators/:symbol`, `/api/ai/stock-score/:symbol`

OpenAPI: see `config/swagger.js` (served via API docs UI when enabled).

## WebSocket

- ws://localhost:4000/ws - real-time price streaming
