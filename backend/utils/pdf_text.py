import io

from pypdf import PdfReader


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text:
                parts.append(text)
        return "\n".join(parts)
    except Exception as e:
        raise ValueError("Failed to extract text from PDF") from e

