import { analyzeJob } from "../services/api"
import { isLinkedInJobsPage } from "../utils/urlCheck"


async function hashString(input: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(input)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizeJD(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ')
}

async function maybeAnalyze() {
    const sessionData = await chrome.storage.session.get(["jobDescription"])
    const localData = await chrome.storage.local.get(["activeResumeId"])
    const resumeId = ((localData?.activeResumeId ?? "") as string).trim()

    const jobDescription = ((sessionData?.jobDescription ?? "") as string).trim()

    console.log("[Background] maybeAnalyze called", { hasDescription: !!jobDescription, descLength: jobDescription?.length, resumeId, resumeIdLength: resumeId?.length })

    if (!jobDescription || !resumeId) {
        console.log("[Background] maybeAnalyze: returning early", { reason: !jobDescription ? "no jobDescription" : "no resumeId" })
        return
    }

    console.log("Analyzing with:", { resumeId, jobDescription })

    const normalized = normalizeJD(jobDescription)
    const hash = await hashString(normalized)
    const key = `${resumeId}::${hash}`

    const cached = await chrome.storage.session.get([key])
    if (cached[key]) {
        const currentSession = await chrome.storage.session.get(["jobDescription"])
        const currentJd = ((currentSession?.jobDescription ?? "") as string).trim()
        if (normalizeJD(currentJd) !== normalizeJD(jobDescription)) {
            console.log("[maybeAnalyze] job changed during cache lookup — skipping stale cache")
            return
        }
        console.log("Cache hit (frontend)")
        await chrome.storage.session.set({ analysis: cached[key] })
        return
    }

    try {
        const data = await analyzeJob({ jobDescription, resumeId })
        const finalSession = await chrome.storage.session.get(["jobDescription"])
        const finalJd = ((finalSession?.jobDescription ?? "") as string).trim()
        if (normalizeJD(finalJd) !== normalizeJD(jobDescription)) {
            console.log("[maybeAnalyze] job changed during API call — discarding stale result")
            return
        }
        await chrome.storage.session.set({ [key]: data, analysis: data })
    } catch(err) {
        console.error(err);
    }
}

chrome.runtime.onMessage.addListener((message, sender) => {
    (async () => {
        console.log("[Background] onMessage received", { type: message.type, tabUrl: sender.tab?.url })
        if (message.type === "JOB_DETECTED") {
            const tab = sender.tab
            if (!tab?.url || !isLinkedInJobsPage(tab.url)) {
                console.log("[Background] JOB_DETECTED ignored - not LinkedIn jobs page", { url: tab?.url })
                return
            }

            const desc = typeof message.payload === "string"
                ? message.payload
                : message.payload?.description || ""

            console.log("[Background] Setting jobDescription in session storage", { length: desc.length })
            await chrome.storage.session.set({ jobDescription: desc })
            console.log("[Background] jobDescription stored")
        }

        if (message.type === "RESUME_CHANGED") {
            console.log("[Background] RESUME_CHANGED", { resumeId: message.payload.resumeId })
            await chrome.storage.local.set({ activeResumeId: message.payload.resumeId })
            await chrome.storage.session.remove("analysis")
            console.log("[Background] activeResumeId saved, analysis cleared")
        }

        await maybeAnalyze()
    })()

    return true
})
