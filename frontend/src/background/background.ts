import { analyzeJob } from "../services/api"
import { isLinkedInJobsPage } from "../utils/urlCheck"

let inFlight = false
let lastAnalyzedKey = ""

async function hashString(input: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(input) 
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function maybeAnalyze() {
    if (inFlight) return

    const sessionData = await chrome.storage.session.get(["jobDescription"])
    const localData = await chrome.storage.local.get(["activeResumeId"])
    const resumeId = ((localData?.activeResumeId ?? "") as string).trim()

    const jobDescription = ((sessionData?.jobDescription ?? "") as string).trim()

    if (!jobDescription || !resumeId) return

    console.log("Analyzing with:", { resumeId, jobDescription })

    const hash = await hashString(jobDescription)
    const key = `${resumeId}::${hash}`
    if (key === lastAnalyzedKey) return

    inFlight = true
    try {
        const data = await analyzeJob({ jobDescription, resumeId })
        await chrome.storage.session.set({ analysis: data })
        lastAnalyzedKey = key
    } finally {
        inFlight = false
    }
}

chrome.runtime.onMessage.addListener((message, sender) => {
    (async () => {
        if (message.type === "JOB_DETECTED") {
            const tab = sender.tab
            if (!tab?.url || !isLinkedInJobsPage(tab.url)) return

            await chrome.storage.session.set({
            jobDescription:
                typeof message.payload === "string"
                ? message.payload
                : message.payload?.description || ""
            })
        }

        if (message.type === "RESUME_CHANGED") {
            await chrome.storage.local.set({ activeResumeId: message.payload.resumeId })
        }

        await maybeAnalyze()
    })()

    return true
})
