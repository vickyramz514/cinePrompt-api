/**
 * Layered env files for cinePrompt-api (similar spirit to Next.js).
 *
 * Order (later files override earlier when override=true):
 *   1. cinePrompt-api/.env
 *   2. When NODE_ENV=production: monorepo .env.production, then cinePrompt-api/.env.production
 *   3. monorepo .env.local, then cinePrompt-api/.env.local
 *
 * On Railway/hosted prod, files are usually absent — process.env from the host wins.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** cinePrompt-api package root */
const apiRoot = path.resolve(__dirname, '../..');
/** Monorepo root (parent of cinePrompt-api) */
const repoRoot = path.resolve(apiRoot, '..');

function loadFile(absPath, override) {
  if (!fs.existsSync(absPath)) return;
  dotenv.config({ path: absPath, override: !!override });
}

export function loadApiEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  loadFile(path.join(apiRoot, '.env'), false);

  if (nodeEnv === 'production') {
    loadFile(path.join(repoRoot, '.env.production'), true);
    loadFile(path.join(apiRoot, '.env.production'), true);
  }

  loadFile(path.join(repoRoot, '.env.local'), true);
  loadFile(path.join(apiRoot, '.env.local'), true);
}
