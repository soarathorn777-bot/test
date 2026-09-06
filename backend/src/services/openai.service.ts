import OpenAI from "openai";
import type { Fetch } from "openai/core";
import { env } from "../config/env";

const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, fetch: globalThis.fetch as unknown as Fetch });

// The embeddings endpoint accepts far more, but smaller batches keep any single
// request well inside the per-request token ceiling.
const EMBEDDING_BATCH_SIZE = 96;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const BASE_SYSTEM_PROMPT = "You are a helpful assistant.";

function groundedSystemPrompt(context: string): string {
  return [
    BASE_SYSTEM_PROMPT,
    "",
    "Use the CONTEXT below to answer when it is relevant. The context comes from documents the user uploaded.",
    "If the context does not contain the answer, say so plainly and then answer from general knowledge, making clear which you are doing.",
    "Never invent quotes, filenames, or citations that are not in the context.",
    "",
    "CONTEXT:",
    context,
  ].join("\n");
}

export async function createChatCompletion(
  messages: ChatMessage[],
  context?: string,
): Promise<string> {
  const systemPrompt = context ? groundedSystemPrompt(context) : BASE_SYSTEM_PROMPT;

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
  });

  return completion.choices[0]?.message?.content ?? "";
}

/** Embeds inputs in batches. Output order always matches input order. */
export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const embeddings: number[][] = [];

  for (let i = 0; i < inputs.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = inputs.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await client.embeddings.create({
      model: env.OPENAI_EMBEDDING_MODEL,
      input: batch,
    });

    // The API may return data out of order; `index` is authoritative.
    const ordered = [...response.data].sort((a, b) => a.index - b.index);
    embeddings.push(...ordered.map((item) => item.embedding));
  }

  return embeddings;
}

/** pgvector accepts this literal via a `$n::vector` cast, so no client library is needed. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
