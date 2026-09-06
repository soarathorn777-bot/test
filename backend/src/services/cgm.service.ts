import { promises as fs } from "fs";
import type { PoolClient } from "pg";
import { pool } from "../db/pool";
import { HttpError } from "../middleware/error.middleware";
import { CgmReadingRow, parseCgmWorkbook } from "../utils/cgmWorkbook";

// 4 params per row; pg's ceiling is 65535 params per statement.
const INSERT_BATCH_SIZE = 1000;

export interface CgmUpload {
  id: string;
  user_id: string;
  filename: string;
  byte_size: string;
  status: "processing" | "ready" | "failed";
  error: string | null;
  row_count: number;
  inserted_count: number;
  created_at: string;
  updated_at: string;
}

export interface CgmReading {
  id: string;
  mg_dl: number;
  recorded_at: string;
  comment: string;
}

export function toPublicUpload(upload: CgmUpload) {
  return {
    id: upload.id,
    filename: upload.filename,
    byteSize: Number(upload.byte_size),
    status: upload.status,
    error: upload.error,
    rowCount: upload.row_count,
    insertedCount: upload.inserted_count,
    createdAt: upload.created_at,
  };
}

export function toPublicReading(reading: CgmReading) {
  return {
    id: reading.id,
    mgDl: reading.mg_dl,
    timeStamp: reading.recorded_at,
    comment: reading.comment,
  };
}

// Timestamps are stored without a zone (the device's own clock) and are handed
// out as plain ISO-shaped text. Letting pg build a Date would re-read them in
// the server's zone and move every reading by the offset.
const TIMESTAMP_TEXT = `'YYYY-MM-DD"T"HH24:MI:SS'`;

