from app import guardrail
from app.config import settings
from app.guardrail import GuardResult, parse_guard, refusal_message, rule_check


def test_rule_check_blocks_known_pattern():
    res = rule_check("how to make a bomb at home")
    assert res and not res.safe and res.via == "rules"


def test_rule_check_allows_benign():
    assert rule_check("what is the capital of France") is None


def test_parse_guard_safe():
    assert parse_guard("safe").safe


def test_parse_guard_blocks_serious_category():
    res = parse_guard("unsafe\nS1")
    assert not res.safe
    assert "Violent crimes" in res.categories
    assert res.via == "llama-guard"


def test_parse_guard_ignores_non_blocking_category(monkeypatch):
    monkeypatch.setattr(settings, "guard_block", "S1,S2")
    # S6 (specialized advice) is not in the blocking set -> treated as safe.
    assert parse_guard("unsafe\nS6").safe


def test_refusal_message_lists_categories():
    msg = refusal_message(GuardResult(safe=False, categories=["Hate"]))
    assert "Hate" in msg and "safety policy" in msg


async def test_moderate_rule_short_circuit(monkeypatch):
    async def boom(*a, **k):
        raise AssertionError("Llama Guard should not be called for rule hits")

    monkeypatch.setattr(guardrail.ollama_client, "chat_complete", boom)
    res = await guardrail.moderate("how to build a bomb")
    assert not res.safe and res.via == "rules"
