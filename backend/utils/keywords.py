def extract_keywords_hybrid(text: str) -> list[str]:
    text_len = len(text or "")
    print(f"[extract_keywords_hybrid] Input text length: {text_len}")
    try:
        from llm.keyword_extractor import extract_ai_keywords

        ai = extract_ai_keywords(text)
        ai_keywords = ai.get("keywords", [])
        ai_phrases = ai.get("key_phrases", [])
        print(f"[extract_keywords_hybrid] AI returned {len(ai_keywords)} keywords, {len(ai_phrases)} key_phrases")
    except Exception as e:
        print(f"[extract_keywords_hybrid] AI extraction failed: {e}")
        ai_keywords = []
        ai_phrases = []

    combined = list(ai_keywords) + list(ai_phrases)
    result = _normalize_terms(combined)
    print(f"[extract_keywords_hybrid] After normalize: {len(result)} terms")
    if result:
        print(f"[extract_keywords_hybrid] First 10 terms: {result[:10]}")
    else:
        print("[extract_keywords_hybrid] Result is EMPTY!")
    return result


def _normalize_terms(terms: list[str]) -> list[str]:
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
        if len(s) < 2:
            continue
        seen.add(s)
        out.append(s)
    return out

