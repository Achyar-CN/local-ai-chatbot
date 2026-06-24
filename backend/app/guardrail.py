"""Input moderation: fast rule pre-filter then Llama Guard 3 (port of guardrail.ts)."""

import re
from dataclasses import dataclass, field

from . import ollama_client
from .config import settings

LLAMA_GUARD_CATEGORIES = {
    "S1": "Violent crimes",
    "S2": "Non-violent crimes",
    "S3": "Sex crimes",
    "S4": "Child exploitation",
    "S5": "Defamation",
    "S6": "Specialized advice",
    "S7": "Privacy",
    "S8": "Intellectual property",
    "S9": "Indiscriminate weapons",
    "S10": "Hate",
    "S11": "Self-harm",
    "S12": "Sexual content",
    "S13": "Elections",
    "S14": "Code interpreter abuse",
}

RULE_PATTERNS = [
    ("Self-harm", re.compile(
        r"\b(cara\s+(bunuh diri|mengakhiri hidup)|how to (kill myself|commit suicide)|end my life)\b",
        re.I)),
    ("Weapons and explosives", re.compile(
        r"\b(cara\s+(membuat|merakit)\s+(bom|peledak)|how to (make|build) a (bomb|explosive)|"
        r"build a (gun|firearm) at home)\b", re.I)),
    ("Malicious hacking", re.compile(
        r"\b(ransomware|keylogger|botnet|carding|how to hack (into|someone'?s)|"
        r"curi(?:lah)? (kartu kredit|password))\b", re.I)),
]


@dataclass
class GuardResult:
    safe: bool
    categories: list[str] = field(default_factory=list)
    via: str = "rules"


def rule_check(text: str) -> GuardResult | None:
    for label, pattern in RULE_PATTERNS:
        if pattern.search(text):
            return GuardResult(safe=False, categories=[label], via="rules")
    return None


def parse_guard(output: str) -> GuardResult:
    first = output.strip().lower().split()
    if first and first[0].startswith("safe"):
        return GuardResult(safe=True, via="llama-guard")
    codes = sorted(set(re.findall(r"S\d{1,2}", output.upper())))
    blocking = [c for c in codes if c in settings.guard_block_set]
    if not blocking:
        return GuardResult(safe=True, via="llama-guard")
    return GuardResult(
        safe=False,
        categories=[LLAMA_GUARD_CATEGORIES.get(c, c) for c in blocking],
        via="llama-guard",
    )


_guard_available: bool | None = None


async def moderate(text: str, role: str = "user") -> GuardResult:
    text = text.strip()
    if not text:
        return GuardResult(safe=True)

    ruled = rule_check(text)
    if ruled:
        return ruled

    global _guard_available
    if _guard_available is False:
        return GuardResult(safe=True)

    try:
        out = await ollama_client.chat_complete(
            settings.guard_model, [{"role": role, "content": text}], temperature=0, max_tokens=50
        )
        _guard_available = True
        return parse_guard(out)
    except Exception:
        _guard_available = False
        return GuardResult(safe=True)


def refusal_message(result: GuardResult) -> str:
    cats = f" ({', '.join(result.categories)})" if result.categories else ""
    return (
        f"I can't help with this request because it goes against the safety policy{cats}.\n\n"
        "I can only help with safe, appropriate requests. Try asking something else, "
        "like a question about your documents."
    )
