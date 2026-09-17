import { getJobDescription } from "./extractJob";

console.log("[Content] content script loaded")

let lastJobText = ""

setInterval(() => {
  const rawText = getJobDescription()
  console.log("[Content] getJobDescription returned:", rawText ? rawText.slice(0, 80) + "..." : null)

  if (!rawText) return
  const jobText = rawText.trim()
  if (!jobText) return
  if (jobText === lastJobText) return
  lastJobText = jobText

  console.log("[Content] Job description changed, sending JOB_DETECTED")

  chrome.runtime.sendMessage({
    type: "JOB_DETECTED",
    payload: jobText
  }).then(() => {
    console.log("[Content] JOB_DETECTED sent successfully")
  }).catch(err => {
    console.error("[Content] Failed to send message:", err)
  })
}, 2000)