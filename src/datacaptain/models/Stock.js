/**
 * Stock model - Symbol/index for price lookup
 * Maps to Instrument table or new stocks table
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Stock = sequelize.define(
  "Stock",
  {
    symbol: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
    },
    type: {
      type: DataTypes.STRING(20),
      defaultValue: "ETF",
    },
    exchange_code: {
      type: DataTypes.STRING(20),
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "stocks",
    timestamps: true,
  }
);

export default Stock;
