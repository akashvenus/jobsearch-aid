import { useState, useEffect, useRef } from 'react'
import './App.css'
import { uploadResume, deleteResume } from './services/api'
import { isLinkedInJobsPage } from './utils/urlCheck'

type Resume = {
  id: string
  name: string
  uploadDate: string
}

type Analysis = {
  score: number
  missingKeywords: string[]
  strongMatches: string[]
}

function ScoreRing({ score }: { score: number }) {
  const percentage = Math.min(100, Math.max(0, score))
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const getColorClass = () => {
    if (percentage >= 70) return 'score-great'
    if (percentage >= 50) return 'score-good'
    if (percentage >= 30) return 'score-okay'
    return 'score-bad'
  }

  return (
    <div className={`score-ring ${getColorClass()}`}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          opacity="0.2"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="score-number">{percentage.toFixed(0)}%</span>
    </div>
  )
}

function App() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isLinkedInPage, setIsLinkedInPage] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadData() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      const url = tab?.url || ''
      const isLinkedIn = isLinkedInJobsPage(url)
      setIsLinkedInPage(isLinkedIn)

      if (!isLinkedIn) {
        setAnalysis(null)
      }

      const stored = await chrome.storage.local.get(['resumes', 'activeResumeId'])
      const storedResumes: Resume[] = (stored.resumes as Resume[]) || []
      const activeId: string = stored.activeResumeId as string

      setResumes(storedResumes)
      setSelectedId(activeId || (storedResumes.length > 0 ? storedResumes[0].id : null))
    }
    loadData()
  }, [])

  useEffect(() => {
    function handleStorage(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) {
      if (areaName === 'local') {
        if (changes.activeResumeId) {
          setSelectedId(changes.activeResumeId.newValue as string)
        }
        if (changes.resumes) {
          setResumes((changes.resumes.newValue as Resume[]) || [])
        }
      }
      if (areaName === 'session' && changes.analysis) {
        const data = changes.analysis.newValue as Analysis | undefined
        setAnalysis(data || null)
      }
    }
    chrome.storage.onChanged.addListener(handleStorage)
    return () => chrome.storage.onChanged.removeListener(handleStorage)
  }, [])

  useEffect(() => {
    if (selectedId) {
      chrome.storage.local.set({ activeResumeId: selectedId })
      chrome.runtime.sendMessage({ type: 'RESUME_CHANGED', payload: { resumeId: selectedId } })
    }
  }, [selectedId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed')
      return
    }
    if (resumes.length >= 5) {
      setError('Maximum 5 resumes allowed')
      return
    }
    setUploading(true)
    setError(null)

    try {
      const result = await uploadResume(file)
      const newResume: Resume = {
        id: result.resumeId,
        name: result.fileName,
        uploadDate: result.uploadDate
      }
      const updated = [...resumes, newResume]
      setResumes(updated)
      setSelectedId(newResume.id)
      await chrome.storage.local.set({ resumes: updated, activeResumeId: newResume.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteResume(id)
      const updated = resumes.filter(r => r.id !== id)
      setResumes(updated)
      if (selectedId === id) {
        setSelectedId(updated.length > 0 ? updated[0].id : null)
      }
      await chrome.storage.local.set({ resumes: updated, activeResumeId: selectedId === id ? (updated[0]?.id || null) : selectedId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const activeResume = resumes.find(r => r.id === selectedId)

  if (!isLinkedInPage) {
    return (
      <div className="container">
        <h2>Resume Manager</h2>
        <p className="hint">Please open a LinkedIn job posting</p>
        <p className="hint">Upload your resume to get started</p>
        
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload Resume (PDF)'}
          </label>
        </div>

        {resumes.length > 0 && (
          <div className="resume-list">
            {resumes.map(r => (
              <div key={r.id} className="resume-item">
                <span>{r.name}</span>
                <button onClick={() => handleDelete(r.id)} className="delete-btn">x</button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  if (!selectedId || resumes.length === 0) {
    return (
      <div className="container">
        <h2>Resume Manager</h2>
        <p className="hint">Upload your resume to get started</p>
        
        <div className="upload-section">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="upload-btn">
            {uploading ? 'Uploading...' : 'Upload Resume (PDF)'}
          </label>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="container">
      <h2>Resume Manager</h2>

      <div className="resume-selector">
        <select
          value={selectedId || ''}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {resumes.map(r => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {resumes.length < 5 && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: 'none' }}
              id="file-upload2"
            />
            <label htmlFor="file-upload2" className="small-btn">
              +
            </label>
          </>
        )}

        {selectedId && resumes.length > 1 && (
          <button onClick={() => handleDelete(selectedId)} className="delete-btn">x</button>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {activeResume && (
        <p className="active-resume">
          Active: <strong>{activeResume.name}</strong>
        </p>
      )}

      {!analysis ? (
        <div className="score-card">
          <h3>Match Score</h3>
          <p>Analyzing...</p>
        </div>
      ) : (
        <>
          <div className="score-card">
            <h3>Match Score</h3>
            <ScoreRing score={analysis.score} />
          </div>

          <div className="keywords">
            <h3>Missing Keywords</h3>
            {analysis.missingKeywords?.length > 0 ? (
              <ul>
                {(analysis.missingKeywords as string[]).map((kw, i) => (
                  <li key={i}>{String(kw)}</li>
                ))}
              </ul>
            ) : (
              <p>No missing keywords</p>
            )}
          </div>

          <div className="keywords">
            <h3>Strong Matches</h3>
            {analysis.strongMatches?.length > 0 ? (
              <ul>
                {(analysis.strongMatches as string[]).map((kw, i) => (
                  <li key={i}>{String(kw)}</li>
                ))}
              </ul>
            ) : (
              <p>No strong matches found</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default App