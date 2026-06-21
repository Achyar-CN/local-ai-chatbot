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
  S1: "Kejahatan dengan kekerasan",
  S2: "Kejahatan tanpa kekerasan",
  S3: "Kejahatan seksual",
  S4: "Eksploitasi seksual anak",
  S5: "Pencemaran nama baik",
  S6: "Nasihat khusus (medis/hukum/finansial)",
  S7: "Privasi",
  S8: "Kekayaan intelektual",
  S9: "Senjata pemusnah massal",
  S10: "Ujaran kebencian",
  S11: "Bunuh diri & melukai diri",
  S12: "Konten seksual",
  S13: "Pemilu",
  S14: "Penyalahgunaan interpreter kode",
};

/** Cheap regex pre-filter for the most blatant cases (runs before the model). */
const RULE_PATTERNS: { label: string; re: RegExp }[] = [
  {
    label: "Bunuh diri & melukai diri",
    re: /\b(cara\s+(bunuh diri|mengakhiri hidup)|how to (kill myself|commit suicide)|end my life)\b/i,
  },
  {
    label: "Senjata/bahan peledak",
    re: /\b(cara\s+(membuat|merakit)\s+(bom|peledak)|how to (make|build) a (bomb|explosive)|build a (gun|firearm) at home)\b/i,
  },
  {
    label: "Peretasan berbahaya",
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

function parseGuard(output: string): GuardResult {
  const lines = output.trim().toLowerCase().split(/\s+/);
  if (lines[0]?.startsWith("safe")) {
    return { safe: true, categories: [], via: "llama-guard" };
  }
  const codes = output.toUpperCase().match(/S\d{1,2}/g) ?? [];
  const categories = [...new Set(codes)].map((c) => LLAMA_GUARD_CATEGORIES[c] ?? c);
  return { safe: false, categories: categories.length ? categories : ["Konten tidak aman"], via: "llama-guard" };
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
    `Maaf, permintaan ini tidak dapat saya proses karena melanggar kebijakan keamanan${cats}.`,
    "",
    "Saya hanya bisa membantu permintaan yang aman dan sesuai etika. Silakan ajukan pertanyaan lain — misalnya tentang isi dokumen Anda.",
  ].join("\n");
}
