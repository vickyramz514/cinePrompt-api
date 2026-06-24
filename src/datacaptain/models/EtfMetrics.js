/**
 * Cached ETF performance metrics for screener & heatmap
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const EtfMetrics = sequelize.define(
  "EtfMetrics",
  {
    symbol: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
    },
    as_of_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    latest_price: {
      type: DataTypes.DECIMAL(18, 4),
    },
    latest_price_date: {
      type: DataTypes.DATEONLY,
    },
    return_ytd: {
      type: DataTypes.DECIMAL(10, 4),
    },
    return_1y: {
      type: DataTypes.DECIMAL(10, 4),
    },
    return_3y: {
      type: DataTypes.DECIMAL(10, 4),
    },
    return_5y: {
      type: DataTypes.DECIMAL(10, 4),
    },
    dividend_yield_ttm: {
      type: DataTypes.DECIMAL(10, 4),
    },
    volatility_1y: {
      type: DataTypes.DECIMAL(10, 4),
    },
    avg_volume_30d: {
      type: DataTypes.BIGINT,
    },
    asset_class: {
      type: DataTypes.STRING(80),
    },
  },
  {
    tableName: "etf_metrics",
    timestamps: true,
  }
);

export default EtfMetrics;
