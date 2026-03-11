/**
 * WebSocket server for real-time stock price streaming
 * Clients subscribe to symbols and receive periodic price updates
 */

import { WebSocketServer } from "ws";
import * as stockService from "../services/stockService.js";
import logger from "../utils/logger.js";

const BROADCAST_INTERVAL_MS = 5000; // 5 seconds
let intervalId = null;
const subscribers = new Set(); // Set of { ws, symbols: Set }

function getSubscribedSymbols() {
  const symbols = new Set();
  for (const sub of subscribers) {
    for (const s of sub.symbols) symbols.add(s);
  }
  return Array.from(symbols);
}

async function broadcastPrices() {
  const symbols = getSubscribedSymbols();
  if (symbols.length === 0) return;

  const prices = await Promise.all(
    symbols.map(async (sym) => {
      try {
        return await stockService.getLatestPrice(sym);
      } catch {
        return null;
      }
    })
  );

  const payload = prices.filter(Boolean);

  for (const sub of subscribers) {
    if (sub.ws.readyState !== 1) continue;
    const filtered = payload.filter((p) => sub.symbols.has(p.symbol));
    if (filtered.length > 0) {
      sub.ws.send(JSON.stringify({ type: "prices", data: filtered }));
    }
  }
}

function startBroadcast() {
  if (intervalId) return;
  intervalId = setInterval(broadcastPrices, BROADCAST_INTERVAL_MS);
  logger.info("WebSocket price broadcast started");
}

function stopBroadcast() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("WebSocket price broadcast stopped");
  }
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ path: "/ws", server });

  wss.on("connection", (ws, req) => {
    const sub = { ws, symbols: new Set() };
    subscribers.add(sub);

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.action === "subscribe" && Array.isArray(msg.symbols)) {
          msg.symbols.forEach((s) => sub.symbols.add(String(s).toUpperCase()));
        }
        if (msg.action === "unsubscribe" && Array.isArray(msg.symbols)) {
          msg.symbols.forEach((s) => sub.symbols.delete(String(s).toUpperCase()));
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    });

    ws.on("close", () => {
      subscribers.delete(sub);
      if (subscribers.size === 0) stopBroadcast();
    });

    startBroadcast();
  });

  return wss;
}
