import { pool } from "../db/pool";
import { createEmbeddings, toVectorLiteral } from "./openai.service";

const TOP_K = 5;

// Cosine similarity below this is treated as "no relevant context", so an
// off-topic question degrades to plain chat instead of being fed noise.
const MIN_SIMILARITY = 0.35;

// Keeps a single oversized chunk from dominating the prompt.
const MAX_EXCERPT_CHARS = 1200;

export interface RetrievedChunk {
  documentId: string;
  filename: string;
  content: string;
  similarity: number;
}

export interface DocumentSource {
  documentId: string;
  filename: string;
}

interface ChunkRow {
  document_id: string;
  filename: string;
  content: string;
  similarity: string;
}

export async function retrieveContext(
  userId: string,
  query: string,
): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Skip the embedding call entirely for users who have uploaded nothing.
  const counted = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM document_chunks WHERE user_id = $1) AS exists",
    [userId],
  );
  if (!counted.rows[0]?.exists) return [];

  const [embedding] = await createEmbeddings([trimmed]);
  if (!embedding) return [];

  // `<=>` is cosine distance, so similarity is 1 - distance.
  const result = await pool.query<ChunkRow>(
    `SELECT c.document_id, d.filename, c.content,
            1 - (c.embedding <=> $1::vector) AS similarity
     FROM document_chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.user_id = $2
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [toVectorLiteral(embedding), userId, TOP_K],
  );

  return result.rows
    .map((row) => ({
      documentId: row.document_id,
      filename: row.filename,
      content: row.content,
      similarity: Number(row.similarity),
    }))
    .filter((chunk) => chunk.similarity >= MIN_SIMILARITY);
}

export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] ${chunk.filename}\n${chunk.content.slice(0, MAX_EXCERPT_CHARS)}`,
    )
    .join("\n\n");
}

export function dedupeSources(chunks: RetrievedChunk[]): DocumentSource[] {
  const seen = new Map<string, DocumentSource>();

  for (const chunk of chunks) {
    if (!seen.has(chunk.documentId)) {
      seen.set(chunk.documentId, {
        documentId: chunk.documentId,
        filename: chunk.filename,
      });
    }
  }

  return [...seen.values()];
}
