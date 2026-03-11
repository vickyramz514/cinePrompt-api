/**
 * InsiderTrade model - Insider trading activity
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const InsiderTrade = sequelize.define(
  "InsiderTrade",
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
    insider_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(100),
    },
    transaction_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    shares: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(12, 4),
    },
    trade_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    tableName: "insider_trades",
    timestamps: true,
    updatedAt: false,
    indexes: [{ fields: ["symbol"] }, { fields: ["trade_date"] }],
  }
);

export default InsiderTrade;
