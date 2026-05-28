"""
Tests for payout_service: request_payout balance validation and advisory locking.
Pure mocks — no real database.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from fastapi import HTTPException
from schemas.payout_schemas import PayoutCreate


@pytest.mark.asyncio
async def test_request_payout_insufficient_balance():
    """request_payout should raise 400 when requested amount exceeds available balance."""
    from services.payout_service import request_payout

    clerk_id = "clerk_v1"
    vendor_id = uuid4()

    session = AsyncMock()
    # Advisory lock call succeeds (returns result)
    session.execute = AsyncMock(return_value=MagicMock(scalar=MagicMock(return_value=1)))

    with patch(
        "services.payout_service._get_provider_details",
        new_callable=AsyncMock,
        return_value=(vendor_id, "vendor"),
    ), patch(
        "services.payout_service._get_available_balance",
        new_callable=AsyncMock,
        return_value=500.0,  # Only 500 available
    ):
        with pytest.raises(HTTPException) as exc:
            await request_payout(
                session,
                clerk_id,
                PayoutCreate(amount=1000.0, payment_method="mpesa", account_details="254700000000"),
            )

    assert exc.value.status_code == 400
    assert "insufficient" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_request_payout_success():
    """request_payout should create a Payout record and commit when balance is sufficient."""
    from services.payout_service import request_payout

    clerk_id = "clerk_v1"
    vendor_id = uuid4()

    session = AsyncMock()
    session.add = MagicMock()
    # Advisory lock call
    session.execute = AsyncMock(return_value=MagicMock(scalar=MagicMock(return_value=1)))

    with patch(
        "services.payout_service._get_provider_details",
        new_callable=AsyncMock,
        return_value=(vendor_id, "vendor"),
    ), patch(
        "services.payout_service._get_available_balance",
        new_callable=AsyncMock,
        return_value=2000.0,
    ), patch(
        "services.payout_service.initiate_b2c_payout",
        new_callable=AsyncMock,
        return_value={"success": True, "ConversationID": "AG_123"},
        create=True,
    ), patch(
        "services.notification_service.create_notification",
        new_callable=AsyncMock,
    ):
        payout = await request_payout(
            session,
            clerk_id,
            PayoutCreate(amount=500.0, payment_method="mpesa", account_details="254700000000"),
        )

    # payout is a Payout ORM object; session.add should have been called
    session.add.assert_called_once()
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_request_payout_zero_amount():
    """request_payout should reject zero or negative amounts."""
    from services.payout_service import request_payout

    session = AsyncMock()

    with patch(
        "services.payout_service._get_provider_details",
        new_callable=AsyncMock,
        return_value=(uuid4(), "vendor"),
    ):
        with pytest.raises(HTTPException) as exc:
            await request_payout(
                session,
                "clerk_v1",
                PayoutCreate(amount=0, payment_method="mpesa", account_details="254700000000"),
            )

    assert exc.value.status_code == 400
    assert "greater than zero" in exc.value.detail.lower()
