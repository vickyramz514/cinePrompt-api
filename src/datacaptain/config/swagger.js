/**
 * Swagger/OpenAPI documentation - DataCaptain API
 */

const spec = {
  openapi: "3.0.0",
  info: {
    title: "DataCaptain API",
    version: "1.0.0",
    description:
      "US ETF Data API for developers and fintech companies. Free plan includes market status, batch prices, ETF list/detail, heatmap, screener, rankings, and stock history. Paid plans unlock backtesting, portfolio rebalance, and premium market APIs. WebSocket: ws://host:port/ws",
  },
  servers: [{ url: "/", description: "API server" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "x-api-key",
        description: "API key (e.g. sdata_xxxxxxxx)",
      },
    },
    parameters: {
      ApiKeyHeader: {
        name: "x-api-key",
        in: "header",
        required: true,
        schema: { type: "string" },
        description: "Your API key",
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/api/stocks/{symbol}/price": {
      get: {
        summary: "Get stock price",
        tags: ["Stock"],
        parameters: [
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "282A" } },
          { $ref: "#/components/parameters/ApiKeyHeader" },
        ],
        responses: {
          200: {
            description: "Current price",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    price: { type: "number" },
                    change: { type: "number" },
                    changePercent: { type: "number" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/stocks/{symbol}/history": {
      get: {
        summary: "Get historical OHLCV data",
        description: "Daily (or interval) OHLCV bars. Available on Free plan for ETF research charts.",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "SPY" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "interval", in: "query", schema: { type: "string", enum: ["1d", "1wk", "1mo"] } },
        ],
        responses: { 200: { description: "Array of OHLCV bars { date, open, high, low, close, volume }" } },
      },
    },
    "/api/stocks/{symbol}/candles": {
      get: {
        summary: "Get OHLC candle data",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
          { name: "interval", in: "query", schema: { type: "string", enum: ["1m", "5m", "15m", "1h", "1d"] } },
        ],
        responses: { 200: { description: "OHLC candles" } },
      },
    },
    "/api/stocks/{symbol}/profile": {
      get: {
        summary: "Get company profile",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Company info" } },
      },
    },
    "/api/stocks/{symbol}/dividends": {
      get: {
        summary: "Get dividend history",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Dividend list" } },
      },
    },
    "/api/stocks/{symbol}/earnings": {
      get: {
        summary: "Get earnings data",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Earnings list" } },
      },
    },
    "/api/market/top-gainers": {
      get: {
        summary: "Top gainers",
        tags: ["Market"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: { 200: { description: "Top gaining stocks" } },
      },
    },
    "/api/market/top-losers": {
      get: {
        summary: "Top losers",
        tags: ["Market"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: { 200: { description: "Top losing stocks" } },
      },
    },
    "/api/market/most-active": {
      get: {
        summary: "Most active",
        tags: ["Market"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: { 200: { description: "Most traded stocks" } },
      },
    },
    "/api/search": {
      get: {
        summary: "Search stocks",
        tags: ["Search"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "q", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Matching stocks" } },
      },
    },
    "/api/screener": {
      get: {
        summary: "Stock screener",
        tags: ["Screener"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "sector", in: "query", schema: { type: "string" } },
          { name: "marketCapMin", in: "query", schema: { type: "integer" } },
          { name: "marketCapMax", in: "query", schema: { type: "integer" } },
          { name: "priceMin", in: "query", schema: { type: "number" } },
          { name: "priceMax", in: "query", schema: { type: "number" } },
          { name: "volumeMin", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: { 200: { description: "Filtered stocks with latest price" } },
      },
    },
    "/api/indicators/{symbol}": {
      get: {
        summary: "Technical indicators (RSI, SMA, EMA, MACD, Bollinger Bands)",
        tags: ["Indicators"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "282A" } },
          { name: "rsiPeriod", in: "query", schema: { type: "integer", default: 14 } },
          { name: "smaPeriod", in: "query", schema: { type: "integer", default: 20 } },
          { name: "emaPeriod", in: "query", schema: { type: "integer", default: 20 } },
          { name: "bbPeriod", in: "query", schema: { type: "integer", default: 20 } },
        ],
        responses: { 200: { description: "Indicator values" } },
      },
    },
    "/api/ai/stock-score/{symbol}": {
      get: {
        summary: "AI stock score (0-100) from trend, momentum, volume, volatility",
        tags: ["AI"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "282A" } },
        ],
        responses: { 200: { description: "Score and components (cached 60s)" } },
      },
    },
    "/api/developer/usage": {
      get: {
        summary: "Developer usage stats (plan, requests today, remaining)",
        tags: ["Developer"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "Usage stats",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    plan: { type: "string", example: "FREE" },
                    requestsToday: { type: "integer" },
                    requestsRemaining: { type: "integer" },
                    dailyLimit: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/market/status": {
      get: {
        summary: "US market status (OPEN/CLOSED, NYSE holidays & early closes)",
        description:
          "Computed live from America/New_York clock plus the NYSE holiday/early-close calendar. No paid data feed. Regular session 09:30–16:00 ET; early closes end at 13:00 ET.",
        tags: ["Market"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "Market status (cached 30s)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    market: { type: "string", example: "US" },
                    status: { type: "string", enum: ["OPEN", "CLOSED"] },
                    session: {
                      type: "string",
                      enum: ["regular", "early_close", "closed", "holiday"],
                    },
                    holiday: { type: "string", nullable: true, example: null },
                    earlyClose: { type: "string", nullable: true, example: null },
                    timezone: { type: "string", example: "America/New_York" },
                    asOf: { type: "string", format: "date-time" },
                    nextOpen: { type: "string", format: "date-time" },
                    nextClose: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/stocks/prices": {
      get: {
        summary: "Batch stock prices (max 50 symbols)",
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbols", in: "query", required: true, schema: { type: "string", example: "AAPL,TSLA,NVDA" } },
        ],
        responses: {
          200: {
            description: "Array of {symbol, price} (cached 60s)",
          },
        },
      },
    },
    "/api/etf/list": {
      get: {
        summary: "List / filter ETFs (paginated research universe)",
        description:
          "Paginated US ETF universe with optional filters, sorting, enrichment (issuer, category, expense, AUM), and hero stats. Free plan.",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "search", in: "query", schema: { type: "string", description: "Filter by symbol or name (alias: q)" } },
          {
            name: "hasPrice",
            in: "query",
            schema: { type: "string", enum: ["0", "1"], default: "0" },
            description: "If 1, only ETFs with historical_prices rows",
          },
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            description: "Basket/category id (e.g. technology, dividend, bonds, leveraged)",
          },
          { name: "issuer", in: "query", schema: { type: "string", example: "Vanguard" } },
          { name: "assetClass", in: "query", schema: { type: "string" } },
          { name: "leveraged", in: "query", schema: { type: "string", enum: ["0", "1"] } },
          { name: "inverse", in: "query", schema: { type: "string", enum: ["0", "1"] } },
          { name: "dividendMin", in: "query", schema: { type: "number" }, description: "Min dividend yield %" },
          { name: "expenseMax", in: "query", schema: { type: "number" }, description: "Max expense ratio %" },
          { name: "aumMin", in: "query", schema: { type: "number" }, description: "Min AUM in $B" },
          { name: "volumeMin", in: "query", schema: { type: "number" }, description: "Min avg 30d volume" },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["symbol", "price", "return", "volume", "yield", "expense", "aum"],
              default: "symbol",
            },
          },
          { name: "sortDir", in: "query", schema: { type: "string", enum: ["asc", "desc"], default: "asc" } },
        ],
        responses: {
          200: {
            description:
              "{ data: EtfItem[], total, limit, offset, stats?: { totalEtfs, withHistory, categories, avgVolume, asOf } }",
          },
        },
      },
    },
    "/api/etf/heatmap": {
      get: {
        summary: "ETF performance heatmap",
        description: "Return % cells for a preset basket or custom symbol list. Free plan.",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          {
            name: "basket",
            in: "query",
            schema: { type: "string", example: "broad" },
            description: "Preset basket id (see /etf/heatmap/baskets)",
          },
          {
            name: "symbols",
            in: "query",
            schema: { type: "string", example: "SPY,QQQ,VOO" },
            description: "Comma-separated tickers (max ~40); overrides basket when set",
          },
          {
            name: "period",
            in: "query",
            schema: {
              type: "string",
              enum: ["1d", "1w", "1m", "3m", "6m", "ytd", "1y", "3y", "5y", "10y", "max"],
              default: "1y",
            },
          },
        ],
        responses: {
          200: {
            description: "{ period, basket, asOf, cells: HeatmapCell[] }",
          },
        },
      },
    },
    "/api/etf/heatmap/baskets": {
      get: {
        summary: "List heatmap basket presets",
        tags: ["ETF"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "{ baskets: [{ id, label, symbols[] }] }",
          },
        },
      },
    },
    "/api/etf/screener": {
      get: {
        summary: "ETF screener",
        description: "Filter and sort ETFs by return, yield, risk, expense, AUM, and flags. Free plan: top 10.",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "returnMin", in: "query", schema: { type: "number" } },
          { name: "returnMax", in: "query", schema: { type: "number" } },
          { name: "dividendYieldMin", in: "query", schema: { type: "number" } },
          { name: "dividendYieldMax", in: "query", schema: { type: "number" } },
          { name: "volatilityMin", in: "query", schema: { type: "number" } },
          { name: "volatilityMax", in: "query", schema: { type: "number" } },
          { name: "volumeMin", in: "query", schema: { type: "number" } },
          { name: "volumeMax", in: "query", schema: { type: "number" } },
          { name: "priceMin", in: "query", schema: { type: "number" } },
          { name: "priceMax", in: "query", schema: { type: "number" } },
          { name: "expenseMin", in: "query", schema: { type: "number" } },
          { name: "expenseMax", in: "query", schema: { type: "number" } },
          { name: "aumMin", in: "query", schema: { type: "number" }, description: "Min AUM $B" },
          { name: "aumMax", in: "query", schema: { type: "number" }, description: "Max AUM $B" },
          { name: "sharpeMin", in: "query", schema: { type: "number" } },
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: ["ytd", "1y", "3y", "5y"], default: "1y" },
          },
          { name: "assetClass", in: "query", schema: { type: "string" } },
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "issuer", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "leveraged", in: "query", schema: { type: "string", enum: ["0", "1"] } },
          { name: "inverse", in: "query", schema: { type: "string", enum: ["0", "1"] } },
          { name: "esg", in: "query", schema: { type: "string", enum: ["0", "1"] } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["return", "yield", "volatility", "expense", "aum", "sharpe", "price"] },
          },
          { name: "sortDir", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "includeSparkline", in: "query", schema: { type: "string", enum: ["0", "1"], default: "1" } },
        ],
        responses: {
          200: {
            description: "{ data, total, limit, offset, freeTierLimited?}",
          },
        },
      },
    },
    "/api/etf/rankings": {
      get: {
        summary: "ETF rankings / leaderboards",
        description:
          "Rank ETFs by return, yield, volatility, CAGR, Sharpe, expense, AUM, or drawdown. Free plan: top 10.",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          {
            name: "metric",
            in: "query",
            schema: {
              type: "string",
              enum: ["return", "yield", "volatility", "cagr", "sharpe", "expense", "aum", "drawdown"],
              default: "return",
            },
          },
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
            description: "Legacy alias for metric, or basket id when used as category filter",
          },
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: ["ytd", "1y", "3y", "5y"], default: "1y" },
          },
          { name: "basket", in: "query", schema: { type: "string" }, description: "Limit to heatmap basket symbols" },
          { name: "assetClass", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string" } },
          { name: "sortDir", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          { name: "includeSparkline", in: "query", schema: { type: "string", enum: ["0", "1"] } },
        ],
        responses: {
          200: {
            description: "{ metric, period, basket, data: RankingsRow[], total, limit, offset, freeTierLimited?}",
          },
        },
      },
    },
    "/api/etf/{symbol}": {
      get: {
        summary: "ETF research profile",
        description:
          "Full ETF profile: price, metrics, performance periods, OHLCV history, dividends, similar ETFs, AI summary, risk. Free plan (GET).",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "SPY" } },
        ],
        responses: {
          200: {
            description:
              "EtfDetail — includes history[], performance{}, dividends[], similar[], aiSummary, risk, high52w/low52w",
          },
          404: { description: "ETF not found" },
        },
      },
    },
    "/api/backtest/buy-and-hold": {
      get: {
        summary: "Run ETF strategy backtest (GET)",
        description: "Paid plan. Same body params as query string.",
        tags: ["Backtesting"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "query", required: true, schema: { type: "string", example: "SPY" } },
          { name: "investment", in: "query", schema: { type: "number", default: 10000 } },
          { name: "startDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          {
            name: "strategy",
            in: "query",
            schema: {
              type: "string",
              enum: ["buy_and_hold", "dca", "sma_crossover", "ema_crossover", "rsi", "macd", "custom"],
              default: "buy_and_hold",
            },
          },
          { name: "reinvestDividends", in: "query", schema: { type: "boolean", default: true } },
          { name: "adjustForInflation", in: "query", schema: { type: "boolean", default: false } },
          { name: "fastPeriod", in: "query", schema: { type: "integer" } },
          { name: "slowPeriod", in: "query", schema: { type: "integer" } },
          { name: "rsiPeriod", in: "query", schema: { type: "integer" } },
          { name: "rsiBuyBelow", in: "query", schema: { type: "number" } },
          { name: "rsiSellAbove", in: "query", schema: { type: "number" } },
          { name: "macdFast", in: "query", schema: { type: "integer" } },
          { name: "macdSlow", in: "query", schema: { type: "integer" } },
          { name: "macdSignal", in: "query", schema: { type: "integer" } },
        ],
        responses: {
          200: {
            description:
              "BacktestResult — equityCurve, tradeEvents, dividendEvents, prices (OHLCV), drawdownCurve, Sharpe/Sortino, etc.",
          },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
      post: {
        summary: "Run ETF strategy backtest (POST)",
        description: "Paid plan. Multi-strategy ETF backtest with trade/dividend events and price series.",
        tags: ["Backtesting"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["symbol", "startDate", "endDate"],
                properties: {
                  symbol: { type: "string", example: "SPY" },
                  investment: { type: "number", default: 10000 },
                  startDate: { type: "string", format: "date" },
                  endDate: { type: "string", format: "date" },
                  strategy: {
                    type: "string",
                    enum: ["buy_and_hold", "dca", "sma_crossover", "ema_crossover", "rsi", "macd", "custom"],
                    default: "buy_and_hold",
                  },
                  reinvestDividends: { type: "boolean", default: true },
                  adjustForInflation: { type: "boolean", default: false },
                  fastPeriod: { type: "integer" },
                  slowPeriod: { type: "integer" },
                  rsiPeriod: { type: "integer" },
                  rsiBuyBelow: { type: "number" },
                  rsiSellAbove: { type: "number" },
                  macdFast: { type: "integer" },
                  macdSlow: { type: "integer" },
                  macdSignal: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description:
              "BacktestResult — equityCurve, tradeEvents[], dividendEvents[], prices[], drawdownCurve[], metrics",
          },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
    },
    "/api/backtest/compare": {
      get: {
        summary: "Compare ETF backtests (GET)",
        tags: ["Backtesting"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          {
            name: "symbols",
            in: "query",
            required: true,
            schema: { type: "string", example: "VOO,SPY,QQQ" },
            description: "Comma-separated ETF tickers",
          },
          { name: "investment", in: "query", schema: { type: "number", default: 10000 } },
          { name: "startDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", required: true, schema: { type: "string", format: "date" } },
          {
            name: "strategy",
            in: "query",
            schema: {
              type: "string",
              enum: ["buy_and_hold", "dca", "sma_crossover", "ema_crossover", "rsi", "macd", "custom"],
            },
          },
          { name: "reinvestDividends", in: "query", schema: { type: "boolean" } },
          { name: "adjustForInflation", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          200: { description: "{ investment, startDate, endDate, winner, ranked, results[] }" },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
      post: {
        summary: "Compare ETF backtests (POST)",
        tags: ["Backtesting"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["symbols", "startDate", "endDate"],
                properties: {
                  symbols: {
                    oneOf: [
                      { type: "array", items: { type: "string" }, example: ["VOO", "SPY", "QQQ"] },
                      { type: "string", example: "VOO,SPY,QQQ" },
                    ],
                  },
                  investment: { type: "number", default: 10000 },
                  startDate: { type: "string", format: "date" },
                  endDate: { type: "string", format: "date" },
                  strategy: { type: "string" },
                  reinvestDividends: { type: "boolean" },
                  adjustForInflation: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "{ winner, ranked, results[] }" },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
    },
    "/api/portfolio/rebalance": {
      get: {
        summary: "Portfolio rebalance suggestions (GET)",
        description: "Paid plan. Pass holdings/target as JSON strings in query if using GET.",
        tags: ["Portfolio"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          {
            name: "holdings",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: 'JSON array e.g. [{"symbol":"VOO","shares":63}]',
          },
          {
            name: "target",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: 'JSON array e.g. [{"symbol":"VOO","weight":60}]',
          },
          { name: "driftThreshold", in: "query", schema: { type: "number", default: 0 } },
          {
            name: "mode",
            in: "query",
            schema: { type: "string", enum: ["rebalance", "contributions_only"] },
          },
        ],
        responses: {
          200: { description: "RebalanceResult — allocation[], trades[], needsRebalance, maxDrift" },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
      post: {
        summary: "Portfolio rebalance suggestions (POST)",
        description: "Paid plan. Compare holdings to target weights and return buy/sell suggestions.",
        tags: ["Portfolio"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["holdings", "target"],
                properties: {
                  holdings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        symbol: { type: "string" },
                        shares: { type: "number" },
                      },
                    },
                    example: [{ symbol: "VOO", shares: 63 }, { symbol: "QQQ", shares: 37 }],
                  },
                  target: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        symbol: { type: "string" },
                        weight: { type: "number", description: "Target weight %" },
                      },
                    },
                    example: [{ symbol: "VOO", weight: 60 }, { symbol: "QQQ", weight: 40 }],
                  },
                  driftThreshold: { type: "number", default: 0 },
                  mode: { type: "string", enum: ["rebalance", "contributions_only"] },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "RebalanceResult" },
          403: { description: "PLAN_UPGRADE_REQUIRED on Free plan" },
        },
      },
    },
    "/api/options/{symbol}": {
      get: {
        summary: "Options chain (calls and puts)",
        tags: ["Options"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "AAPL" } },
          { name: "expirationDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: {
            description: "Options chain (cached 60s)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    expirationDate: { type: "string", format: "date" },
                    calls: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          strike: { type: "number" },
                          bid: { type: "number" },
                          ask: { type: "number" },
                          volume: { type: "integer" },
                          openInterest: { type: "integer" },
                        },
                      },
                    },
                    puts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          strike: { type: "number" },
                          bid: { type: "number" },
                          ask: { type: "number" },
                          volume: { type: "integer" },
                          openInterest: { type: "integer" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/insiders/{symbol}": {
      get: {
        summary: "Insider trading activity",
        tags: ["Insiders"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "AAPL" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: {
            description: "Insider trades array",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      title: { type: "string" },
                      transactionType: { type: "string", enum: ["BUY", "SELL"] },
                      shares: { type: "integer" },
                      price: { type: "number" },
                      date: { type: "string", format: "date" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/sentiment/{symbol}": {
      get: {
        summary: "Stock sentiment score (-1 to +1)",
        tags: ["Sentiment"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "TSLA" } },
        ],
        responses: {
          200: {
            description: "Sentiment data (cached 60s)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    symbol: { type: "string" },
                    sentimentScore: { type: "number", description: "-1 to +1" },
                    sentiment: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "SLIGHTLY_BULLISH", "VERY_BEARISH"] },
                    mentions: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/economy/indicators": {
      get: {
        summary: "Major economic indicators",
        tags: ["Economy"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "Macro indicators (cached 5 min)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    inflation: { type: "number", example: 3.2 },
                    interestRate: { type: "number", example: 5.25 },
                    gdpGrowth: { type: "number", example: 2.4 },
                    unemploymentRate: { type: "number", example: 3.8 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/darkpool/{symbol}": {
      get: {
        summary: "Dark pool trading activity",
        tags: ["Dark Pool"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "NVDA" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: {
            description: "Dark pool trades array",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      symbol: { type: "string" },
                      price: { type: "number" },
                      volume: { type: "integer" },
                      tradeTime: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default spec;
