import re


_WORD_RE = re.compile(r"[a-z0-9][a-z0-9+\-#.]{1,}")

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "our",
    "that",
    "the",
    "their",
    "there",
    "these",
    "this",
    "to",
    "we",
    "will",
    "with",
    "you",
    "your",
}

_GENERIC_WORDS = {
    "team",
    "work",
    "communication",
    "skills",
    "experience",
    "ability",
    "proven",
    "strong",
    "excellent",
    "good",
    "knowledge",
    "ability",
    "leadership",
    "collaboration",
    "problem",
    "solving",
    "detail",
    "oriented",
    "fast",
    "paced",
    "environment",
    "working",
    "years",
    "year",
    "plus",
    "must",
    "required",
    "preferred",
    "nice",
    "have",
    "looking",
    "seeking",
    "join",
    "opportunity",
    "role",
    "position",
    "job",
    "career",
}


def extract_keywords(text: str) -> list[str]:
    t = text.lower()
    tokens = _WORD_RE.findall(t)
    out: list[str] = []
    seen: set[str] = set()
    for tok in tokens:
        if tok in _STOPWORDS:
            continue
        if tok.isdigit():
            continue
        if tok in seen:
            continue
        seen.add(tok)
        out.append(tok)
    return out


def normalize_terms(terms: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for t in terms:
        if not isinstance(t, str):
            continue
        s = t.strip().lower()
        if not s:
            continue
        if s in seen:
            continue
        if s in _GENERIC_WORDS:
            continue
        if len(s) < 3:
            continue
        seen.add(s)
        out.append(s)
    return out


def extract_keywords_hybrid(text: str) -> list[str]:
    rule = extract_keywords(text)
    try:
        from llm.keyword_extractor import extract_ai_keywords

        ai = extract_ai_keywords(text)
        ai_keywords = ai.get("keywords", [])
        ai_phrases = ai.get("key_phrases", [])
    except Exception:
        ai_keywords = []
        ai_phrases = []

    combined = rule + list(ai_keywords) + list(ai_phrases)
    return normalize_terms(combined)


def sanitize_keywords(terms: list[str]) -> list[str]:
    """Final sanity check to filter generic/soft skill words."""
    return [t for t in terms if t.lower() not in _GENERIC_WORDS and len(t) >= 3]

