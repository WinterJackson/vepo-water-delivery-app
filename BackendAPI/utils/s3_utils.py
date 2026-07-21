import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from fastapi import UploadFile
import uuid
import mimetypes
from fastapi import HTTPException

import logging

logger = logging.getLogger(__name__)

# Initialize S3 client
# In production, these should be loaded from environment variables
# For now, we will use a fallback logic if keys are missing
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'drop-kyc-bucket')

async def upload_file_to_s3(file: UploadFile, prefix: str = "kyc") -> str:
    """
    Securely uploads a file to AWS S3 and returns the S3 key.
    Enforces a strict 8MB memory cap on file reads.
    """
    try:
        # Enforce 8MB limit (8 * 1024 * 1024 bytes)
        MAX_SIZE = 8 * 1024 * 1024
        file_content = await file.read(MAX_SIZE + 1)
        if len(file_content) > MAX_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 8MB.")
        
        # Determine content type and extension
        content_type = file.content_type
        extension = mimetypes.guess_extension(content_type) or ".jpg"
        
        # Generate a unique file name to prevent overwrites
        file_name = f"{prefix}/{uuid.uuid4()}{extension}"
        
        # Upload to S3
        if os.getenv('AWS_ACCESS_KEY_ID'):
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=file_name,
                Body=file_content,
                ContentType=content_type,
                # Server-side encryption for PII compliance
                ServerSideEncryption='AES256' 
            )
            # Return the secure key instead of a public URL
            return file_name
            
        else:
            # DEVELOPMENT FALLBACK: Local file storage
            os.makedirs(f"uploads/{prefix}", exist_ok=True)
            local_path = f"uploads/{file_name}"
            with open(local_path, "wb") as f:
                f.write(file_content)
            # In development, serve from local URL or just return the path
            return f"/api/uploads/{file_name}"
            
    except ClientError as e:
        logger.error(f"S3 Upload Error: {e}", exc_info=True)
        return None
    except NoCredentialsError:
        logger.error("AWS Credentials not available for S3 upload")
        return None
    finally:
        # Reset file cursor for subsequent reads if needed
        await file.seek(0)

def generate_presigned_url(s3_key: str, expires_in: int = 900) -> str:
    """
    Generates a presigned URL for secure access to a private S3 object.
    Defaults to a 15 minute (900s) expiration.
    """
    if not s3_key:
        return None
        
    if not os.getenv('AWS_ACCESS_KEY_ID'):
        # Fallback for development if using local storage paths
        if s3_key.startswith("/api/uploads/"):
            return s3_key
        return f"/api/uploads/{s3_key}"

    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': s3_key},
            ExpiresIn=expires_in
        )
        return url
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}", exc_info=True)
        return None
