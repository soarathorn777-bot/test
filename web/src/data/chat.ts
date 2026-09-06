import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentSource {
  documentId: string;
  filename: string;
}

export interface ChatReply {
  message: ChatMessage;
  sources: DocumentSource[];
}

/** A chat message plus the documents that grounded it, for assistant turns. */
export interface Turn extends ChatMessage {
  sources?: DocumentSource[];
}

/**
 * The backend is stateless about conversations: every turn posts the whole
 * transcript, and it retrieves context from the latest user message.
 */
export const useSendMessage = () => {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) =>
      api.post<ChatReply>("/api/chat", { messages }),
  });
};
