/**
 * Dividend model - Dividend history
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Dividend = sequelize.define(
  "Dividend",
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
    ex_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
    },
    payment_date: {
      type: DataTypes.DATEONLY,
    },
  },
  {
    tableName: "dividends",
    timestamps: true,
    indexes: [{ fields: ["symbol"] }, { fields: ["ex_date"] }],
  }
);

export default Dividend;
