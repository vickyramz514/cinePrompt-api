/**
 * HistoricalPrice model - Daily OHLCV data
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const HistoricalPrice = sequelize.define(
  "HistoricalPrice",
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    open: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
    },
    high: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
    },
    low: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
    },
    close: {
      type: DataTypes.DECIMAL(18, 4),
      allowNull: false,
    },
    volume: {
      type: DataTypes.BIGINT,
    },
  },
  {
    tableName: "historical_prices",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["symbol", "date"] },
      { fields: ["symbol"] },
      { fields: ["date"] },
    ],
  }
);

export default HistoricalPrice;