export async function listUploads(userId: string): Promise<CgmUpload[]> {
  const result = await pool.query<CgmUpload>(
    "SELECT * FROM cgm_uploads WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows;
}

export async function getUpload(id: string, userId: string): Promise<CgmUpload | null> {
  const result = await pool.query<CgmUpload>(
    "SELECT * FROM cgm_uploads WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return result.rows[0] ?? null;
}

/** Scoped by user_id so one user can never delete another's upload. */
export async function deleteUpload(id: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM cgm_uploads WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return result.rowCount === 1;
}

async function createUpload(params: {
  userId: string;
  filename: string;
  byteSize: number;
}): Promise<CgmUpload> {
  const result = await pool.query<CgmUpload>(
    `INSERT INTO cgm_uploads (user_id, filename, byte_size, status)
     VALUES ($1, $2, $3, 'processing')
     RETURNING *`,
    [params.userId, params.filename, params.byteSize],
  );
  return result.rows[0];
}

/**
 * Writes one batch. Duplicates are dropped rather than rejected: exports
 * overlap heavily, and re-uploading last month's file alongside this month's
 * should add only the new tail -- without disturbing comments already written
 * against the readings it has in common. Returns how many rows were new.
 */
async function insertReadings(
  client: PoolClient,
  params: { uploadId: string; userId: string; rows: CgmReadingRow[] },
): Promise<number> {
  const values: unknown[] = [];
  const placeholders: string[] = [];

  params.rows.forEach((row, i) => {
    const base = i * 4;
    values.push(params.uploadId, params.userId, row.recordedAt, row.mgDl);
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}::timestamp, $${base + 4})`,
    );
  });

  const result = await client.query(
    `INSERT INTO cgm_readings (upload_id, user_id, recorded_at, mg_dl)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (user_id, recorded_at) DO NOTHING`,
    values,
  );
  return result.rowCount ?? 0;
}

async function markUploadReady(
  id: string,
  totals: { rowCount: number; insertedCount: number },
): Promise<void> {
  await pool.query(
    `UPDATE cgm_uploads
        SET status = 'ready', row_count = $2, inserted_count = $3,
            error = NULL, updated_at = now()
      WHERE id = $1`,
    [id, totals.rowCount, totals.insertedCount],
  );
}

async function markUploadFailed(id: string, message: string): Promise<void> {
  await pool.query(
    "UPDATE cgm_uploads SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
    [id, message.slice(0, 500)],
  );
}

/**
 * Streams the workbook into `cgm_readings`. Long-running by design -- a season
 * of data is a six-figure row count -- so it is started after the response is
 * sent and reports progress through the upload's status column.
 *
 * Each batch commits on its own: a file that fails three quarters of the way in
 * keeps the readings it already landed, and re-uploading it fills the rest.
 */
async function ingestWorkbook(params: {
  uploadId: string;
  userId: string;
  filePath: string;
}): Promise<void> {
  let insertedCount = 0;

  try {
    const client = await pool.connect();
    try {
      const result = await parseCgmWorkbook(
        params.filePath,
        async (rows) => {
          // Later duplicates within one file win no argument with the unique
          // index, but de-duping here keeps the statement honest.
          const seen = new Set<string>();
          const unique = rows.filter((row) => {
            if (seen.has(row.recordedAt)) return false;
            seen.add(row.recordedAt);
            return true;
          });
          insertedCount += await insertReadings(client, {
            uploadId: params.uploadId,
            userId: params.userId,
            rows: unique,
          });
        },
        INSERT_BATCH_SIZE,
      );

      if (result.rowCount === 0) {
        throw new HttpError(400, "The readings sheet has no dated rows");
      }

      await markUploadReady(params.uploadId, {
        rowCount: result.rowCount,
        insertedCount,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process the workbook";
    console.error("CGM ingest failed", { uploadId: params.uploadId, message });
    await markUploadFailed(params.uploadId, message).catch(() => {});
  } finally {
    await fs.unlink(params.filePath).catch(() => {});
  }
}

/**
 * Records the upload and returns immediately; parsing continues in the
 * background. The client polls the upload's status.
 */
export async function startIngest(params: {
  userId: string;
  filename: string;
  filePath: string;
  byteSize: number;
}): Promise<CgmUpload> {
  const upload = await createUpload({
    userId: params.userId,
    filename: params.filename,
    byteSize: params.byteSize,
  });

  void ingestWorkbook({
    uploadId: upload.id,
    userId: params.userId,
    filePath: params.filePath,
  });

  return upload;
}

export interface PageQuery {
  userId: string;
  page: number;
  pageSize: number;
  order: "asc" | "desc";
}

/**
 * One page of readings in time order. The (user_id, recorded_at) unique index
 * serves both the sort and the offset, so paging stays an index scan however
 * many readings are stored.
 */
export async function listReadings(query: PageQuery) {
  const direction = query.order === "desc" ? "DESC" : "ASC";
  const offset = (query.page - 1) * query.pageSize;

  // The count scans the whole index while the page reads 200 rows off it, so
  // the two go out together rather than the page waiting on the count.
  const [counted, result] = await Promise.all([
    pool.query<{ count: string }>(
      "SELECT count(*) AS count FROM cgm_readings WHERE user_id = $1",
      [query.userId],
    ),
    pool.query<CgmReading>(
      `SELECT id, mg_dl, to_char(recorded_at, ${TIMESTAMP_TEXT}) AS recorded_at, comment
         FROM cgm_readings
        WHERE user_id = $1
        ORDER BY recorded_at ${direction}
        LIMIT $2 OFFSET $3`,
      [query.userId, query.pageSize, offset],
    ),
  ]);

  const total = Number(counted.rows[0].count);

  return {
    readings: result.rows.map(toPublicReading),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
  };
}

/** The comment is the one field a user owns, so it is the only one updatable. */
export async function updateComment(params: {
  id: string;
  userId: string;
  comment: string;
}): Promise<CgmReading | null> {
  const result = await pool.query<CgmReading>(
    `UPDATE cgm_readings
        SET comment = $3
      WHERE id = $1 AND user_id = $2
      RETURNING id, mg_dl, to_char(recorded_at, ${TIMESTAMP_TEXT}) AS recorded_at, comment`,
    [params.id, params.userId, params.comment],
  );
  return result.rows[0] ?? null;
}

/**
 * The clicked reading plus the 9 before it, newest first. The subquery scopes
 * to `id` and `user_id` together, so a reading owned by someone else yields no
 * rows rather than leaking another user's history.
 */
export async function getRecentReadings(params: {
  id: string;
  userId: string;
}): Promise<CgmReading[]> {
  const result = await pool.query<CgmReading>(
    `SELECT id, mg_dl, to_char(recorded_at, ${TIMESTAMP_TEXT}) AS recorded_at, comment
       FROM cgm_readings
      WHERE user_id = $2
        AND recorded_at <= (
          SELECT recorded_at FROM cgm_readings WHERE id = $1 AND user_id = $2
        )
      ORDER BY recorded_at DESC
      LIMIT 10`,
    [params.id, params.userId],
  );
  return result.rows;
}
