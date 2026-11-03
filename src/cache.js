const { createClient } = require("redis");

async function createCache(url) {
  const client = createClient({ url });
  client.on("error", (err) => console.error("Redis error:", err.message));
  await client.connect();
  return client;
}

module.exports = { createCache };
