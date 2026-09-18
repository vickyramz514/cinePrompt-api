/**
 * Compute and cache ETF performance metrics (screener + heatmap)
 *
 * Run from cinePrompt-api:
 *   npm run etf:compute-metrics
 *
 * Schedule nightly via cron / Railway job after market close.
 */

import '../src/config/ensureEnv.js';
import sequelize from '../src/datacaptain/config/database.js';
import { computeAllMetrics } from '../src/datacaptain/services/etfMetricsService.js';

async function main() {
  await sequelize.authenticate();
  console.log('Computing ETF metrics...');

  const { EtfMetrics } = await import('../src/datacaptain/models/index.js');
  await EtfMetrics.sync({ alter: true });

  const result = await computeAllMetrics({
    onProgress: ({ processed, total, stored }) => {
      console.log(`  ${processed}/${total} processed (${stored} stored)`);
    },
  });

  console.log(`Done. ${result.stored} ETFs with metrics (of ${result.total} with price history).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
