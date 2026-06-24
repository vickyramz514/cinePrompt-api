# DataCaptain Module

US Stock Market Data API - merged into CinePrompt API server.

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

- /api/stocks/prices, /api/stocks/:symbol/snapshot, /api/stocks/:symbol/news, /api/stocks/:symbol/price, etc.
- /api/market/earnings-calendar
- /api/market/status, /api/market/top-gainers, etc.
- /api/developer/usage
- /api/etf/list, /api/etf/:symbol
- /api/backtest/buy-and-hold, /api/backtest/compare (paid)
- /api/options/:symbol
- /api/insiders/:symbol
- /api/sentiment/:symbol
- /api/economy/indicators
- /api/darkpool/:symbol
- /api/search, /api/screener, /api/indicators/:symbol, /api/ai/stock-score/:symbol

## WebSocket

- ws://localhost:4000/ws - real-time price streaming
