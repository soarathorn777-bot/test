import { useEffect, useState } from "react";
import { useAnalyzeReading, useUpdateComment, type CgmReading } from "../../../../data/cgm";
import { errorMessage } from "../../../../lib/api";
import { formatWallClock } from "../../../../lib/wallClock";

/** The readings behind the chart, with the one editable field on each row. */

interface Props {
  readings: CgmReading[];
}

/**
 * Saves on blur rather than on each keystroke, so a comment is one request
 * instead of one per character. Escape abandons the edit.
 */
const CommentCell = ({ reading }: { reading: CgmReading }) => {
  const update = useUpdateComment();
  const [draft, setDraft] = useState(reading.comment);

  // A save elsewhere (or a page change reusing this row) refreshes the input,
  // but never while the user is the one holding it.
  useEffect(() => {
    setDraft(reading.comment);
  }, [reading.id, reading.comment]);

  const save = () => {
    if (draft === reading.comment) return;
    update.mutate({ id: reading.id, comment: draft });
  };

  return (
    <div className="grid gap-1">
      <input
        className="input px-2 py-1 text-sm"
        value={draft}
        placeholder="Add a note"
        aria-label={`Comment for ${formatWallClock(reading.timeStamp)}`}
        disabled={update.isPending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(reading.comment);
            e.currentTarget.blur();
          }
        }}
      />
      {update.error ? (
        <span className="text-xs text-red-700 dark:text-red-300">
          {errorMessage(update.error)}
        </span>
      ) : null}
    </div>
  );
};

/**
 * Sends this reading and its previous 9 to n8n, which runs the analysis and
 * emails it -- nothing comes back here to display beyond send/fail.
 */
const AnalyzeButton = ({ readingId }: { readingId: string }) => {
  const analyze = useAnalyzeReading();

  if (analyze.isSuccess) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">Sent</span>;
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
        disabled={analyze.isPending}
        onClick={() => analyze.mutate(readingId)}
      >
        {analyze.isPending ? "Sending…" : "Analyze with AI"}
      </button>
      {analyze.error ? (
        <span className="text-xs text-red-700 dark:text-red-300">
          {errorMessage(analyze.error)}
        </span>
      ) : null}
    </div>
  );
};

export const ReadingsTable = ({ readings }: Props) => (
  // Bounded and scrolled in place: a page can be a thousand rows, and letting
  // them all extend the document buries everything below the table.
  <div className="max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 bg-white dark:bg-gray-900">
        <tr className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400">
          <th className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            Time
          </th>
          <th className="border-b border-gray-200 px-3 py-2 text-right dark:border-gray-800">
            mg/dL
          </th>
          <th className="w-1/2 border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            Comment
          </th>
          <th className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
            AI
          </th>
        </tr>
      </thead>
      <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
        {readings.map((reading) => (
          <tr
            key={reading.id}
            className="border-b border-gray-100 last:border-0 dark:border-gray-800"
          >
            <td className="px-3 py-1.5 font-normal whitespace-nowrap text-gray-500 dark:text-gray-400">
              {formatWallClock(reading.timeStamp)}
            </td>
            <td className="px-3 py-1.5 text-right">{reading.mgDl}</td>
            <td className="px-3 py-1.5">
              <CommentCell reading={reading} />
            </td>
            <td className="px-3 py-1.5">
              <AnalyzeButton readingId={reading.id} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
