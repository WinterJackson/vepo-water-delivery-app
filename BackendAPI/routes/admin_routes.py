from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, text
from dependencies.dependencies import get_db
from models.order_model import Order
from models.payout_model import Payout
from utils.verify_user_token import get_current_user
import os
from datetime import datetime, timedelta, timezone

router = APIRouter()

def require_admin(user: dict = Depends(get_current_user)):
    clerk_id = user["sub"]
    admin_ids = os.getenv("ADMIN_CLERK_IDS", "").split(",")
    if clerk_id not in [aid.strip() for aid in admin_ids if aid.strip()]:
        raise HTTPException(status_code=403, detail="Unauthorized. Admin access required.")
    return clerk_id

@router.get("/revenue", summary="Get overall platform revenue")
async def get_platform_revenue(
    start_date: str = Query(None, description="Start date YYYY-MM-DD"),
    end_date: str = Query(None, description="End date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    base_query = "SELECT SUM(platform_total) as total, SUM(vendor_commission) as v_comm, SUM(service_fee) as s_fee, SUM(rider_commission) as r_comm, SUM(delivery_markup) as d_markup, SUM(surge_fee) as surge, COUNT(id) as orders, SUM(total_amount) as gmv FROM \"Orders\" WHERE payment_status = 'paid'"
    retail_base = "SELECT COUNT(o.id) as orders, SUM(o.platform_total) as revenue FROM \"Orders\" o JOIN \"Vendors\" v ON o.vendor_id = v.id WHERE v.vendor_type = 'retail_refill' AND o.payment_status = 'paid'"
    wholesale_base = "SELECT COUNT(o.id) as orders, SUM(o.platform_total) as revenue FROM \"Orders\" o JOIN \"Vendors\" v ON o.vendor_id = v.id WHERE v.vendor_type = 'wholesale_b2b' AND o.payment_status = 'paid'"

    params = {}
    if start_date:
        base_query += " AND created_at >= :start_date"
        retail_base += " AND o.created_at >= :start_date"
        wholesale_base += " AND o.created_at >= :start_date"
        params["start_date"] = f"{start_date} 00:00:00"
    if end_date:
        base_query += " AND created_at <= :end_date"
        retail_base += " AND o.created_at <= :end_date"
        wholesale_base += " AND o.created_at <= :end_date"
        params["end_date"] = f"{end_date} 23:59:59"

    res = await db.execute(text(base_query), params)
    row = res.fetchone()
    
    retail_res = await db.execute(text(retail_base), params)
    retail_row = retail_res.fetchone()
    
    wholesale_res = await db.execute(text(wholesale_base), params)
    wholesale_row = wholesale_res.fetchone()

    return {
        "total_platform_revenue": float(row.total or 0),
        "breakdown": {
            "vendor_commissions": float(row.v_comm or 0),
            "service_fees": float(row.s_fee or 0),
            "rider_commissions": float(row.r_comm or 0),
            "delivery_markups": float(row.d_markup or 0),
            "surge_fees": float(row.surge or 0)
        },
        "total_orders": int(row.orders or 0),
        "total_gmv": float(row.gmv or 0),
        "avg_revenue_per_order": float(row.total or 0) / int(row.orders) if int(row.orders or 0) > 0 else 0,
        "by_vendor_type": {
            "retail_refill": { "orders": int(retail_row.orders or 0), "revenue": float(retail_row.revenue or 0) },
            "wholesale_b2b": { "orders": int(wholesale_row.orders or 0), "revenue": float(wholesale_row.revenue or 0) }
        }
    }

@router.get("/payouts", summary="Get pending payouts")
async def get_pending_payouts(
    status: str = "pending",
    db: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    query = "SELECT p.id, p.amount, p.status, p.payment_method, p.account_details, p.created_at, p.provider_type FROM payouts p WHERE p.status = :status ORDER BY p.created_at DESC"
    res = await db.execute(text(query), {"status": status})
    rows = res.fetchall()
    
    return [
        {
            "id": str(r.id),
            "amount": float(r.amount),
            "status": r.status,
            "provider_type": r.provider_type,
            "payment_method": r.payment_method,
            "account_details": r.account_details,
            "created_at": r.created_at
        }
        for r in rows
    ]
