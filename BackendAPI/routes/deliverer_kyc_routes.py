from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from dependencies.dependencies import get_db
from models.deliverer_model import Deliverer, KYCStatus
from dependencies.auth_dependencies import get_current_rider
from utils.s3_utils import upload_file_to_s3

router = APIRouter(
    prefix="/api/deliverer/kyc",
    tags=["Deliverer KYC"]
)

@router.post("/upload")
async def upload_kyc_documents(
    id_card_front: UploadFile = File(...),
    id_card_back: UploadFile = File(...),
    driver_license: Optional[UploadFile] = File(None),
    plate_number: Optional[str] = Form(None),
    vehicle_type: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db)
):
    """
    Securely uploads KYC documents to AWS S3 and updates the deliverer's record.
    Sets the kyc_status to 'pending'.
    """
    user_clerk_id = current_user.get("sub")
    if not user_clerk_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Get the Deliverer record
    result = await db.execute(select(Deliverer).where(Deliverer.clerk_id == user_clerk_id))
    deliverer = result.scalar_one_or_none()

    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # Validate file types (basic check)
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if id_card_front.content_type not in allowed_types or id_card_back.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, or PDF allowed.")

    # Upload files
    front_url = await upload_file_to_s3(id_card_front, prefix="kyc/id_front")
    back_url = await upload_file_to_s3(id_card_back, prefix="kyc/id_back")
    
    if not front_url or not back_url:
        raise HTTPException(status_code=500, detail="Failed to upload documents securely")

    deliverer.id_card_front = front_url
    deliverer.id_card_back = back_url

    if driver_license:
        if driver_license.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid driver license file type.")
        dl_url = await upload_file_to_s3(driver_license, prefix="kyc/license")
        if dl_url:
            deliverer.driver_license = dl_url

    # Update metadata if provided
    if plate_number:
        deliverer.plate_number = plate_number
    if vehicle_type:
        deliverer.vehicle_type = vehicle_type

    # Set status to pending review
    deliverer.kyc_status = KYCStatus.pending
    
    await db.commit()
    await db.refresh(deliverer)

    return {
        "message": "KYC documents uploaded successfully. Your profile is now under review.",
        "kyc_status": deliverer.kyc_status
    }


@router.get("/status")
async def get_kyc_status(
    current_user: dict = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the current KYC verification status and whether the rider 
    is approved by any vendors (Operational Status).
    """
    user_clerk_id = current_user.get("sub")
    if not user_clerk_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = await db.execute(select(Deliverer).where(Deliverer.clerk_id == user_clerk_id))
    deliverer = result.scalar_one_or_none()

    if not deliverer:
        raise HTTPException(status_code=404, detail="Rider profile not found")

    # In a real scenario, you'd also query DelivererVendor to check if they have approved vendors
    # For this endpoint, we will just return the primary status
    return {
        "is_verified": deliverer.is_verified,
        "kyc_status": deliverer.kyc_status,
        "employer_vendor_id": deliverer.employer_vendor_id,
        "vehicle_type": deliverer.vehicle_type,
        "plate_number": deliverer.plate_number
    }
