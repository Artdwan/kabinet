// Loaded here rather than only in index.ts so the CLI entry points
// (db:migrate, db:seed) get DATABASE_URL and SEED_DEMO too.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// Postgres rather than SQLite: the `pg` driver is pure JavaScript, so the
// server installs and runs without a native build toolchain.
const connectionString =
  process.env.DATABASE_URL || "postgresql://crm:crm@localhost:5432/kabinet";

export const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool, { schema });
