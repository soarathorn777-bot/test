import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { ChatMessage, createChatCompletion } from "../services/openai.service";
import { dedupeSources, formatContext, retrieveContext } from "../services/retrieval.service";

export const sendMessageHandler = asyncHandler(async (req: Request, res: Response) => {
  const messages = req.body.messages as ChatMessage[];

  // The latest user turn is what we search the user's documents with.
  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
  const chunks = lastUserMessage
    ? await retrieveContext(req.user!.userId, lastUserMessage.content)
    : [];

  const content = await createChatCompletion(
    messages,
    chunks.length > 0 ? formatContext(chunks) : undefined,
  );

  res.status(200).json({
    message: { role: "assistant", content },
    sources: dedupeSources(chunks),
  });
});
