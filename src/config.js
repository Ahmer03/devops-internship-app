// All configuration comes from environment variables. Nothing is hardcoded.
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: required("DB_HOST"),
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    database: required("DB_NAME"),
  },
  redisUrl: required("REDIS_URL"),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || "30", 10),
};
