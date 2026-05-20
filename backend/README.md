# JobSearch Aid — Backend (FastAPI)

AI-powered backend that extracts competencies from job descriptions and resumes using Google Gemini, then computes a semantic match score.

## Structure

```
├── main.py                        # FastAPI app with CORS, 3 endpoints
├── Dockerfile                     # Multi-stage (dev/prod) with built-in Redis
├── requirements.txt               # Python dependencies
├── .env                           # GEMINI_API_KEY, AWS_ credentials
├── llm/
│   └── keyword_extractor.py       # Gemini 3.1 Flash Lite integration
│                                  #   - Pydantic KeywordOutput schema
│                                  #   - Industry-aware prompt (detects domain internally)
│                                  #   - 6 retry attempts with corrective feedback
│                                  #   - Handles Gemini content-parts response format
├── services/
│   └── analyze_service.py         # Orchestrator: normalize → cache check → PDF → AI → score → cache store
├── utils/
│   ├── redis_client.py            # Redis singleton with graceful fallback (None on failure)
│   ├── s3_client.py               # S3 get/put/delete for resume PDFs
│   ├── pdf_text.py                # PDF → text extraction
│   ├── text_cleaning.py           # JD cleaning + relevant section extraction
│   ├── keywords.py                # AI-only extraction (all regex removed), normalize + dedup
│   └── similarity.py              # 70% TF-IDF + 30% keyword overlap → final score
```

## Endpoints

### `POST /api/analyze`
**Request:**
```json
{ "jobDescription": "...", "resumeId": "uuid" }
```
**Response:**
```json
{ "score": 0.0–1.0, "missingKeywords": [...], "strongMatches": [...] }
```
**Flow:**
1. Normalize and hash JD → check Redis cache (`resumeId::jdHash`)
2. Fetch resume PDF from S3 → extract text
3. Run AI extraction (Gemini) on both JD and resume text
4. Compute: keyword overlap + TF-IDF semantic similarity → final score (70/30 weighted)

### `POST /api/upload`
- Accepts `multipart/form-data` with a PDF file
- Generates a UUID, uploads to S3
- Returns `{ resumeId, fileName, uploadDate }`

### `POST /api/delete`
- Accepts `{ resumeId }`
- Removes the PDF from S3
- Returns `{ "status": "deleted" }`

## Caching (Redis)

- **Key format**: `{resumeId}::{sha256(normalizedJD)}`
- **TTL**: 1 hour (3600s)
- **Graceful failure**: if Redis is unavailable, the analysis proceeds without caching

## Docker

### Development (with hot reload)
```bash
docker build --target development -t backend:dev .
docker run -p 8000:8000 -v $(pwd):/app backend:dev
```

### Production
```bash
docker build --target production -t backend:prod .
docker run -p 8000:8000 backend:prod
```

Both targets start Redis automatically before the FastAPI server.

## Run Locally

```bash
pip install -r requirements.txt
# Start Redis (optional, caching only)
redis-server
# Start server
uvicorn main:app --host 0.0.0.0 --port 8000
```
