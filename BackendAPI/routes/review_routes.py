from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from schemas.review_schemas import ReviewCreate, ReviewOut
from services.review_service import create_review

router = APIRouter()

@router.post("/", response_model=ReviewOut)
async def submit_review(
    body: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    clerk_id = user["sub"]
    try:
        review = await create_review(session=db, clerk_id=clerk_id, data=body)
        return review
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
