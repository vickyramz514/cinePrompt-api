/**
 * Sequelize models - Central export
 * Syncs models and associations
 */

import sequelize from "../config/database.js";
import Stock from "./Stock.js";
import HistoricalPrice from "./HistoricalPrice.js";
import Company from "./Company.js";
import Dividend from "./Dividend.js";
import Earnings from "./Earnings.js";
import ApiUser from "./ApiUser.js";
import ApiKey from "./ApiKey.js";
import ApiUsage from "./ApiUsage.js";
import OptionContract from "./OptionContract.js";
import InsiderTrade from "./InsiderTrade.js";
import StockSentiment from "./StockSentiment.js";
import EconomicIndicator from "./EconomicIndicator.js";
import DarkPoolTrade from "./DarkPoolTrade.js";

// Associations
Stock.hasMany(HistoricalPrice, { foreignKey: "symbol", sourceKey: "symbol" });
HistoricalPrice.belongsTo(Stock, { foreignKey: "symbol", targetKey: "symbol" });

Stock.hasMany(Dividend, { foreignKey: "symbol" });
Dividend.belongsTo(Stock, { foreignKey: "symbol" });

Stock.hasMany(Earnings, { foreignKey: "symbol" });
Earnings.belongsTo(Stock, { foreignKey: "symbol" });

Company.hasOne(Stock, { foreignKey: "symbol", targetKey: "symbol" });
Stock.belongsTo(Company, { foreignKey: "symbol", targetKey: "symbol" });

ApiUser.hasMany(ApiKey, { foreignKey: "user_id" });
ApiKey.belongsTo(ApiUser, { foreignKey: "user_id" });

ApiKey.hasMany(ApiUsage, { foreignKey: "key_id" });
ApiUsage.belongsTo(ApiKey, { foreignKey: "key_id" });

export {
  sequelize,
  Stock,
  HistoricalPrice,
  Company,
  Dividend,
  Earnings,
  ApiUser,
  ApiKey,
  ApiUsage,
  OptionContract,
  InsiderTrade,
  StockSentiment,
  EconomicIndicator,
  DarkPoolTrade,
};

export default sequelize;
