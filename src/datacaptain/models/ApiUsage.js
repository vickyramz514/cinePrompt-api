/**
 * ApiUsage model - Tracks API request logs for analytics
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ApiUsage = sequelize.define(
  "ApiUsage",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "api_keys", key: "id" },
    },
    api_key: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    endpoint: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    response_time: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "api_usage",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { fields: ["key_id", "created_at"] },
      { fields: ["created_at"] },
    ],
  }
);

export default ApiUsage;
