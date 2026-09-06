import { useRef, useState } from "react";
import {
  useCgmUploads,
  useDeleteCgmUpload,
  useUploadWorkbook,
  type CgmUpload,
} from "../../../../data/cgm";
import { errorMessage } from "../../../../lib/api";
import { formatBytes } from "../../../../lib/format";
import {
  MAX_WORKBOOK_BYTES,
  WORKBOOK_EXTENSIONS,
  rejectWorkbook,
} from "../../../../lib/uploads";

/**
 * Upload and manage sensor exports. Parsing happens after the response, so a
 * fresh upload lands as "processing" and the list polls until it settles.
 */

const describe = (upload: CgmUpload): string => {
  if (upload.status === "processing") return "Reading the workbook...";
  if (upload.status === "failed") return upload.error ?? "Failed";
  if (upload.rowCount === 0) return "No readings found";
  if (upload.insertedCount === 0) {
    // Every row was already stored -- the usual result of re-uploading an
    // export that overlaps one already ingested.
    return `${upload.rowCount.toLocaleString()} readings, all already stored`;
  }
  return `${upload.insertedCount.toLocaleString()} of ${upload.rowCount.toLocaleString()} readings added`;
};

export const Uploads = () => {
  const uploads = useCgmUploads();
  const upload = useUploadWorkbook();
  const remove = useDeleteCgmUpload();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const onFileChange = (file: File | undefined) => {
    setRejection(null);
    upload.reset();
    if (!file) return;

    const problem = rejectWorkbook(file);
    if (problem) {
      setRejection(problem);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    upload.mutate(file, {
      // Clear the picker either way so the same file can be retried.
      onSettled: () => {
        if (fileInput.current) fileInput.current.value = "";
      },
    });
  };

  return (
    <div className="card grid gap-3.5">
      <div>
        <h2 className="card-subtitle">Sensor exports</h2>
        <p className="m-0 text-sm font-normal text-gray-500 dark:text-gray-400">
          .xlsx, up to {formatBytes(MAX_WORKBOOK_BYTES)}. Only the time and
          mg/dL columns are read. A reading already stored is never duplicated;
          removing an export deletes the readings it added.
        </p>
      </div>

      <label className="field">
        Add an export
        <input
          ref={fileInput}
          className="input"
          type="file"
          accept={WORKBOOK_EXTENSIONS.join(",")}
          disabled={upload.isPending}
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
      </label>

      {upload.isPending ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Uploading...</p>
      ) : null}
      {rejection ? <p className="alert">{rejection}</p> : null}
      {upload.error ? <p className="alert">{errorMessage(upload.error)}</p> : null}
      {remove.error ? <p className="alert">{errorMessage(remove.error)}</p> : null}

      {uploads.isPending ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Loading...</p>
      ) : uploads.error ? (
        <p className="alert">{errorMessage(uploads.error)}</p>
      ) : uploads.data.length === 0 ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Nothing uploaded yet.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {uploads.data.map((item) => (
            <li
              key={item.id}
              className="grid gap-1 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <span className="text-sm font-semibold break-all">{item.filename}</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {formatBytes(item.byteSize)} &middot; {describe(item)}
              </span>
              <button
                className="button-ghost mt-1 justify-self-start px-3 py-1.5 text-sm"
                disabled={remove.isPending || item.status === "processing"}
                onClick={() => remove.mutate(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
