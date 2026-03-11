/**
 * Swagger/OpenAPI documentation - DataCaptain API
 */

const spec = {
  openapi: "3.0.0",
  info: {
    title: "DataCaptain API",
    version: "1.0.0",
    description: "US Stock Market Data API for developers and fintech companies. WebSocket: ws://host:port/ws",
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
        tags: ["Stock"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
          { name: "interval", in: "query", schema: { type: "string", enum: ["1d", "1wk", "1mo"] } },
        ],
        responses: { 200: { description: "Array of OHLCV bars" } },
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
        summary: "US market status (OPEN/CLOSED, next open/close times)",
        tags: ["Market"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "Market status (cached 60s)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    market: { type: "string", example: "US" },
                    status: { type: "string", enum: ["OPEN", "CLOSED"] },
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
        summary: "Popular ETFs (SPY, QQQ, VTI, DIA, ARKK)",
        tags: ["ETF"],
        parameters: [{ $ref: "#/components/parameters/ApiKeyHeader" }],
        responses: {
          200: {
            description: "ETF list with prices (cached 60s)",
          },
        },
      },
    },
    "/api/etf/{symbol}": {
      get: {
        summary: "Single ETF details",
        tags: ["ETF"],
        parameters: [
          { $ref: "#/components/parameters/ApiKeyHeader" },
          { name: "symbol", in: "path", required: true, schema: { type: "string", example: "SPY" } },
        ],
        responses: { 200: { description: "ETF details (cached 60s)" } },
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
