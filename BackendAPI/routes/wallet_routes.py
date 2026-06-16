from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from dependencies.dependencies import get_db
from utils.verify_user_token import get_current_user
from services.wallet_service import initiate_wallet_topup, handle_mpesa_topup_callback, initiate_wallet_withdrawal, get_wallet_transactions
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wallet", tags=["Wallet"])

class TopUpRequest(BaseModel):
    amount: float
    phone_number: str
    user_type: str

class WithdrawRequest(BaseModel):
    amount: float
    phone_number: str
    user_type: str

@router.post("/top-up")
async def top_up_wallet(request: TopUpRequest, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_current_user)):
    user_id = auth.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return await initiate_wallet_topup(
        session=db,
        user_id=user_id,
        user_type=request.user_type,
        amount=request.amount,
        phone=request.phone_number
    )

@router.post("/withdraw")
async def withdraw_wallet(request: WithdrawRequest, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_current_user)):
    user_id = auth.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return await initiate_wallet_withdrawal(
        session=db,
        user_id=user_id,
        user_type=request.user_type,
        amount=request.amount,
        phone=request.phone_number
    )

@router.get("/transactions")
async def fetch_wallet_transactions(limit: int = 50, offset: int = 0, search: str = None, type: str = None, db: AsyncSession = Depends(get_db), auth: dict = Depends(get_current_user)):
    user_id = auth.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return await get_wallet_transactions(session=db, user_id=user_id, limit=limit, offset=offset, search=search, transaction_type=type)

@router.post("/mpesa-callback")
async def mpesa_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        payload = await request.json()
        logger.info(f"M-PESA Wallet STK Callback received: {payload}")
        return await handle_mpesa_topup_callback(session=db, payload=payload)
    except Exception as e:
        logger.error(f"Error handling M-Pesa callback: {e}")
        return {"status": "error"}
