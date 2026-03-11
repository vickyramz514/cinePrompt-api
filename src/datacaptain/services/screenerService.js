/**
 * Stock Screener service
 * Filters stocks by sector, market cap, price, volume
 * Joins stocks with companies and latest price from historical_prices
 */

import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";

export async function screenStocks(filters) {
  const {
    sector,
    marketCapMin,
    marketCapMax,
    priceMin,
    priceMax,
    volumeMin,
    limit = 50,
  } = filters;

  const limitVal = Math.min(parseInt(limit, 10) || 50, 100);

  const whereParts = [];
  const params = { limit: limitVal };

  if (sector) {
    whereParts.push('c.sector = :sector');
    params.sector = sector;
  }
  if (marketCapMin != null && marketCapMin !== "") {
    whereParts.push("COALESCE(c.market_cap, 0) >= :marketCapMin");
    params.marketCapMin = parseInt(marketCapMin, 10);
  }
  if (marketCapMax != null && marketCapMax !== "") {
    whereParts.push("(c.market_cap IS NULL OR c.market_cap <= :marketCapMax)");
    params.marketCapMax = parseInt(marketCapMax, 10);
  }
  if (priceMin != null && priceMin !== "") {
    whereParts.push("hp.close >= :priceMin");
    params.priceMin = parseFloat(priceMin);
  }
  if (priceMax != null && priceMax !== "") {
    whereParts.push("hp.close <= :priceMax");
    params.priceMax = parseFloat(priceMax);
  }
  if (volumeMin != null && volumeMin !== "") {
    whereParts.push("COALESCE(hp.volume, 0) >= :volumeMin");
    params.volumeMin = parseInt(volumeMin, 10);
  }

  const whereClause =
    whereParts.length > 0 ? `AND ${whereParts.join(" AND ")}` : "";

  const rows = await sequelize.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (symbol) symbol, date, open, high, low, close, volume
      FROM historical_prices
      ORDER BY symbol, date DESC
    )
    SELECT s.symbol, s.name, s.type, s.exchange_code,
      c.sector, c.industry, c.market_cap,
      hp.close as price, hp.volume, hp.date as price_date
    FROM stocks s
    LEFT JOIN companies c ON c.symbol = s.symbol
    INNER JOIN latest hp ON hp.symbol = s.symbol
    WHERE s.is_active = true
    ${whereClause}
    ORDER BY hp.volume DESC NULLS LAST
    LIMIT :limit
    `,
    {
      replacements: params,
      type: QueryTypes.SELECT,
    }
  );

  return (rows || []).map((r) => ({
    symbol: r.symbol,
    name: r.name,
    type: r.type,
    exchange: r.exchange_code,
    sector: r.sector || "N/A",
    industry: r.industry || "N/A",
    marketCap: r.market_cap ? Number(r.market_cap) : null,
    price: parseFloat(r.price),
    volume: r.volume ? Number(r.volume) : null,
    priceDate: r.price_date,
  }));
}
