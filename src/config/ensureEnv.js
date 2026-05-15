/** Side-effect import: load layered .env before other imports use process.env. */
import { loadApiEnv } from './loadEnv.js';

loadApiEnv();
