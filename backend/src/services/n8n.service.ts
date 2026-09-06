import { env } from "../config/env";
import { HttpError } from "../middleware/error.middleware";
import type { CgmReading } from "./cgm.service";

const TIMEOUT_MS = 20_000;

/**
 * Hands a reading and its recent history to the n8n webhook, which runs the
 * analysis and emails the result -- this call does not wait for that, only
 * for n8n to accept the job.
 */
export async function requestReadingAnalysis(params: {
  email: string;
  readings: ReturnType<typeof toAnalysisPayload>;
}): Promise<void> {
  let res: Response;
  try {
    res = await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": env.N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify({ email: params.email, readings: params.readings }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, "Could not reach the analysis service");
  }
  if (!res.ok) {
    throw new HttpError(502, "The analysis service rejected the request");
  }
}

/** Only the fields the workflow needs, oldest first so it reads as a timeline. */
export function toAnalysisPayload(readings: CgmReading[]) {
  return readings
    .map((reading) => ({
      mgDl: reading.mg_dl,
      timeStamp: reading.recorded_at,
      comment: reading.comment,
    }))
    .reverse();
}
