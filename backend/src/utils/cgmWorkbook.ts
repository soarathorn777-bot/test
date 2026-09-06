import ExcelJS from "exceljs";
import { HttpError } from "../middleware/error.middleware";

/**
 * Streaming reader for Glunovo-style CGM exports. Pulls two things out of the
 * readings sheet and nothing else: the timestamp and the mg/dL value.
 *
 * The workbook holds one sheet per data kind ("CGM Reading", "Carb", "Insulin"
 * ...), with eight rows of device header above the column titles. Neither the
 * sheet position nor the header row number is guaranteed across exporter
 * versions, so both are found by content. The file is read row by row and
 * handed to the caller in batches: an export covering months is hundreds of
 * thousands of rows and must never be materialised whole.
 */

export interface CgmReadingRow {
  /** Device wall clock as `YYYY-MM-DD HH:MM:SS` -- the export carries no offset. */
  recordedAt: string;
  mgDl: number;
}

export interface ParseResult {
  /** Readings the sheet contained, before the database drops any duplicates. */
  rowCount: number;
  skippedCount: number;
}

type CellValue = ExcelJS.CellValue;

const normalise = (value: unknown): string =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Unwraps the shapes exceljs uses for formulas, rich text and hyperlinks. */
function cellText(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("result" in value) return cellText(value.result as CellValue);
    if ("error" in value) return "";
  }
  return String(value);
}

function cellNumber(value: CellValue): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(cellText(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * Excel has no time zone. A date-formatted cell reaches us as a Date whose UTC
 * fields hold the literal clock the sheet shows, so those are the fields to
 * read -- getHours() would re-interpret the device's evening as the server's.
 */
function fromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const day = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${day} ${time}`;
}

/** Days between Excel's 1900 epoch (with its phantom leap day) and the Unix one. */
const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86_400_000;

const TEXT_TIMESTAMP =
  /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** Accepts the three shapes a time cell arrives in: Date, serial, or text. */
function parseTimestamp(value: CellValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return fromDate(value);

  if (typeof value === "number") {
    // A cell styled as a plain number still holds a date serial.
    if (value <= 0 || value > 2_958_466) return null;
    return fromDate(new Date(Math.round((value - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY)));
  }

  const match = TEXT_TIMESTAMP.exec(cellText(value).trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return fromDate(
    new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second ?? 0),
      ),
    ),
  );
}

interface Columns {
  time: number;
  mgDl: number;
}

/**
 * Locates the Time and mg/dL columns by title. Matching on the titles rather
 * than on fixed positions is what lets the blank spacer column, the unused
 * Calibration column, and any reordering pass through unnoticed.
 */
function findColumns(row: CellValue[]): Columns | null {
  let time = -1;
  let mgDl = -1;

  row.forEach((cell, index) => {
    const title = normalise(cellText(cell));
    if (title === "time" || title === "datetime") time = index;
    else if (title === "mgdl") mgDl = index;
  });

  return time >= 0 && mgDl >= 0 ? { time, mgDl } : null;
}

/**
 * Reads `filePath` and calls `onBatch` for every `batchSize` readings, in sheet
 * order. Rejects the file if no readings sheet is found; skips rows that carry
 * no parsable timestamp.
 */
export async function parseCgmWorkbook(
  filePath: string,
  onBatch: (rows: CgmReadingRow[]) => Promise<void>,
  batchSize = 1000,
): Promise<ParseResult> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    // Shared strings and styles must be cached: the former holds every text
    // cell, the latter is how a date cell is told from a plain number.
    sharedStrings: "cache",
    styles: "cache",
    hyperlinks: "ignore",
    worksheets: "emit",
    entries: "emit",
  });

  let found = false;
  let batch: CgmReadingRow[] = [];
  let rowCount = 0;
  let skippedCount = 0;

  try {
    // Sheets are identified by their header row, not their name: the streaming
    // reader falls back to "Sheet1" when it cannot resolve the workbook
    // relationships, and the other sheets (Carb, Insulin, Sport...) are told
    // apart by having no Time + mg/dL pair.
    for await (const worksheet of reader) {
      let columns: Columns | null = null;

      for await (const row of worksheet) {
        const values = row.values as CellValue[];

        if (!columns) {
          columns = findColumns(values);
          continue;
        }

        const recordedAt = parseTimestamp(values[columns.time]);
        // A row without a usable clock cannot be sorted, paged or deduplicated.
        if (!recordedAt) {
          skippedCount += 1;
          continue;
        }

        // Rows recorded before the sensor has settled report 0; so does a blank
        // cell. Both land as 0 rather than as a missing reading.
        const mgDl = cellNumber(values[columns.mgDl]);
        rowCount += 1;
        batch.push({
          recordedAt,
          mgDl: mgDl !== null && mgDl > 0 ? Math.round(mgDl) : 0,
        });

        if (batch.length >= batchSize) {
          await onBatch(batch);
          batch = [];
        }
      }

      if (columns) {
        found = true;
        break;
      }
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(400, `Could not read the spreadsheet: ${message}`);
  }

  if (!found) {
    throw new HttpError(
      400,
      "No CGM readings sheet found -- expected a sheet with 'Time' and 'mg/dL' columns",
    );
  }

  if (batch.length > 0) await onBatch(batch);

  return { rowCount, skippedCount };
}
