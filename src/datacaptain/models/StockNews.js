/**
 * Stock news headlines (symbol-tagged)
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const StockNews = sequelize.define(
  "StockNews",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    headline: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
    },
    source: {
      type: DataTypes.STRING(120),
    },
    url: {
      type: DataTypes.STRING(1024),
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "stock_news",
    timestamps: true,
    indexes: [
      { fields: ["symbol"] },
      { fields: ["published_at"] },
      { fields: ["symbol", "published_at"] },
    ],
  }
);

export default StockNews;
