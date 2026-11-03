const express = require("express");

const TASKS_CACHE_KEY = "tasks:all";

// Dependencies are injected so the app can be tested without real services.
function createApp({ pool, redis, cacheTtlSeconds = 30 }) {
  const app = express();
  app.use(express.json());

  // Basic request logging (goes to stdout, which is where container logs belong)
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  app.get("/", (req, res) => {
    res.json({
      service: "task-tracker",
      version: "1.0.0",
      endpoints: [
        "GET /health/live",
        "GET /health/ready",
        "GET /visits",
        "GET /tasks",
        "POST /tasks",
      ],
    });
  });

  // Liveness: is the process up?
  app.get("/health/live", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: can it reach its dependencies?
  app.get("/health/ready", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      await redis.ping();
      res.status(200).json({ status: "ready", db: "up", redis: "up" });
    } catch (err) {
      res.status(503).json({ status: "not ready", error: err.message });
    }
  });

  // Visit counter stored in Redis
  app.get("/visits", async (req, res, next) => {
    try {
      const visits = await redis.incr("visits");
      res.json({ visits });
    } catch (err) {
      next(err);
    }
  });

  // List tasks (cache-aside pattern)
  app.get("/tasks", async (req, res, next) => {
    try {
      const cached = await redis.get(TASKS_CACHE_KEY);
      if (cached) {
        return res.json({ source: "cache", tasks: JSON.parse(cached) });
      }
      const result = await pool.query(
        "SELECT id, title, done, created_at FROM tasks ORDER BY id DESC"
      );
      await redis.set(TASKS_CACHE_KEY, JSON.stringify(result.rows), {
        EX: cacheTtlSeconds,
      });
      res.json({ source: "database", tasks: result.rows });
    } catch (err) {
      next(err);
    }
  });

  // Create a task
  app.post("/tasks", async (req, res, next) => {
    try {
      const { title } = req.body || {};
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ error: "title is required" });
      }
      const result = await pool.query(
        "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, done, created_at",
        [title.trim()]
      );
      await redis.del(TASKS_CACHE_KEY);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: "not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}

module.exports = { createApp };
