/**
 * Public platform status — uptime + data freshness (no auth).
 */

import prisma from '../utils/prisma.js';
import sequelize from '../datacaptain/config/database.js';

function overallStatus(services) {
  if (services.every((s) => s.status === 'operational')) return 'operational';
  if (services.some((s) => s.status === 'down')) return 'down';
  return 'degraded';
}

export const getStatus = async (req, res) => {
  const checkedAt = new Date().toISOString();
  const services = [];

  services.push({
    id: 'api',
    name: 'API',
    status: 'operational',
    message: 'Responding normally',
  });

  let data = {
    latestPriceDate: null,
    etfMetricsAsOf: null,
    etfCount: null,
    historicalPriceRows: null,
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    services.push({
      id: 'database',
      name: 'Database',
      status: 'operational',
      message: 'Connected',
    });
  } catch (err) {
    services.push({
      id: 'database',
      name: 'Database',
      status: 'down',
      message: err?.message || 'Connection failed',
    });
  }

  if (services.find((s) => s.id === 'database')?.status === 'operational') {
    try {
      const [priceRow] = await sequelize.query(
        'SELECT MAX(date)::text AS latest FROM historical_prices',
        { type: sequelize.QueryTypes.SELECT }
      );
      const [metricsRow] = await sequelize.query(
        'SELECT MAX(as_of_date)::text AS latest FROM etf_metrics',
        { type: sequelize.QueryTypes.SELECT }
      );
      const [countRow] = await sequelize.query(
        'SELECT COUNT(*)::int AS count FROM historical_prices',
        { type: sequelize.QueryTypes.SELECT }
      );
      const etfCount = await prisma.instrument.count({
        where: {
          OR: [{ listingCountryCode: 'US' }, { listingCountryCode: null }],
        },
      });

      data = {
        latestPriceDate: priceRow?.latest || null,
        etfMetricsAsOf: metricsRow?.latest || null,
        etfCount,
        historicalPriceRows: countRow?.count ?? null,
      };

      services.push({
        id: 'market_data',
        name: 'Market data',
        status: data.latestPriceDate ? 'operational' : 'degraded',
        message: data.latestPriceDate
          ? `Prices through ${data.latestPriceDate}`
          : 'No historical prices loaded yet',
      });
    } catch (err) {
      services.push({
        id: 'market_data',
        name: 'Market data',
        status: 'degraded',
        message: err?.message || 'Could not read data freshness',
      });
    }
  }

  res.json({
    status: overallStatus(services),
    checkedAt,
    services,
    data,
  });
};
