# JobSearch Aid — Frontend (Chrome Extension)

A Manifest V3 Chrome extension built with React + TypeScript + Vite that extracts job descriptions from LinkedIn and sends them to the backend for resume matching.

## Structure

```
src/
├── App.tsx                    # Popup UI (resume management, analysis display)
├── main.tsx                   # React entry point
├── App.css / index.css        # Styles
├── background/
│   └── background.ts          # Service worker (message handling, caching, API calls)
├── content/
│   ├── content.ts             # Polls LinkedIn DOM for job descriptions every 2s
│   └── extractJob.ts          # Extracts job text from `#job-details > .mt4`
├── services/
│   └── api.ts                 # Backend API client (analyzeJob, uploadResume, deleteResume)
├── utils/
│   └── urlCheck.ts            # URL validation (isLinkedInJobsPage)
└── assets/                    # Static assets
```

## Key Behaviors

### Job Detection
- Content script runs on `https://www.linkedin.com/jobs/*`
- Polls every 2 seconds for job description changes (deduplicated)
- Sends `JOB_DETECTED` message only when the description actually changes

### Caching (Frontend)
- Cache key: `${resumeId}::${sha256(normalizedJD)}`
- Uses `chrome.storage.session` (persists for the extension session)
- Discards stale results if the job description changed during an async API call

### Message Flow
1. **Content script** → `JOB_DETECTED` → Background stores job description
2. **Popup** → `RESUME_CHANGED` → Background updates active resume, removes old analysis
3. **Background** → `maybeAnalyze()` → Cache check → API call → Store result

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 3000) |
| `npm run build` | TypeScript check + Vite build to `dist/` |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Permissions (manifest.json)
- `activeTab` — Detect current tab URL
- `scripting` — Script injection
- `storage` — chrome.storage.local and chrome.storage.session
- `http://localhost:8000/*` — Backend API access

## Loading the Extension
1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable Developer mode
4. Load unpacked → select `frontend/dist/`
