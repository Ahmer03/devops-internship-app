# DevOps Internship App: Task Tracker API

A small Node.js + Express API used to practice containerization. It stores tasks in **PostgreSQL** and uses **Redis** as a cache and visit counter.

## Architecture

| Service | Image | Role | Exposed to host? |
|---------|-------|------|------------------|
| `web` | built from `Dockerfile` | Express API | Yes, port `8080` |
| `db` | `postgres:16-alpine` | Permanent task storage | No (internal only) |
| `redis` | `redis:7-alpine` | Cache and visit counter | No (internal only) |

All three services share a private `backend` network and reach each other by service name (`db`, `redis`). Postgres data is kept in the named volume `db_data`.

## Quick start

```bash
cp .env.example .env
# edit .env and set DB_USER and DB_PASSWORD
docker compose up --build -d
docker compose ps
```

Wait until all three services show `healthy`.

## Configuration

All configuration is passed at **runtime** through `.env`. Nothing is baked into the image, and `.env` is never committed.

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Port the app listens on inside the container | `3000` |
| `NODE_ENV` | Runtime mode | `production` |
| `DB_HOST` | Postgres service name | `db` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USER` | Postgres user | `tasks_user` |
| `DB_PASSWORD` | Postgres password (secret) | set your own |
| `DB_NAME` | Database name | `tasks_db` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379` |
| `CACHE_TTL_SECONDS` | How long the task list stays cached | `30` |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/live` | Process is up |
| GET | `/health/ready` | App can reach Postgres and Redis |
| GET | `/visits` | Visit counter (Redis) |
| GET | `/tasks` | List tasks (`source` shows `database` or `cache`) |
| POST | `/tasks` | Create a task, JSON body `{"title": "..."}` |

Example:

```bash
curl http://localhost:8080/health/ready
curl -X POST http://localhost:8080/tasks -H "Content-Type: application/json" -d '{"title":"learn docker"}'
curl http://localhost:8080/tasks
```

## Docker image optimization

The image uses a multi-stage build: dependencies are installed in a first stage, and only the production `node_modules` and the source code are copied into a small Alpine-based final stage.

| Image | Disk usage | Compressed size |
|-------|-----------|-----------------|
| Single-stage (`node:20`, naive) | 1.67 GB | 410 MB |
| Multi-stage (`node:20-alpine`) | **206 MB** | **49.5 MB** |
| Reduction | about 88% | about 88% |

What made the difference:
- Small `node:20-alpine` base instead of the full `node:20` image
- `npm ci --omit=dev` leaves out dev tools (jest, eslint, supertest)
- `.dockerignore` keeps `node_modules`, `.git`, `.env` and tests out of the build

## Security and reliability choices

- Runs as the non-root `node` user
- No secrets in the image, `ENV`, or `ARG`; configuration comes from `.env` at runtime
- Only the `web` port is published; the database and Redis are not reachable from the host
- Healthchecks on all three services; `web` starts only after `db` and `redis` are healthy
- Postgres data persists in a named volume across `docker compose down` and `up`
- `CMD ["node", ...]` runs Node directly so the app receives shutdown signals

## Useful commands

```bash
docker compose logs web        # app logs
docker compose down            # stop and remove containers (data is kept)
docker compose down -v         # also delete the database volume (data is lost)
```