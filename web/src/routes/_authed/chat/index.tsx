import { createFileRoute } from "@tanstack/react-router";
import { Conversation } from "./-components/Conversation";
import { Documents } from "./-components/Documents";

export const Route = createFileRoute("/_authed/chat/")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Conversation />
      <Documents />
    </div>
  );
}
