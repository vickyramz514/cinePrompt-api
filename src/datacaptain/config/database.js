/**
 * Sequelize database connection
 * Connects to PostgreSQL
 */

import Sequelize from "sequelize";
import config from "./index.js";

const url = config.database?.url;
if (!url) {
  throw new Error("DATABASE_URL is required. Set it in .env (e.g. postgresql://user:pass@host:5432/dbname)");
}

const sequelize = new Sequelize(url, {
  dialect: "postgres",
  logging: config.env === "development" ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export { sequelize };
export default sequelize;
