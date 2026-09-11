import { defineConfig } from "drizzle-kit";

// Determine which database we're using
const isLocal = !!process.env.LOCAL_DATABASE_URL && !process.env.DATABASE_URL;
const dbUrl = process.env.DATABASE_URL ?? process.env.LOCAL_DATABASE_URL;

if (!dbUrl) {
  throw new Error(
    "No database URL configured. Set DATABASE_URL for global DB or LOCAL_DATABASE_URL for local DB.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: isLocal ? "sqlite" : "postgresql",
  dbCredentials: isLocal 
    ? {
        url: dbUrl,
      }
    : {
        url: dbUrl,
      },
});
