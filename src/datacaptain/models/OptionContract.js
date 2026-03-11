/**
 * OptionContract model - Options chain data
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const OptionContract = sequelize.define(
  "OptionContract",
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
    expiration_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    strike: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    bid: {
      type: DataTypes.DECIMAL(12, 4),
    },
    ask: {
      type: DataTypes.DECIMAL(12, 4),
    },
    volume: {
      type: DataTypes.INTEGER,
    },
    open_interest: {
      type: DataTypes.INTEGER,
    },
  },
  {
    tableName: "options_contracts",
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ["symbol", "expiration_date", "type"] },
      { fields: ["symbol"] },
    ],
  }
);

export default OptionContract;
