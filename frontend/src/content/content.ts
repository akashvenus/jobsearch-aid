import { getJobDescription } from "./extractJob";

setInterval(() => {
  const jobText = getJobDescription()

  if (!jobText) return

  chrome.runtime.sendMessage({
    type: "JOB_DETECTED",
    payload: jobText
  })
}, 2000)