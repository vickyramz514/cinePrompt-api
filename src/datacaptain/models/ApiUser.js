/**
 * ApiUser model - API customers
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ApiUser = sequelize.define(
  "ApiUser",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(255),
    },
    plan: {
      type: DataTypes.STRING(20),
      defaultValue: "free",
    },
    daily_limit: {
      type: DataTypes.INTEGER,
      defaultValue: 50,
    },
  },
  {
    tableName: "api_users",
    timestamps: true,
  }
);

export default ApiUser;
