/**
 * Company model - Company profile/sector info
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Company = sequelize.define(
  "Company",
  {
    symbol: {
      type: DataTypes.STRING(20),
      primaryKey: true,
      allowNull: false,
    },
    company_name: {
      type: DataTypes.STRING(255),
    },
    sector: {
      type: DataTypes.STRING(100),
    },
    industry: {
      type: DataTypes.STRING(100),
    },
    market_cap: {
      type: DataTypes.BIGINT,
    },
    exchange: {
      type: DataTypes.STRING(50),
    },
  },
  {
    tableName: "companies",
    timestamps: true,
  }
);

export default Company;
