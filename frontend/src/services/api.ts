const BASE_URL = 'http://localhost:8000'

export async function analyzeJob(data : {
    jobDescription: string,
    resumeId: string
}){

    const response = await fetch(`${BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Request failed" }));
        throw new Error(error.detail || "Request failed");
    }

    return response.json()
}

export async function uploadResume(file: File): Promise<{
    resumeId: string,
    fileName: string,
    uploadDate: string
}> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(error.detail || "Upload failed");
    }

    return response.json()
}

export async function deleteResume(resumeId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/api/delete`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ resumeId })
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Delete failed" }));
        throw new Error(error.detail || "Delete failed");
    }
}