import { useState, useEffect, useRef, useCallback } from 'react'
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

type Toast = {
  id: number
  message: string
  type: 'success' | 'error'
}

let toastId = 0

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

function SkeletonLoader() {
  return (
    <div className="score-card">
      <h3>Match Score</h3>
      <div className="skeleton skeleton-ring" />
      <div className="skeleton skeleton-text" style={{ marginBottom: 16 }} />
      <div style={{ textAlign: 'left' }}>
        <div className="skeleton skeleton-line" style={{ width: '40%', marginBottom: 12 }} />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" style={{ width: '50%' }} />
      </div>
    </div>
  )
}

function App() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isLinkedInPage, setIsLinkedInPage] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
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
      } catch {
        addToast('Failed to load data', 'error')
      }
    }
    loadData()
  }, [addToast])

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
      addToast('Only PDF files are allowed', 'error')
      return
    }
    if (resumes.length >= 5) {
      addToast('Maximum 5 resumes allowed', 'error')
      return
    }
    setUploading(true)

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
      addToast(`Resume "${result.fileName}" uploaded`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    const name = resumes.find(r => r.id === id)?.name || 'Resume'
    try {
      await deleteResume(id)
      const updated = resumes.filter(r => r.id !== id)
      setResumes(updated)
      if (selectedId === id) {
        setSelectedId(updated.length > 0 ? updated[0].id : null)
      }
      await chrome.storage.local.set({ resumes: updated, activeResumeId: selectedId === id ? (updated[0]?.id || null) : selectedId })
      addToast(`"${name}" deleted`, 'success')
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error')
    }
  }

  const activeResume = resumes.find(r => r.id === selectedId)

  const uploadButton = (
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
  )

  return (
    <div className="container">
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
        ))}
      </div>

      {!isLinkedInPage ? (
        <>
          <h2>Resume Manager</h2>
          <p className="hint">Please open a LinkedIn job posting</p>
          <p className="hint">Upload your resume to get started</p>
          {uploadButton}
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
        </>
      ) : !selectedId || resumes.length === 0 ? (
        <>
          <h2>Resume Manager</h2>
          <p className="hint">Upload your resume to get started</p>
          {uploadButton}
        </>
      ) : (
        <>
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
                <label htmlFor="file-upload2" className="small-btn">+</label>
              </>
            )}

            {selectedId && resumes.length > 1 && (
              <button onClick={() => handleDelete(selectedId)} className="delete-btn">x</button>
            )}
          </div>

          {activeResume && (
            <p className="active-resume">
              Active: <strong>{activeResume.name}</strong>
            </p>
          )}

          {!analysis ? <SkeletonLoader /> : (
            <>
              <div className="score-card">
                <h3>Match Score</h3>
                <ScoreRing score={analysis.score} />
              </div>

              <div className="keywords">
                <h3>Missing Keywords</h3>
                {analysis.missingKeywords?.length > 0 ? (
                  <ul>
                    {analysis.missingKeywords.map((kw, i) => (
                      <li key={i}>{kw}</li>
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
                    {analysis.strongMatches.map((kw, i) => (
                      <li key={i}>{kw}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No strong matches found</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default App