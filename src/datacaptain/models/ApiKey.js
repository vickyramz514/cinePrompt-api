/**
 * ApiKey model - API keys for authentication
 */

import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ApiKey = sequelize.define(
  "ApiKey",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    key_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    key_prefix: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "api_keys",
    timestamps: true,
    indexes: [{ fields: ["key_prefix"] }, { fields: ["user_id"] }],
  }
);

export default ApiKey;
