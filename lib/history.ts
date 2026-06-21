import type { UIMessage } from "ai";
import { config } from "./config";

function textLen(m: UIMessage): number {
  return (m.parts as { type: string; text?: string }[])
    .filter((p) => p.type === "text")
    .reduce((n, p) => n + (p.text?.length ?? 0), 0);
}

/**
 * Keep the most recent messages within a character budget so long chats stay
 * fast on CPU. Always keeps at least the final message.
 */
export function trimHistory(messages: UIMessage[], budget = config.historyBudget): UIMessage[] {
  if (messages.length <= 2) return messages;
  const kept: UIMessage[] = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const len = textLen(messages[i]);
    if (kept.length > 0 && total + len > budget) break;
    kept.push(messages[i]);
    total += len;
  }
  return kept.reverse();
}
