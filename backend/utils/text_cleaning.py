import re


_SECTION_SPLIT_RE = re.compile(r"^\s*([A-Z][A-Z0-9 &/]{2,}|[A-Za-z][A-Za-z0-9 &/]{2,})\s*:?\s*$")


def clean_job_description(text: str) -> str:
    t = text.replace("\r\n", "\n").strip()
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t


def extract_relevant_job_section(text: str) -> str:
    """
    Heuristic extraction: keep sections that look like requirements/responsibilities/skills;
    drop common non-requirement sections (company/about/benefits, etc.).
    """
    drop_markers = {
        "about",
        "about us",
        "about the company",
        "company",
        "who we are",
        "benefits",
        "perks",
        "equal opportunity",
        "eeo",
        "diversity",
        "privacy",
        "compensation",
    }
    keep_markers = {
        "requirements",
        "responsibilities",
        "what you will do",
        "what you'll do",
        "what you do",
        "qualifications",
        "skills",
        "must have",
        "nice to have",
        "preferred",
        "experience",
    }

    lines = text.replace("\r\n", "\n").split("\n")
    sections: list[tuple[str, list[str]]] = []

    current_title = "preamble"
    current_lines: list[str] = []

    def flush():
        nonlocal current_title, current_lines
        if current_lines:
            sections.append((current_title, current_lines))
        current_lines = []

    for line in lines:
        m = _SECTION_SPLIT_RE.match(line)
        if m and len(line.strip()) <= 60:
            flush()
            current_title = line.strip()
        else:
            current_lines.append(line)
    flush()

    kept: list[str] = []
    for title, body_lines in sections:
        title_norm = re.sub(r"\s+", " ", title.strip().lower())
        if any(k in title_norm for k in keep_markers):
            kept.append("\n".join(body_lines).strip())
            continue
        if any(d == title_norm or d in title_norm for d in drop_markers):
            continue

    if kept:
        out = "\n\n".join([k for k in kept if k])
        return re.sub(r"\n{3,}", "\n\n", out).strip()

    # Fallback: remove obvious drop sections by simple regex blocks
    lowered = text.lower()
    for marker in ["benefits", "about the company", "about us"]:
        idx = lowered.find(marker)
        if idx != -1:
            text = text[:idx]
            lowered = text.lower()

    return text.strip()

