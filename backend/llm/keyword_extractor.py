from __future__ import annotations

import json
import os
from typing import Any

MODEL = None
if os.environ.get("GEMINI_API_KEY"):
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        MODEL = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", temperature=0)
    except Exception:
        MODEL = None


def _strip_code_fences(s: str) -> str:
    t = (s or "").strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return t


def _coerce_list_of_strings(value: Any, max_items: int = 50, max_item_len: int = 100) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for v in value:
        if not isinstance(v, str):
            continue
        s = v.strip()
        if not s:
            continue
        if len(s) > max_item_len:
            s = s[:max_item_len]
        if len(out) >= max_items:
            break
        out.append(s)
    return out


def _parse_model_json(raw: str) -> dict:
    txt = _strip_code_fences(raw)
    data = json.loads(txt)
    if not isinstance(data, dict):
        raise ValueError("Model output was not a JSON object")
    keywords = _coerce_list_of_strings(data.get("keywords"))
    key_phrases = _coerce_list_of_strings(data.get("key_phrases"))
    if not keywords and not key_phrases:
        raise ValueError("Model output contained no valid keywords or key_phrases")
    return {"keywords": keywords, "key_phrases": key_phrases}


def extract_ai_keywords(text: str) -> dict:
    """
    Returns structured JSON:
      { "keywords": [...], "key_phrases": [...] }

    Production-safe behavior:
    - If `GOOGLE_API_KEY` is missing or model call/parsing fails, returns empty lists.
    - If model output isn't valid JSON, retries up to 5 retries (6 attempts total).
    """
    if MODEL is None:
        return {"keywords": [], "key_phrases": []}

    try:
        from langchain_core.messages import HumanMessage
    except Exception:
        return {"keywords": [], "key_phrases": []}

    base_prompt = (
        """Extract two lists from the input text:\n
        1) keywords: single-word technical terms (e.g., Kubernetes, Python, Docker)\n
        2) key_phrases: multi-word technical concepts (e.g., CI/CD pipelines, microservices architecture)\n\n
        Return ONLY valid JSON with exactly these keys:\n
        '{\"keywords\": [\"...\"], \"key_phrases\": [\"...\"]}\n\n'
        Rules:\n
        - lowercase is OK but not required\n
        - no duplicates\n
        - no extra keys\n
        - no markdown, no code fences, no commentary\n\n
        TEXT:\n
        Do not include explanations, markdown, or text outside JSON."""
    )

    last_raw = ""
    for attempt in range(6):
        try:
            prompt = base_prompt + (text or "").strip()
            if attempt > 0:
                prompt = (
                    "Your previous output was invalid JSON or did not match the required schema.\n"
                    "Return ONLY valid JSON with keys: keywords, key_phrases.\n"
                    "No markdown, no code fences.\n"
                    "Previous output:\n"
                    f"{last_raw}\n\n"
                    "TEXT:\n"
                    + (text or "").strip()
                )

            resp = MODEL.invoke([HumanMessage(content=prompt)])
            raw = getattr(resp, "content", "") or ""
            last_raw = raw
            parsed = _parse_model_json(raw)
            return parsed
        except Exception:
            continue

    return {"keywords": [], "key_phrases": []}

