import multer from "multer";
import path from "path";
import { env } from "../config/env";
import { HttpError } from "./error.middleware";

const ALLOWED_EXTENSIONS = [".txt", ".md"];

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
