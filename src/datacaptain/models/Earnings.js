/**
 * Earnings model - Earnings reports
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Earnings = sequelize.define(
  "Earnings",
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
    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    eps: {
      type: DataTypes.DECIMAL(10, 4),
    },
    revenue: {
      type: DataTypes.BIGINT,
    },
    consensus_eps: {
      type: DataTypes.DECIMAL(10, 4),
    },
  },
  {
    tableName: "earnings",
    timestamps: true,
    indexes: [{ fields: ["symbol"] }, { fields: ["report_date"] }],
  }
);

export default Earnings;
