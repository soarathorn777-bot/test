import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const sendMessageSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
