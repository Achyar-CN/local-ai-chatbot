import { generateText } from "ai";
import { ollama } from "./ollama";
import { config } from "./config";

export interface GuardResult {
  safe: boolean;
  categories: string[];
  via: "rules" | "llama-guard" | "off";
}

/** Llama Guard 3 hazard taxonomy (S-codes -> human label). */
const LLAMA_GUARD_CATEGORIES: Record<string, string> = {
  S1: "Violent crimes",
  S2: "Non-violent crimes",
  S3: "Sex crimes",
  S4: "Child exploitation",
  S5: "Defamation",
  S6: "Specialized advice",
  S7: "Privacy",
  S8: "Intellectual property",
  S9: "Indiscriminate weapons",
  S10: "Hate",
  S11: "Self-harm",
  S12: "Sexual content",
  S13: "Elections",
  S14: "Code interpreter abuse",
};

/** Cheap regex pre-filter for the most blatant cases (runs before the model). */
const RULE_PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: "Self-harm",
    re: /\b(cara\s+(bunuh diri|mengakhiri hidup)|how to (kill myself|commit suicide)|end my life)\b/i,
  },
  {
    label: "Weapons and explosives",
    re: /\b(cara\s+(membuat|merakit)\s+(bom|peledak)|how to (make|build) a (bomb|explosive)|build a (gun|firearm) at home)\b/i,
  },
  {
    label: "Malicious hacking",
    re: /\b(ransomware|keylogger|botnet|carding|how to hack (into|someone'?s)|curi(?:lah)? (kartu kredit|password))\b/i,
  },
];

function ruleCheck(text: string): GuardResult | null {
  for (const { label, re } of RULE_PATTERNS) {
    if (re.test(text)) return { safe: false, categories: [label], via: "rules" };
  }
  return null;
}

let guardModelAvailable: boolean | null = null;

const BLOCKING = new Set(config.guardBlock);

function parseGuard(output: string): GuardResult {
  const lines = output.trim().toLowerCase().split(/\s+/);
  if (lines[0]?.startsWith("safe")) {
    return { safe: true, categories: [], via: "llama-guard" };
  }
  const codes = [...new Set(output.toUpperCase().match(/S\d{1,2}/g) ?? [])];
  // Only block on serious categories; ignore over-broad ones (advice, privacy, IP…).
  const blocking = codes.filter((c) => BLOCKING.has(c));
  if (blocking.length === 0) {
    return { safe: true, categories: [], via: "llama-guard" };
  }
  const categories = blocking.map((c) => LLAMA_GUARD_CATEGORIES[c] ?? c);
  return { safe: false, categories, via: "llama-guard" };
}

/**
 * Moderate a piece of text. Fast rule pre-filter first, then Llama Guard 3.
 * Falls back to rules-only if the guard model is not installed.
 */
export async function moderate(text: string, role: "user" | "assistant"): Promise<GuardResult> {
  const trimmed = text.trim();
  if (!trimmed) return { safe: true, categories: [], via: "rules" };

  const ruled = ruleCheck(trimmed);
  if (ruled) return ruled;

  if (guardModelAvailable === false) {
    return { safe: true, categories: [], via: "rules" };
  }

  try {
    const { text: out } = await generateText({
      model: ollama(config.guardModel),
      messages: [{ role, content: trimmed }],
      temperature: 0,
      maxOutputTokens: 50,
    });
    guardModelAvailable = true;
    return parseGuard(out);
  } catch (err) {
    console.error("Llama Guard unavailable, falling back to rules:", err);
    guardModelAvailable = false;
    return { safe: true, categories: [], via: "rules" };
  }
}

export function refusalMessage(result: GuardResult): string {
  const cats = result.categories.length ? ` (${result.categories.join(", ")})` : "";
  return [
    `I can't help with this request because it goes against the safety policy${cats}.`,
    "",
    "I can only help with safe, appropriate requests. Try asking something else, like a question about your documents.",
  ].join("\n");
}
