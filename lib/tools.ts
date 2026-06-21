import { tool } from "ai";
import { z } from "zod";
import { evaluate } from "mathjs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tools the chat model can call (Ollama tool calling). All run locally. */
export const chatTools = {
  calculator: tool({
    description: "Evaluate a math expression and return the numeric result.",
    inputSchema: z.object({
      expression: z.string().describe("A math expression, e.g. (12.5 * 3) + 7^2"),
    }),
    execute: async ({ expression }) => {
      try {
        return { result: String(evaluate(expression)) };
      } catch {
        return { result: "error: invalid expression" };
      }
    },
  }),

  currentDateTime: tool({
    description: "Get the current local date and time.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return { iso: now.toISOString(), local: now.toString() };
    },
  }),

  fetchUrl: tool({
    description: "Fetch a web page and return its readable text content.",
    inputSchema: z.object({ url: z.string().describe("Absolute http(s) URL") }),
    execute: async ({ url }) => {
      if (!/^https?:\/\//.test(url)) return { text: "error: url must start with http" };
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) return { text: `error: HTTP ${res.status}` };
        const html = await res.text();
        return { text: stripTags(html).slice(0, 2500) };
      } catch {
        return { text: "error: failed to fetch" };
      }
    },
  }),
};
