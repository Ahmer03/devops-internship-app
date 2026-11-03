const request = require("supertest");
const { createApp } = require("../src/app");

function buildApp() {
  const store = {};
  const pool = {
    query: jest.fn(async (sql) => {
      if (sql.startsWith("INSERT")) {
        return { rows: [{ id: 1, title: "demo", done: false, created_at: "now" }] };
      }
      return { rows: [] };
    }),
  };
  const redis = {
    ping: jest.fn(async () => "PONG"),
    incr: jest.fn(async () => 1),
    get: jest.fn(async (k) => store[k] || null),
    set: jest.fn(async (k, v) => { store[k] = v; }),
    del: jest.fn(async (k) => { delete store[k]; }),
  };
  return createApp({ pool, redis });
}

describe("task tracker API", () => {
  test("GET /health/live returns 200", async () => {
    const res = await request(buildApp()).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /health/ready returns 200 when dependencies are up", async () => {
    const res = await request(buildApp()).get("/health/ready");
    expect(res.status).toBe(200);
  });

  test("POST /tasks rejects missing title", async () => {
    const res = await request(buildApp()).post("/tasks").send({});
    expect(res.status).toBe(400);
  });

  test("POST /tasks creates a task", async () => {
    const res = await request(buildApp()).post("/tasks").send({ title: "demo" });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("demo");
  });

  test("unknown route returns 404", async () => {
    const res = await request(buildApp()).get("/nope");
    expect(res.status).toBe(404);
  });
});
