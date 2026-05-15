-- DataCaptain API - SQL Schema
-- Tables created by Sequelize sync; this file documents the structure.

-- Stocks (symbol index)
CREATE TABLE stocks (
  symbol VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(20) DEFAULT 'ETF',
  exchange_code VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Historical OHLCV prices
CREATE TABLE historical_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL REFERENCES stocks(symbol),
  date DATE NOT NULL,
  open DECIMAL(18,4) NOT NULL,
  high DECIMAL(18,4) NOT NULL,
  low DECIMAL(18,4) NOT NULL,
  close DECIMAL(18,4) NOT NULL,
  volume BIGINT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(symbol, date)
);
CREATE INDEX idx_historical_prices_symbol ON historical_prices(symbol);
CREATE INDEX idx_historical_prices_date ON historical_prices(date);

-- Company profiles
CREATE TABLE companies (
  symbol VARCHAR(20) PRIMARY KEY,
  company_name VARCHAR(255),
  sector VARCHAR(100),
  industry VARCHAR(100),
  market_cap BIGINT,
  exchange VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Dividends
CREATE TABLE dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  ex_date DATE NOT NULL,
  amount DECIMAL(10,4) NOT NULL,
  payment_date DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
CREATE INDEX idx_dividends_symbol ON dividends(symbol);
CREATE INDEX idx_dividends_ex_date ON dividends(ex_date);

-- Earnings
CREATE TABLE earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  report_date DATE NOT NULL,
  eps DECIMAL(10,4),
  revenue BIGINT,
  consensus_eps DECIMAL(10,4),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
CREATE INDEX idx_earnings_symbol ON earnings(symbol);
CREATE INDEX idx_earnings_report_date ON earnings(report_date);

-- API users (customers)
CREATE TABLE api_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  plan VARCHAR(20) DEFAULT 'free',
  daily_limit INTEGER DEFAULT 1000,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- API keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES api_users(id),
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(32) NOT NULL,
  name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- API usage tracking
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  api_key VARCHAR(20) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  response_time INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_api_usage_key_created ON api_usage(key_id, created_at);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);

-- Options chain
CREATE TABLE options_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  expiration_date DATE NOT NULL,
  strike DECIMAL(12,2) NOT NULL,
  type VARCHAR(4) NOT NULL,
  bid DECIMAL(12,4),
  ask DECIMAL(12,4),
  volume INTEGER,
  open_interest INTEGER,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_options_contracts_symbol_exp ON options_contracts(symbol, expiration_date, type);
CREATE INDEX idx_options_contracts_symbol ON options_contracts(symbol);

-- Insider trades
CREATE TABLE insider_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  insider_name VARCHAR(255) NOT NULL,
  title VARCHAR(100),
  transaction_type VARCHAR(20) NOT NULL,
  shares INTEGER NOT NULL,
  price DECIMAL(12,4),
  trade_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_insider_trades_symbol ON insider_trades(symbol);
CREATE INDEX idx_insider_trades_date ON insider_trades(trade_date);

-- Stock sentiment
CREATE TABLE stock_sentiment (
  symbol VARCHAR(20) PRIMARY KEY,
  score DECIMAL(5,4) NOT NULL,
  mentions INTEGER DEFAULT 0,
  updated_at TIMESTAMP NOT NULL
);

-- Economic indicators
CREATE TABLE economic_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_name VARCHAR(50) NOT NULL UNIQUE,
  value DECIMAL(12,4) NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Dark pool trades
CREATE TABLE dark_pool_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  price DECIMAL(12,4) NOT NULL,
  volume INTEGER NOT NULL,
  trade_time TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_dark_pool_symbol ON dark_pool_trades(symbol);
CREATE INDEX idx_dark_pool_trade_time ON dark_pool_trades(trade_time);
