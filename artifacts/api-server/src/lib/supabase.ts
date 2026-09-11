import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env from project root (3 levels up from lib/supabase.ts)
config({ path: path.resolve(__dirname, "../../../.env") });

const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? anonKey;

export const supabaseConfig = {
  url,
  hasPublishableKey: Boolean(anonKey),
  hasSecretKey: Boolean(secretKey),
};

export const supabase = url 
  ? createClient(url, secretKey || anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-app-name": "janvyapar-offline-order",
      },
    },
  })
  : null;
