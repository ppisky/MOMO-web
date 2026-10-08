import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        text: z.string().max(20000),
      }),
    )
    .min(1)
    .max(100),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text-delta"), text: z.string() }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof streamEventSchema>;

/** A replaceable conversation engine. No UI or desktop-runtime types cross this boundary. */
export interface ConversationEngine {
  readonly id: string;
  stream(request: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}
