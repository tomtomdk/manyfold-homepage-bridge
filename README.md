# manyfold-homepage-bridge

A tiny “stats bridge” service that exposes simple JSON metrics from a **Manyfold** instance so they can be displayed in **[gethomepage/homepage](https://github.com/gethomepage/homepage)**.

In some deployments, Manyfold’s HTTP API routes may not be reachable (even if OpenAPI docs are), so this service reads directly from Manyfold’s **PostgreSQL** database and returns a lightweight stats payload that Homepage can consume via the `customapi` widget.

---

## What it provides

### `GET /stats`

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
