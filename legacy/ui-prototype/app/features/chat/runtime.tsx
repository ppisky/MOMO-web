import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
} from "@assistant-ui/react";
import { useMemo, type ReactNode } from "react";
import type { ConversationEngine } from "../../../shared/contracts/chat";

export function ChatRuntime({
  engine,
  children,
}: {
  engine: ConversationEngine;
  children: ReactNode;
}) {
  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async *run({ messages, abortSignal }) {
        let text = "";
        for await (const event of engine.stream(
          {
            messages: messages.map((m) => ({
              role: m.role,
              text: m.content
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("\n"),
            })),
          },
          abortSignal,
        )) {
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "text-delta") {
            text += event.text;
            yield { content: [{ type: "text", text }] };
          }
        }
      },
    }),
    [engine],
  );
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
