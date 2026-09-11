import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const globalConnectionString = process.env.DATABASE_URL;
const localConnectionString = process.env.LOCAL_DATABASE_URL;
const primaryConnectionString =
  globalConnectionString ?? localConnectionString;

if (!primaryConnectionString) {
  throw new Error(
    "No database URL configured. Set DATABASE_URL for your global DB or LOCAL_DATABASE_URL for local/offline storage.",
  );
}

export const globalPool = globalConnectionString
  ? new Pool({ connectionString: globalConnectionString })
  : null;

export const localPool = localConnectionString
  ? new Pool({ connectionString: localConnectionString })
  : null;

export const pool = new Pool({ connectionString: primaryConnectionString });
export const db = drizzle(pool, { schema });
export const globalDb = globalPool ? drizzle(globalPool, { schema }) : null;
export const localDb = localPool ? drizzle(localPool, { schema }) : null;

export * from "./schema";
