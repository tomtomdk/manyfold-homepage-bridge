import express from "express";
import pg from "pg";

const { Pool } = pg;

const PORT = Number(process.env.PORT || 8787);

// Postgres connection (use PG* env vars or DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: /^true$/i.test(process.env.PGSSL || "false") ? { rejectUnauthorized: false } : undefined,
});

// Simple in-memory cache to avoid hitting DB every dashboard refresh
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 10000);
let cache = { ts: 0, data: null };

async function queryCounts() {
  // Single round-trip with subqueries
  const sql = `
    SELECT
      (SELECT COUNT(*)::int FROM models)      AS models,
      (SELECT COUNT(*)::int FROM collections) AS collections,
      (SELECT COUNT(*)::int FROM creators)    AS creators,
      (SELECT COUNT(*)::int FROM model_files) AS model_files,
      (SELECT COUNT(*)::int FROM tags)        AS tags,
      (SELECT COUNT(*)::int FROM users)       AS users
  `;
  const res = await pool.query(sql);
  return res.rows[0];
}

const app = express();

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (cache.data && now - cache.ts < CACHE_TTL_MS) {
      res.json({ ...cache.data, cached: true });
      return;
    }

    const data = await queryCounts();
    cache = { ts: now, data };

    res.json({ ...data, cached: false });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Optional: root page for quick eyeballing
app.get("/", (_req, res) => {
  res.type("text").send("manyfold-stats: GET /stats\n");
});

app.listen(PORT, () => {
  console.log(`[manyfold-stats] listening on :${PORT}`);
});
