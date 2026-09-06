import type { Turn } from "../../../../data/chat";

export const Bubble = ({ turn }: { turn: Turn }) => {
  const isUser = turn.role === "user";

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
          isUser
            ? "bg-blue-600 text-white dark:bg-blue-400 dark:text-gray-950"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-200"
        }`}
      >
        <p className="m-0 font-normal whitespace-pre-wrap">{turn.content}</p>

        {turn.sources?.length ? (
          <p className="m-0 mt-2 text-xs font-normal opacity-75">
            Sources: {turn.sources.map((s) => s.filename).join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
};
