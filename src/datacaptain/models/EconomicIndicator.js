/**
 * EconomicIndicator model - Macro economic data
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const EconomicIndicator = sequelize.define(
  "EconomicIndicator",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    indicator_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
    },
  },
  {
    tableName: "economic_indicators",
    timestamps: true,
    updatedAt: "updated_at",
  }
);

export default EconomicIndicator;
