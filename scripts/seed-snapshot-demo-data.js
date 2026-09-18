/**
 * Seed sample news + earnings for popular symbols (snapshot / calendar demos).
 * Run: npm run datacaptain:db:seed:snapshot
 */

import '../src/config/ensureEnv.js';
import { sequelize, StockNews, Earnings, Stock, Company, HistoricalPrice } from '../src/datacaptain/models/index.js';

const SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'SPY', 'QQQ'];

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(h) {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() - h);
  return d;
}

const NEWS_TEMPLATES = [
  (sym, name) => ({
    headline: `${name} (${sym}) shares move on heavy volume`,
    summary: `Traders watch ${sym} as institutional flow picks up ahead of the next earnings window.`,
    source: 'Market Wire',
  }),
  (sym, name) => ({
    headline: `Analysts update outlook on ${name}`,
    summary: `Street revisions for ${sym} reflect shifting macro and sector sentiment.`,
    source: 'Reuters',
  }),
  (sym) => ({
    headline: `${sym} in focus as US indices digest economic data`,
    summary: `Broad market moves continue to influence ${sym} relative strength.`,
    source: 'Bloomberg',
  }),
];

async function ensureStocks() {
  for (const symbol of SYMBOLS) {
    await Company.findOrCreate({
      where: { symbol },
      defaults: { symbol, company_name: symbol, exchange: 'NASDAQ' },
    });
    await Stock.findOrCreate({
      where: { symbol },
      defaults: { symbol, name: symbol, type: 'STOCK', is_active: true },
    });
  }
}

async function seedNews() {
  let count = 0;
  for (const symbol of SYMBOLS) {
    const stock = await Stock.findByPk(symbol);
    const name = stock?.name || symbol;
    for (let i = 0; i < NEWS_TEMPLATES.length; i++) {
      const tpl = NEWS_TEMPLATES[i](symbol, name);
      const published_at = hoursAgo(6 + i * 12);
      const [row, created] = await StockNews.findOrCreate({
        where: {
          symbol,
          headline: tpl.headline,
        },
        defaults: {
          symbol,
          headline: tpl.headline,
          summary: tpl.summary,
          source: tpl.source,
          url: `https://www.datacaptain.in/docs?symbol=${symbol}`,
          published_at,
        },
      });
      if (created) count += 1;
      else await row.update({ published_at });
    }
  }
  return count;
}

async function seedPrices() {
  const basePrices = {
    AAPL: 190,
    TSLA: 240,
    NVDA: 880,
    MSFT: 420,
    AMZN: 185,
    META: 510,
    SPY: 530,
    QQQ: 450,
  };
  let count = 0;
  for (const symbol of SYMBOLS) {
    const existing = await HistoricalPrice.count({ where: { symbol } });
    if (existing >= 2) continue;
    const base = basePrices[symbol] || 100;
    for (let i = 30; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const close = base + (30 - i) * 0.1;
      await HistoricalPrice.findOrCreate({
        where: { symbol, date },
        defaults: {
          symbol,
          date,
          open: close - 0.5,
          high: close + 1,
          low: close - 1,
          close,
          volume: 1_000_000,
        },
      });
      count += 1;
    }
  }
  return count;
}

async function seedEarnings() {
  let count = 0;
  const offsets = [-5, -2, 3, 7, 14, 21];
  for (const symbol of SYMBOLS) {
    for (let i = 0; i < offsets.length; i++) {
      const report_date = daysFromNow(offsets[i]);
      const isPast = offsets[i] <= 0;
      const consensus = 1.2 + i * 0.15;
      const eps = isPast ? consensus + (i % 2 === 0 ? 0.08 : -0.05) : null;
      const [row, created] = await Earnings.findOrCreate({
        where: { symbol, report_date },
        defaults: {
          symbol,
          report_date,
          eps,
          consensus_eps: consensus,
          revenue: BigInt(80_000_000_000 + i * 5_000_000_000),
        },
      });
      if (created) count += 1;
      else {
        await row.update({
          eps,
          consensus_eps: consensus,
        });
      }
    }
  }
  return count;
}

async function main() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  await ensureStocks();
  const priceCount = await seedPrices();
  const newsCount = await seedNews();
  const earningsCount = await seedEarnings();
  console.log(
    `Seeded snapshot demo data: ${priceCount} price bars, ${newsCount} news rows, ${earningsCount} earnings rows`
  );
  await sequelize.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
