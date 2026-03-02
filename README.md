# Manyfold Homepage Bridge (Postgres Stats)

A small “stats bridge” for **Manyfold** that exposes simple JSON metrics so they can be displayed in **[gethomepage/homepage](https://github.com/gethomepage/homepage)** (or any dashboard that can fetch JSON).

Some Manyfold deployments don’t expose the expected HTTP API routes (even if Swagger/OpenAPI docs are reachable), or you may simply want a lightweight way to get totals without dealing with OAuth/scopes or API route exposure. This bridge avoids those issues by querying **Manyfold’s PostgreSQL database** directly and returning a minimal, dashboard-friendly payload.

---

## Table of contents

- [Features](#features)
- [Why this exists](#why-this-exists)
- [What it provides](#what-it-provides)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Option A: Use the repo (build locally)](#option-a-use-the-repo-build-locally)
- [Option B: Use the Docker Hub image (no build)](#option-b-use-the-docker-hub-image-no-build)
- [Homepage setup (gethomepage/homepage)](#homepage-setup-gethomepagehomepage)
- [Deployment patterns](#deployment-patterns)
- [Configuration](#configuration)
- [Security / hardening](#security--hardening)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- ✅ One endpoint: `GET /stats`
- ✅ Returns totals for:
  - Models
  - Collections
  - Creators
  - Model files
  - Tags
  - Users
- ✅ One SQL query (fast + minimal overhead)
- ✅ In-memory caching (default **10 seconds**) to reduce DB load
- ✅ Works great in Docker Compose networks
- ✅ Ideal for Homepage `customapi` widget

---

## Why this exists

Manyfold is a Rails app with a web UI, OAuth endpoints, and (depending on version/config/proxy) API routes. In some deployments you might see:

- Swagger/OpenAPI docs load, but the API endpoints are not reachable
- Reverse proxy rules only expose docs paths
- OAuth tokens are easy to mint but there are no API routes mounted
- You only need **counts** (models, creators, etc.), not full API access

This bridge avoids that entire class of problems by reading from the source of truth: the database.

---

## What it provides

### `GET /stats`

Returns a compact JSON object.

Example response:

```json
{
  "models": 90,
  "collections": 7,
  "creators": 20,
  "model_files": 1136,
  "tags": 151,
  "users": 1,
  "cached": false
}
```

- `cached` is `true` if the response came from the in-memory cache (within the TTL window).
- All other values are integer totals.

### `GET /healthz` (optional)

A simple DB connectivity check. Useful for health checks and uptime monitoring.

Example:

```bash
curl -sS http://<bridge-host>:8787/healthz | jq
```

Typical response:

```json
{ "ok": true }
```

If the database is unreachable, it will return a non-200 status with an error message:

```json
{ "ok": false, "error": "..." }
```

---

## How it works

- Connects to Postgres using either:
  - `DATABASE_URL`, **or**
  - standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
- Performs a single SQL query with subselects to fetch all counts in one round-trip:
  - `SELECT COUNT(*) FROM models`
  - `SELECT COUNT(*) FROM collections`
  - `SELECT COUNT(*) FROM creators`
  - `SELECT COUNT(*) FROM model_files`
  - `SELECT COUNT(*) FROM tags`
  - `SELECT COUNT(*) FROM users`
- Caches the results for `CACHE_TTL_MS` (default **10000 ms**) so dashboards that refresh frequently won’t hammer the DB.

### Notes on caching

The `/stats` endpoint includes a `cached` boolean:

- `cached: false` → values were fetched from Postgres on this request
- `cached: true` → values were served from the in-memory cache (within the TTL window)

You can tune caching with:

- `CACHE_TTL_MS=10000` (10 seconds, default)
- `CACHE_TTL_MS=30000` (30 seconds, less DB load)
- `CACHE_TTL_MS=0` (effectively disables caching; not recommended for dashboards)

---

## Requirements

- A running Manyfold instance using **PostgreSQL**
- DB credentials that can `SELECT` from:
  - `models`, `collections`, `creators`, `model_files`, `tags`, `users`
- Network access from the bridge container/service to the Postgres service/container  
  (in Docker Compose: **same compose network**)

---

## Quick start

If you already run Manyfold with Postgres in Docker Compose, you can add this bridge as another service on the same network.

After starting it, test:

```bash
curl -sS http://<bridge-host>:8787/stats | jq
```

Then point Homepage at the same URL.

---

## Option A: Use the repo (build locally)

### 1) Clone

```bash
git clone https://github.com/tomtomdk/manyfold-homepage-bridge.git
cd manyfold-homepage-bridge
```

### 2) Add the service to your Manyfold `docker-compose.yml`

> **Important:** attach the bridge to the same network as your Postgres service so `PGHOST=<postgres service name>` resolves.

Example service definition:

```yaml
services:
  manyfold-stats:
    build: .
    container_name: manyfold-stats
    environment:
      PGHOST: postgres-server
      PGPORT: "5432"
      PGDATABASE: manyfold
      PGUSER: driller8541
      PGPASSWORD: "${POSTGRES_PASSWORD}"

      # Cache results for 10 seconds
      CACHE_TTL_MS: "10000"

      # Optional (defaults to 8787)
      PORT: "8787"
    depends_on:
      - postgres-server
    ports:
      - "8787:8787"
    restart: unless-stopped
    networks:
      - manyfold
```

Start:

```bash
docker compose up -d --build manyfold-stats
```

Test:

```bash
curl -sS http://<host>:8787/stats | jq
```

---

## Option B: Use the Docker Hub image (no build)

If you prefer not to build locally, use the prebuilt image:

- `tomtomdk/manyfold-stats:latest`

### Compose example

```yaml
services:
  manyfold-stats:
    image: tomtomdk/manyfold-stats:latest
    container_name: manyfold-stats
    environment:
      PGHOST: postgres-server
      PGPORT: "5432"
      PGDATABASE: manyfold
      PGUSER: driller8541
      PGPASSWORD: "${POSTGRES_PASSWORD}"
      CACHE_TTL_MS: "10000"
      PORT: "8787"
    depends_on:
      - postgres-server
    ports:
      - "8787:8787"
    restart: unless-stopped
    networks:
      - manyfold
```

Start:

```bash
docker compose up -d manyfold-stats
```

Test:

```bash
curl -sS http://<host>:8787/stats | jq
```

---

## Homepage setup (gethomepage/homepage)

Homepage supports a `customapi` widget that maps JSON fields to labels.

Add an entry in your `services.yaml`:

```yaml
- Manyfold:
    href: https://your-manyfold-domain.tld
    description: 3D library
    widget:
      type: customapi
      url: http://<bridge-host>:8787/stats
      mappings:
        - label: Models
          field: models
        - label: Collections
          field: collections
        - label: Creators
          field: creators
        - label: Files
          field: model_files
        - label: Tags
          field: tags
        - label: Users
          field: users
```

### URL examples

- LAN host: `http://192.168.88.105:8787/stats`
- Same host (localhost binding): `http://127.0.0.1:8787/stats`
- Docker-to-Docker (no exposed port): `http://manyfold-stats:8787/stats` (requires Homepage on the same Docker network)

---

## Deployment patterns

There are a few common ways to run this bridge depending on where Homepage lives.

### Pattern 1: Expose on LAN (simple)

Expose the service to your LAN and let Homepage fetch it by IP:

```yaml
ports:
  - "8787:8787"
```

Homepage URL:

- `http://192.168.x.x:8787/stats`

Pros:
- Works from any machine on the LAN
- No need to join docker networks

Cons:
- Opens a port on your LAN (still usually fine for private networks)

### Pattern 2: Bind to localhost only (recommended when possible)

If Homepage runs on the **same host**, bind to localhost:

```yaml
ports:
  - "127.0.0.1:8787:8787"
```

Homepage URL:

- `http://127.0.0.1:8787/stats`

Pros:
- Not reachable from other LAN devices
- Low-effort hardening

Cons:
- Homepage must run on the same host (or you need a reverse proxy/tunnel)

### Pattern 3: Docker-only (no exposed ports)

If Homepage is containerized on the **same Docker host**, you can omit `ports:` entirely and talk over the Docker network:

- `http://manyfold-stats:8787/stats`

Example:

```yaml
services:
  manyfold-stats:
    image: tomtomdk/manyfold-stats:latest
    environment:
      PGHOST: postgres-server
      PGPORT: "5432"
      PGDATABASE: manyfold
      PGUSER: driller8541
      PGPASSWORD: "${POSTGRES_PASSWORD}"
    depends_on:
      - postgres-server
    restart: unless-stopped
    networks:
      - manyfold
```

Pros:
- No port exposure on the host/LAN
- Clean “internal service” model

Cons:
- Homepage must be on the same Docker network

---

## Configuration

### Environment variables

| Variable        | Default | Description |
|----------------|---------|-------------|
| `PORT`         | `8787`  | Port the HTTP server listens on |
| `CACHE_TTL_MS` | `10000` | Cache duration (ms) for `/stats` |
| `PGHOST`       | —       | Postgres host/service name |
| `PGPORT`       | `5432`  | Postgres port |
| `PGDATABASE`   | —       | Database name |
| `PGUSER`       | —       | Database username |
| `PGPASSWORD`   | —       | Database password |
| `DATABASE_URL` | —       | Optional single connection string |

If using `DATABASE_URL`, it typically looks like:

```text
postgresql://user:password@host:5432/manyfold
```

---

## Security / hardening

### Bind only to localhost (recommended when possible)

If Homepage runs on the **same host**, don’t expose the bridge to your LAN:

```yaml
ports:
  - "127.0.0.1:8787:8787"
```

Then use:

- `http://127.0.0.1:8787/stats`

### Use a read-only DB user (recommended)

Create a dedicated user that can only read the required tables.

Example (run in `psql`):

```sql
CREATE USER manyfold_stats WITH PASSWORD 'change_me';

GRANT CONNECT ON DATABASE manyfold TO manyfold_stats;
GRANT USAGE ON SCHEMA public TO manyfold_stats;

GRANT SELECT ON TABLE
  public.models,
  public.collections,
  public.creators,
  public.model_files,
  public.tags,
  public.users
TO manyfold_stats;
```

Then set:

- `PGUSER=manyfold_stats`
- `PGPASSWORD=change_me`

### Limit network exposure

- Prefer Docker internal networking or localhost-only binding.
- If exposing on LAN, consider firewalling the port to your dashboard host(s) only.

---

## Troubleshooting

### `getaddrinfo ENOTFOUND postgres-server`

Cause: the bridge container is not on the same Docker network as Postgres, or the service name is different.

Fix:
- Ensure the bridge has:

```yaml
networks:
  - manyfold
```

- Ensure `PGHOST` matches your compose service name (e.g. `postgres-server`).

### Connection refused / timeouts

Cause: Postgres not reachable from the bridge container.

Fix:
- Verify Postgres is running: `docker compose ps`
- Confirm `PGHOST`, `PGPORT`
- Confirm both services share a network

### Homepage widget shows blank

Cause: Homepage cannot reach the bridge URL (networking / container isolation).

Fix:
- From the Homepage host/container, run:

```bash
curl -sS http://<bridge-host>:8787/stats
```

- If Homepage is containerized, test from inside it:

```bash
docker exec -it <homepage-container> sh -lc 'wget -qO- http://<bridge-host>:8787/stats'
```

### `/stats` returns `cached: true`

Normal within the TTL window. Adjust with `CACHE_TTL_MS`.

---

## License

Add a license file to the repo (MIT is a common choice for small utilities).
