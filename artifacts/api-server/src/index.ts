import { config } from "dotenv";
import path from "node:path";
import app from "./app";
import { logger } from "./lib/logger";

// Load .env from project root
config({ path: path.resolve(__dirname, "../../.env") });

const rawPort = process.env["PORT"];
const port = Number(rawPort || 3000);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
