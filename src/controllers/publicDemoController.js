/**
 * Public no-auth demo payload for marketing “try in 60s” (rate-limited).
 */

import sequelize from '../datacaptain/config/database.js';
import prisma from '../utils/prisma.js';
import { getMarketStatus } from '../datacaptain/services/marketStatusService.js';

const DEMO_SYMBOL = 'SPY';

export async function getPublicDemo(req, res) {
  const market = getMarketStatus();
  let sample = null;
  let etfCount = null;

  try {
    etfCount = await prisma.instrument.count({
      where: {
        OR: [{ listingCountryCode: 'US' }, { listingCountryCode: null }],
      },
    });
  } catch {
    /* optional */
  }

  try {
    const [row] = await sequelize.query(
      `SELECT hp.symbol,
              hp.date::text AS date,
              hp.close::float AS close,
              hp.volume::float AS volume
       FROM historical_prices hp
       WHERE UPPER(hp.symbol) = :symbol
       ORDER BY hp.date DESC
       LIMIT 1`,
      {
        replacements: { symbol: DEMO_SYMBOL },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    if (row) {
      sample = {
        symbol: row.symbol,
        date: row.date,
        close: row.close,
        volume: row.volume,
      };
    }
  } catch {
    /* optional */
  }

  res.json({
    success: true,
    data: {
      message: 'Public demo — no API key required. Sign up for a free key to call the full API.',
      market: {
        status: market.status,
        session: market.session,
        asOf: market.asOf,
        timezone: market.timezone || 'America/New_York',
      },
      sample,
      coverage: {
        etfCount,
        demoSymbol: DEMO_SYMBOL,
      },
      nextSteps: {
        signup: 'https://www.datacaptain.in/auth/signup',
        docs: 'https://www.datacaptain.in/docs',
        header: 'x-api-key: sdata_…',
        example: 'GET /v1/etf/list?limit=10',
      },
    },
  });
}
