import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { HttpError } from "../middleware/error.middleware";
import { chunkText } from "../utils/chunk";
import { createEmbeddings, toVectorLiteral } from "./openai.service";

// 5 params per row; pg's ceiling is 65535 params per statement.
const INSERT_BATCH_SIZE = 200;

export interface Document {
  id: string;
  user_id: string;
  filename: string;
  byte_size: number;
  chunk_count: number;
  status: "processing" | "ready" | "failed";
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function toPublicDocument(document: Document) {
  return {
    id: document.id,
    filename: document.filename,
    byteSize: document.byte_size,
    chunkCount: document.chunk_count,
    status: document.status,
    error: document.error,
    createdAt: document.created_at,
  };
}

export async function listDocuments(userId: string): Promise<Document[]> {
  const result = await pool.query<Document>(
    "SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows;
}

/** Scoped by user_id so one user can never delete another's document. */
export async function deleteDocument(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return result.rowCount === 1;
}

async function createDocument(params: {
  userId: string;
  filename: string;
  byteSize: number;
}): Promise<Document> {
  const result = await pool.query<Document>(
    `INSERT INTO documents (user_id, filename, byte_size, status)
     VALUES ($1, $2, $3, 'processing')
     RETURNING *`,
    [params.userId, params.filename, params.byteSize],
  );
  return result.rows[0];
}

async function markDocumentReady(id: string, chunkCount: number): Promise<Document> {
  const result = await pool.query<Document>(
    `UPDATE documents
     SET status = 'ready', chunk_count = $2, error = NULL, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, chunkCount],
  );
  return result.rows[0];
}

async function markDocumentFailed(id: string, message: string): Promise<void> {
  await pool.query(
    `UPDATE documents
     SET status = 'failed', error = $2, updated_at = now()
     WHERE id = $1`,
    [id, message.slice(0, 500)],
  );
}

async function insertChunks(
  client: PoolClient,
  params: { documentId: string; userId: string; chunks: string[]; embeddings: number[][] },
): Promise<void> {
  for (let offset = 0; offset < params.chunks.length; offset += INSERT_BATCH_SIZE) {
    const batch = params.chunks.slice(offset, offset + INSERT_BATCH_SIZE);
    const values: unknown[] = [];
    const placeholders: string[] = [];

    batch.forEach((content, i) => {
      const base = i * 5;
      values.push(
        params.documentId,
        params.userId,
        offset + i,
        content,
        toVectorLiteral(params.embeddings[offset + i]),
      );
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`,
      );
    });

    await client.query(
      `INSERT INTO document_chunks (document_id, user_id, chunk_index, content, embedding)
       VALUES ${placeholders.join(", ")}`,
      values,
    );
  }
}

/**
 * Parses, chunks, embeds and stores an uploaded file. The original bytes are
 * never persisted. Runs inline with the request; on failure the row is marked
 * 'failed' before rethrowing, so the user can see and delete it.
 */
export async function ingestDocument(params: {
  userId: string;
  filename: string;
  buffer: Buffer;
}): Promise<Document> {
  // A zero byte means this is binary content wearing a text extension.
  if (params.buffer.includes(0)) {
    throw new HttpError(400, "File does not appear to be plain text");
  }

  const chunks = chunkText(params.buffer.toString("utf8"));
  if (chunks.length === 0) {
    throw new HttpError(400, "File is empty");
  }

  const document = await createDocument({
    userId: params.userId,
    filename: params.filename,
    byteSize: params.buffer.byteLength,
  });

  try {
    const embeddings = await createEmbeddings(chunks);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await insertChunks(client, {
        documentId: document.id,
        userId: params.userId,
        chunks,
        embeddings,
      });
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return await markDocumentReady(document.id, chunks.length);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process document";
    await markDocumentFailed(document.id, message);
    console.error("Document ingest failed", { documentId: document.id, message });
    throw new HttpError(502, "Failed to process document");
  }
}
