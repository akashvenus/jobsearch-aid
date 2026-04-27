import os
import uuid
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware 

from services.analyze_service import analyze
from utils.s3_client import put_object, delete_object

from dotenv import load_dotenv
load_dotenv()


app = FastAPI()


class AnalyzeRequest(BaseModel):
    jobDescription: str = Field(..., min_length=1)
    resumeId: str = Field(..., min_length=1)


class AnalyzeResponse(BaseModel):
    score: float
    missingKeywords: list[str]
    strongMatches: list[str]


class UploadResponse(BaseModel):
    resumeId: str
    fileName: str
    uploadDate: str


class DeleteRequest(BaseModel):
    resumeId: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ✅ allow everything for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_endpoint(payload: AnalyzeRequest) -> AnalyzeResponse:
    try:
        result = await analyze(job_description=payload.jobDescription, resume_id=payload.resumeId)
        return AnalyzeResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.post("/api/upload", response_model=UploadResponse)
async def upload_endpoint(file: UploadFile = File(...)):
    bucket = os.environ.get("AWS_BUCKET_NAME")
    if not bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET not configured")

    if not file.filename or not file.content_type:
        raise HTTPException(status_code=400, detail="Missing file name or content type")

    if not file.content_type.startswith("application/pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    resume_id = str(uuid.uuid4())
    upload_date = datetime.utcnow().isoformat()

    try:
        file_data = await file.read()
        put_object(bucket, resume_id, file_data, file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {e}") from e

    return UploadResponse(resumeId=resume_id, fileName=file.filename, uploadDate=upload_date)


@app.post("/api/delete")
async def delete_endpoint(payload: DeleteRequest):
    bucket = os.environ.get("AWS_BUCKET_NAME")
    if not bucket:
        raise HTTPException(status_code=500, detail="S3_BUCKET not configured")

    try:
        delete_object(bucket, payload.resumeId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete from S3: {e}") from e

    return {"status": "deleted"}
