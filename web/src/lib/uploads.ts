import { formatBytes } from "./format";

/** Mirrors the backend's multer config: `.txt` / `.md`, one file, 1 MB. */
export const ACCEPTED_EXTENSIONS = [".txt", ".md"];
export const MAX_UPLOAD_BYTES = 1_000_000;

/** Checked before uploading so a doomed file never spends a request. */
export const rejectFile = (file: File): string | null => {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return "Only .txt and .md files are supported";
  }
  if (file.size === 0) return "That file is empty";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(MAX_UPLOAD_BYTES)}`;
  }
  return null;
};
