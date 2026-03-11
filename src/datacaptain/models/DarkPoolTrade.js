/**
 * DarkPoolTrade model - Dark pool trading activity
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const DarkPoolTrade = sequelize.define(
  "DarkPoolTrade",
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
    price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
    volume: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    trade_time: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "dark_pool_trades",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["symbol"] }, { fields: ["trade_time"] }],
  }
);

export default DarkPoolTrade;
