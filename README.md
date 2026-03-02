# Manyfold Homepage Bridge (Postgres Stats)

A tiny “stats bridge” for **Manyfold** that exposes simple JSON metrics so they can be displayed in **[gethomepage/homepage](https://github.com/gethomepage/homepage)** (or any dashboard that can fetch JSON).

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
