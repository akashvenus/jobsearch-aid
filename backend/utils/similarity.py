from __future__ import annotations

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def keyword_overlap_ratio(*, job_keywords: list[str], resume_keywords: list[str]) -> float:
    job_set = set(job_keywords)
    if not job_set:
        return 0.0
    resume_set = set(resume_keywords)
    inter = job_set & resume_set
    return len(inter) / max(len(job_set), 1)


def semantic_similarity_tfidf(*, job_text: str, resume_text: str) -> float:
    jt = (job_text or "").strip()
    rt = (resume_text or "").strip()
    if not jt or not rt:
        return 0.0
    vect = TfidfVectorizer(stop_words="english", max_features=5000)
    mat = vect.fit_transform([jt, rt])
    sim = cosine_similarity(mat[0:1], mat[1:2])[0][0]
    if sim != sim:  # NaN guard
        return 0.0
    return float(max(0.0, min(1.0, sim)))


def compute_final_score(*, semantic_similarity: float, keyword_overlap: float) -> float:
    sem = max(0.0, min(1.0, float(semantic_similarity)))
    ov = max(0.0, min(1.0, float(keyword_overlap)))
    final_score = (sem * 0.7) + (ov * 0.3)
    pct = final_score * 100.0
    return float(max(0.0, min(100.0, pct)))

