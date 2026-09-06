import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  MAX_UPLOAD_BYTES: z.coerce.number().default(1_000_000),
  // CGM exports are whole sensor histories, so they get their own, far larger
  // ceiling. They are streamed from disk rather than held in memory.
  MAX_CGM_UPLOAD_BYTES: z.coerce.number().default(104_857_600),
  // Where a CGM workbook is spooled while it is parsed. Defaults to the OS
  // temp directory; set it if that is a small tmpfs.
  CGM_UPLOAD_DIR: z.string().optional(),
  // n8n cloud webhook that receives a reading + its recent history and emails
  // the analysis. See backend/src/services/n8n.service.ts.
  N8N_WEBHOOK_URL: z.string().url("N8N_WEBHOOK_URL must be a valid URL"),
  N8N_WEBHOOK_SECRET: z.string().min(1, "N8N_WEBHOOK_SECRET is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
