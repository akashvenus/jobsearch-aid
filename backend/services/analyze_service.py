import os

from utils.keywords import extract_keywords_hybrid
from utils.pdf_text import extract_text_from_pdf
from utils.s3_client import get_object_bytes, is_object_not_found_error
from utils.similarity import compute_final_score, keyword_overlap_ratio, semantic_similarity_tfidf
from utils.text_cleaning import clean_job_description, extract_relevant_job_section


async def analyze(job_description: str, resume_id: str) -> dict:
    job_clean = clean_job_description(job_description)
    job_relevant = extract_relevant_job_section(job_clean)

    bucket = os.environ.get("AWS_BUCKET_NAME")
    if not bucket:
        raise ValueError("Missing required environment variable: S3_BUCKET")

    try:
        pdf_bytes = get_object_bytes(bucket=bucket, key=resume_id)
    except Exception as e:
        if is_object_not_found_error(e):
            raise FileNotFoundError(f"Resume not found for resumeId={resume_id}") from e
        raise

    resume_text = extract_text_from_pdf(pdf_bytes)
    if not resume_text.strip():
        raise ValueError("Resume text extraction produced empty content")

    job_keywords = extract_keywords_hybrid(job_relevant)
    resume_keywords = extract_keywords_hybrid(resume_text)

    job_set = set(job_keywords)
    resume_set = set(resume_keywords)

    strong_matches = sorted(job_set & resume_set)
    missing_keywords = sorted(job_set - resume_set)

    overlap = keyword_overlap_ratio(job_keywords=job_keywords, resume_keywords=resume_keywords)
    semantic = semantic_similarity_tfidf(job_text=job_relevant, resume_text=resume_text)
    score = compute_final_score(semantic_similarity=semantic, keyword_overlap=overlap)

    return {
        "score": score,
        "missingKeywords": missing_keywords[:10],
        "strongMatches": strong_matches[:10],
    }

