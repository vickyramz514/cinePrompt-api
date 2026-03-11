/**
 * StockSentiment model - Aggregated sentiment scores
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const StockSentiment = sequelize.define(
  "StockSentiment",
  {
    symbol: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
    },
    score: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
    },
    mentions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "stock_sentiment",
    timestamps: true,
    updatedAt: "updated_at",
  }
);

export default StockSentiment;
