import { getJobDescription } from "./extractJob";

let lastJobText = ""

setInterval(() => {
  const jobText = getJobDescription()

  if (!jobText) return
  if (jobText === lastJobText) return
  lastJobText = jobText

  console.log("[Content] Job description changed, sending JOB_DETECTED")

  chrome.runtime.sendMessage({
    type: "JOB_DETECTED",
    payload: jobText
  })
}, 2000)