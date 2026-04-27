import os

import boto3



def _client():
    region = os.environ.get("AWS_REGION")
    if region:
        return boto3.client("s3",aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),aws_secret_access_key= os.environ.get("AWS_SECRET_ACCESS_KEY"), region_name=region)
    return boto3.client("s3",aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),aws_secret_access_key= os.environ.get("AWS_SECRET_ACCESS_KEY"))


def get_object_bytes(bucket: str, key: str) -> bytes:
    resp = _client().get_object(Bucket=bucket, Key=key)
    body = resp.get("Body")
    if body is None:
        raise ValueError("S3 response missing Body")
    return body.read()


def put_object(bucket: str, key: str, data: bytes, content_type: str = "application/pdf") -> dict:
    return _client().put_object(
        Bucket=bucket,
        Key=key,
        Body=data,
        ContentType=content_type
    )


def is_object_not_found_error(err: Exception) -> bool:
    response = getattr(err, "response", None)
    code = response.get("Error", {}).get("Code") if isinstance(response, dict) else None
    return code in {"NoSuchKey", "NoSuchBucket", "404", "NotFound"}


def delete_object(bucket: str, key: str) -> dict:
    return _client().delete_object(Bucket=bucket, Key=key)

