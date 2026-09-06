import multer from "multer";
import os from "os";
import path from "path";
import { env } from "../config/env";
import { HttpError } from "./error.middleware";

const ALLOWED_EXTENSIONS = [".txt", ".md"];
const ALLOWED_WORKBOOK_EXTENSIONS = [".xlsx"];

// Files are held in memory: they are chunked and embedded during the request
// and the original bytes are never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Trust the extension -- browsers report the mimetype for .md inconsistently.
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new HttpError(400, "Only .txt and .md files are supported"));
    }
    cb(null, true);
  },
});

export const uploadSingle = upload.single("file");

// CGM workbooks go to disk instead: they run to tens of megabytes, the parser
// reads them as a stream, and the ingest outlives the request that started it.
// multer generates the on-disk name, so the client's filename never reaches the
// filesystem; the ingest unlinks the spool file when it finishes.
const workbookUpload = multer({
  dest: env.CGM_UPLOAD_DIR ?? path.join(os.tmpdir(), "cgm-uploads"),
  limits: { fileSize: env.MAX_CGM_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    // The extension, not the mimetype: browsers label .xlsx inconsistently and
    // exceljs will reject anything that is not really a workbook anyway.
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_WORKBOOK_EXTENSIONS.includes(ext)) {
      return cb(new HttpError(400, "Only .xlsx workbooks are supported"));
    }
    cb(null, true);
  },
});

export const uploadWorkbook = workbookUpload.single("file");
