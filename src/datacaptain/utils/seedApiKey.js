/**
 * Seed API user and API key for testing
 * Run: npm run db:seed
 */

import sequelize from "../config/database.js";
import { ApiUser, ApiKey } from "../models/index.js";
import crypto from "crypto";
import { v4 as uuid } from "uuid";

const PREFIX = "sdata_";

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateKey() {
  const random = crypto.randomBytes(24).toString("hex");
  return `${PREFIX}${random}`;
}

async function run() {
  try {
    await sequelize.authenticate();

    let user = await ApiUser.findOne({ where: { email: "dev@datacaptain.com" } });
    if (!user) {
      user = await ApiUser.create({
        id: uuid(),
        email: "dev@datacaptain.com",
        name: "Dev User",
        plan: "free",
        daily_limit: 50,
      });
      console.log("Created API user: dev@datacaptain.com");
    }

    const rawKey = generateKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const existing = await ApiKey.findOne({ where: { key_prefix: keyPrefix } });
    if (!existing) {
      await ApiKey.create({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: "Dev API Key",
        is_active: true,
      });
      console.log("\n--- API Key (save this, it won't be shown again) ---");
      console.log(rawKey);
      console.log("----------------------------------------------------\n");
      console.log("Use in requests: x-api-key: " + rawKey);
    } else {
      console.log("API key already exists for this user. Use existing key.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
