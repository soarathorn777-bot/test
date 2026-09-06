import { useRef, useState } from "react";
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "../../../../data/documents";
import { errorMessage } from "../../../../lib/api";
import { formatBytes } from "../../../../lib/format";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  rejectFile,
} from "../../../../lib/uploads";

export const Documents = () => {
  const documents = useDocuments();
  const upload = useUploadDocument();
  const remove = useDeleteDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const onFileChange = (file: File | undefined) => {
    setRejection(null);
    upload.reset();
    if (!file) return;

    const problem = rejectFile(file);
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
        <h2 className="card-subtitle">Documents</h2>
        <p className="m-0 text-sm font-normal text-gray-500 dark:text-gray-400">
          .txt or .md, up to {formatBytes(MAX_UPLOAD_BYTES)}. Each upload is
          chunked and embedded on the server.
        </p>
      </div>

      <label className="field">
        Add a document
        <input
          ref={fileInput}
          className="input"
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          disabled={upload.isPending}
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
      </label>

      {upload.isPending ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Embedding...
        </p>
      ) : null}
      {rejection ? <p className="alert">{rejection}</p> : null}
      {upload.error ? (
        <p className="alert">{errorMessage(upload.error)}</p>
      ) : null}
      {remove.error ? (
        <p className="alert">{errorMessage(remove.error)}</p>
      ) : null}

      {documents.isPending ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Loading...
        </p>
      ) : documents.error ? (
        <p className="alert">{errorMessage(documents.error)}</p>
      ) : documents.data.length === 0 ? (
        <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
          Nothing uploaded yet.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0">
          {documents.data.map((doc) => (
            <li
              key={doc.id}
              className="grid gap-1 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
            >
              <span className="text-sm font-semibold break-all">
                {doc.filename}
              </span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                {formatBytes(doc.byteSize)} &middot; {doc.chunkCount}{" "}
                {doc.chunkCount === 1 ? "chunk" : "chunks"} &middot;{" "}
                {doc.status}
              </span>
              {doc.error ? (
                <span className="text-xs font-normal text-red-700 dark:text-red-300">
                  {doc.error}
                </span>
              ) : null}
              <button
                className="button-ghost mt-1 justify-self-start px-3 py-1.5 text-sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate(doc.id)}
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
