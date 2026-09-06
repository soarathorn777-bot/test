import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { type Turn, useSendMessage } from "../../../../data/chat";
import { errorMessage } from "../../../../lib/api";
import { Bubble } from "./Bubble";

export const Conversation = () => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const sendMessage = useSendMessage();
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, sendMessage.isPending]);

  const onSubmit = (event: SubmitEvent) => {
    event.preventDefault();

    const content = input.trim();
    if (!content || sendMessage.isPending) return;

    // The whole transcript goes up every turn; the server holds no state.
    const next: Turn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setInput("");

    sendMessage.mutate(
      next.map((turn) => ({ role: turn.role, content: turn.content })),
      {
        onSuccess: (reply) =>
          setTurns((current) => [
            ...current,
            { ...reply.message, sources: reply.sources },
          ]),
      },
    );
  };

  return (
    <div className="card flex h-[70vh] flex-col gap-4">
      <div>
        <h1 className="card-title">Chat</h1>
        <p className="m-0 text-sm font-normal text-gray-500 dark:text-gray-400">
          Answers are grounded in the documents you upload, when they are
          relevant.
        </p>
      </div>

      <div
        ref={transcriptRef}
        className="flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {turns.length === 0 ? (
          <p className="font-normal text-gray-500 dark:text-gray-400">
            Ask a question to get started.
          </p>
        ) : (
          turns.map((turn, i) => <Bubble key={i} turn={turn} />)
        )}

        {sendMessage.isPending ? (
          <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
            Thinking...
          </p>
        ) : null}
      </div>

      {sendMessage.error ? (
        <p className="alert">{errorMessage(sendMessage.error)}</p>
      ) : null}

      <form className="flex gap-2" onSubmit={onSubmit}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your documents..."
          aria-label="Message"
        />
        <button
          className="button"
          type="submit"
          disabled={sendMessage.isPending || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};
