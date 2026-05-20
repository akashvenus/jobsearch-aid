from __future__ import annotations

import json
import os
from typing import Any

from pydantic import BaseModel, Field


class KeywordOutput(BaseModel):
    keywords: list[str] = Field(default_factory=list)
    key_phrases: list[str] = Field(default_factory=list, alias="key_phrases")

    def flattened(self) -> list[str]:
        return self.keywords + self.key_phrases


MODEL = None
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_API_KEY:
    print(f"[KeywordExtractor] GEMINI_API_KEY is set, initializing model")
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI

        MODEL = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", temperature=0)
        print("[KeywordExtractor] Model initialized successfully")
    except Exception as e:
        print(f"[KeywordExtractor] Failed to initialize model: {e}")
        MODEL = None
else:
    print("[KeywordExtractor] GEMINI_API_KEY not set — MODEL is None")


def _extract_text_from_response(content: Any) -> str:
    """Extract plain text from the model response, handling
    both plain-string and list-of-content-parts formats."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif isinstance(item, str):
                parts.append(item)
        return "".join(parts)
    if hasattr(content, "text"):
        return getattr(content, "text", "")
    return str(content)


def _strip_code_fences(s: str) -> str:
    t = (s or "").strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return t

def _parse_model_json(raw: str) -> dict:
    txt = _strip_code_fences(raw)
    data = json.loads(txt)
    parsed = KeywordOutput.model_validate(data)
    if not parsed.keywords and not parsed.key_phrases:
        raise ValueError("Model output contained no valid keywords or key_phrases")
    return parsed.model_dump(by_alias=True)


def extract_ai_keywords(text: str) -> dict:
    """
    Returns structured JSON:
      { "keywords": [...], "key_phrases": [...] }

    Production-safe behavior:
    - If `GOOGLE_API_KEY` is missing or model call/parsing fails, returns empty lists.
    - If model output isn't valid JSON, retries up to 5 retries (6 attempts total).
    """
    if MODEL is None:
        print("[extract_ai_keywords] MODEL is None — returning empty")
        return {"keywords": [], "key_phrases": []}

    try:
        from langchain_core.messages import HumanMessage
    except Exception as e:
        print(f"[extract_ai_keywords] Failed to import HumanMessage: {e}")
        return {"keywords": [], "key_phrases": []}

    input_len = len(text or "")
    print(f"[extract_ai_keywords] Input text length: {input_len}")

    base_prompt = (
        """You are a professional recruiter analyzing job descriptions and resumes to extract professional competencies.\n\n
        First, identify the industry/domain (e.g., software engineering, healthcare, finance, marketing, operations, sales, etc.).\n
        Then, extract competencies relevant to that industry, such as:\n
        1) keywords: Single-word or concise competency terms (e.g., "Python", "HIPAA", "SEO", "PMP", "patient care")\n
        2) key_phrases: Multi-word competency phrases (e.g., "agile methodology", "financial modeling", "cross-functional collaboration")\n\n
        Return ONLY valid JSON with exactly these keys:\n
        '{\"keywords\": [\"...\"], \"key_phrases\": [\"...\"]}\n\n'
        Rules:\n
        - Adapt extraction to the identified industry (healthcare, tech, finance, marketing)\n
        - Include both technical and soft skills relevant to the role\n
        - no duplicates within or across lists\n
        - no generic words (team, work, skills, experience, ability, etc.)\n
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

            print(f"[extract_ai_keywords] Attempt {attempt + 1}/6 — calling model")
            resp = MODEL.invoke([HumanMessage(content=prompt)])
            raw = _extract_text_from_response(getattr(resp, "content", ""))
            print(f"[extract_ai_keywords] Raw response length: {len(raw)}")
            print(f"[extract_ai_keywords] Raw response (truncated): {raw[:300]}")
            last_raw = raw
            parsed = _parse_model_json(raw)
            kw_count = len(parsed.get("keywords", []))
            kp_count = len(parsed.get("key_phrases", []))
            print(f"[extract_ai_keywords] Parsed result — {kw_count} keywords, {kp_count} key_phrases")
            if kw_count > 0 or kp_count > 0:
                print(f"[extract_ai_keywords] Keywords: {parsed['keywords'][:5]}")
                print(f"[extract_ai_keywords] Key phrases: {parsed['key_phrases'][:5]}")
            else:
                print("[extract_ai_keywords] Parsed result is empty!")
            return parsed
        except Exception as exc:
            print(f"[extract_ai_keywords] Attempt {attempt + 1} failed: {exc}")
            continue

    print("[extract_ai_keywords] All 6 attempts failed — returning empty")
    return {"keywords": [], "key_phrases": []}
