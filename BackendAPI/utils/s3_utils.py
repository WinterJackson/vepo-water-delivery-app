import os
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from fastapi import UploadFile
import uuid
import mimetypes

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
    Securely uploads a file to AWS S3 and returns the public or presigned URL.
    In a real-world scenario with highly sensitive KYC documents, you would 
    return a non-public S3 key and generate presigned URLs for viewing, 
    but for this implementation we will return the S3 key and assume the 
    frontend/backend handles access securely.
    """
    try:
        # Read the file
        file_content = await file.read()
        
        # Determine content type and extension
        content_type = file.content_type
        extension = mimetypes.guess_extension(content_type) or ".jpg"
        
        # Generate a unique file name to prevent overwrites
        file_name = f"{prefix}/{uuid.uuid4()}{extension}"
        
        # Upload to S3
        # If AWS keys aren't set up yet, this will fail. We will fallback to local storage
        # for development purposes so the app doesn't break.
        if os.getenv('AWS_ACCESS_KEY_ID'):
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=file_name,
                Body=file_content,
                ContentType=content_type,
                # Server-side encryption for PII compliance
                ServerSideEncryption='AES256' 
            )
            # Return the secure key or a constructed URL
            return f"https://{S3_BUCKET_NAME}.s3.{os.getenv('AWS_REGION', 'us-east-1')}.amazonaws.com/{file_name}"
            
        else:
            # DEVELOPMENT FALLBACK: Local file storage
            os.makedirs(f"uploads/{prefix}", exist_ok=True)
            local_path = f"uploads/{file_name}"
            with open(local_path, "wb") as f:
                f.write(file_content)
            # In development, serve from local URL or just return the path
            return f"/api/uploads/{file_name}"
            
    except ClientError as e:
        print(f"S3 Upload Error: {e}")
        return None
    except NoCredentialsError:
        print("Credentials not available")
        return None
    finally:
        # Reset file cursor for subsequent reads if needed
        await file.seek(0)
