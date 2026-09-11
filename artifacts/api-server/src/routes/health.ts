import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { supabaseConfig } from "../lib/supabase";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json({
    ...data,
    supabase: {
      configured: Boolean(supabaseConfig.url),
      publishableKeyConfigured: supabaseConfig.hasPublishableKey,
      secretKeyConfigured: supabaseConfig.hasSecretKey,
      url: supabaseConfig.url,
    },
  });
});

export default router;
