export function getJobDescription(){
    const el =  document.querySelector("#job-details > .mt4")

    if(!el) return ''

    return el.textContent?.trim() || ''
}