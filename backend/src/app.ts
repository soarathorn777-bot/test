import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error.middleware";
import { apiLimiter } from "./middleware/rateLimit.middleware";
import routes from "./routes";

export const app = express();

// Railway (and any other reverse proxy) terminates TLS and forwards the client
// address in X-Forwarded-For. Without this, express-rate-limit keys every
// request to the proxy's IP and would throttle all users as one.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiLimiter, routes);

app.use(errorHandler);
