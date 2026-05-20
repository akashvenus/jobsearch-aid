# JobSearch Aid 🎯

A Chrome extension + FastAPI backend that analyzes job descriptions against your resumes using AI-powered competency extraction and semantic matching.

## Architecture

```
jobsearch-aid/
├── frontend/          # Chrome Extension (React + TypeScript + Vite)
│   └── src/
│       ├── App.tsx                  # Popup UI (resume management, analysis display)
│       ├── background/background.ts # Service worker (caching, messaging, orchestration)
│       ├── content/content.ts       # LinkedIn job description extraction
│       ├── services/api.ts          # Backend API client
│       └── utils/urlCheck.ts        # URL validation
├── backend/           # FastAPI server (Python 3.14)
│   ├── main.py                     # API endpoints
│   ├── services/analyze_service.py # Core analysis orchestration
│   ├── utils/                      # S3, Redis, similarity, text cleaning, PDF
│   └── llm/keyword_extractor.py    # Gemini-powered competency extraction
└── .gitignore
```

## Features

- **Multi-resume management**: Upload, select, and delete PDF resumes (max 5)
- **LinkedIn integration**: Automatically detects job descriptions on LinkedIn jobs pages
- **AI competency extraction**: Uses Gemini 3.1 Flash Lite to extract industry-aware competencies from both JDs and resumes
- **Hybrid caching**: Frontend (chrome.storage.session) + Backend (Redis) caching keyed by `resumeId::jdHash`
- **Semantic scoring**: 70% TF-IDF semantic similarity + 30% keyword overlap
- **Docker support**: Multi-stage Dockerfile with built-in Redis

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env    # Configure GEMINI_API_KEY, AWS_ credentials
docker build --target development -t backend:dev .
docker run -p 8000:8000 -v $(pwd):/app backend:dev
```

Or without Docker:
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (Chrome Extension)
```bash
cd frontend
npm install
npm run build    # Output in frontend/dist/
```

Load `frontend/dist/` as an unpacked extension in Chrome.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze` | Analyze resume against job description |
| POST | `/api/upload` | Upload a PDF resume |
| POST | `/api/delete` | Delete a resume from S3 |

## Environment Variables

### Backend
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI extraction |
| `AWS_BUCKET_NAME` | Yes | S3 bucket for resume storage |
| `AWS_ACCESS_KEY_ID` | Yes | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS secret key |
| `AWS_REGION` | No | AWS region (default: us-east-1) |
