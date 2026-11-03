const config = require("./config");
const { createPool, initDb } = require("./db");
const { createCache } = require("./cache");
const { createApp } = require("./app");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Dependencies may start slower than the app, so retry instead of crashing.
async function withRetry(label, fn, attempts = 10, delayMs = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`${label} not ready (attempt ${i}/${attempts}): ${err.message}`);
      if (i === attempts) throw err;
      await sleep(delayMs);
    }
  }
}

async function main() {
  const pool = createPool(config.db);
  await withRetry("PostgreSQL", () => initDb(pool));
  const redis = await withRetry("Redis", () => createCache(config.redisUrl));

  const app = createApp({ pool, redis, cacheTtlSeconds: config.cacheTtlSeconds });

  // Bind to 0.0.0.0 so the app is reachable from outside its own network namespace
  const server = app.listen(config.port, "0.0.0.0", () => {
    console.log(`Server listening on port ${config.port} (${config.nodeEnv})`);
  });

  // Graceful shutdown on SIGTERM/SIGINT
  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end();
      await redis.quit();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err.message);
  process.exit(1);
});
