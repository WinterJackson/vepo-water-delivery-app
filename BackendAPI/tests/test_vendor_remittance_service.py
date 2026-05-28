"""
Tests for vendor_remittance_service: start_vendor_remittance, close_vendor_remittance.
Pure mocks — no database.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_start_vendor_remittance_unapproved_rider():
    """start_vendor_remittance should raise 403 when the rider isn't approved in the vendor registry."""
    from services.vendor_remittance_service import start_vendor_remittance

    deliverer_id = uuid4()
    vendor_id = uuid4()

    session = AsyncMock()

    # First query: check existing open vendor_remittance → None (no open vendor_remittance)
    open_result = MagicMock()
    open_result.scalar_one_or_none.return_value = None

    # Second query: check registry → None (not approved)
    registry_result = MagicMock()
    registry_result.scalar_one_or_none.return_value = None

    session.execute = AsyncMock(side_effect=[open_result, registry_result])

    with pytest.raises(HTTPException) as exc:
        await start_vendor_remittance(session, deliverer_id, vendor_id, full_bottles_out=10)

    assert exc.value.status_code == 403
    assert "not approved" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_start_vendor_remittance_already_open():
    """start_vendor_remittance should raise 400 when rider already has an open vendor_remittance."""
    from services.vendor_remittance_service import start_vendor_remittance

    deliverer_id = uuid4()
    vendor_id = uuid4()

    session = AsyncMock()

    existing_vendor_remittance = MagicMock()
    existing_vendor_remittance.id = uuid4()
    open_result = MagicMock()
    open_result.scalar_one_or_none.return_value = existing_vendor_remittance

    session.execute = AsyncMock(return_value=open_result)

    with pytest.raises(HTTPException) as exc:
        await start_vendor_remittance(session, deliverer_id, vendor_id, full_bottles_out=5)

    assert exc.value.status_code == 400
    assert "already" in exc.value.detail.lower()


@pytest.mark.asyncio
async def test_close_vendor_remittance_discrepancy():
    """close_vendor_remittance should set status to DISCREPANCY when empty bottles don't match."""
    from services.vendor_remittance_service import close_vendor_remittance
    from models.vendor_remittance_model import VendorRemittanceStatus

    vendor_remittance_id = uuid4()
    vendor_id = uuid4()

    mock_vendor_remittance = MagicMock()
    mock_vendor_remittance.id = vendor_remittance_id
    mock_vendor_remittance.vendor_id = vendor_id
    mock_vendor_remittance.status = VendorRemittanceStatus.OPEN
    mock_vendor_remittance.full_bottles_out = 10

    mock_vendor = MagicMock()
    mock_vendor.full_bottle_inventory = 0
    mock_vendor.empty_bottle_inventory = 0

    session = AsyncMock()
    # session.get called twice: once for VendorRemittance, once for Vendor
    session.get = AsyncMock(side_effect=[mock_vendor_remittance, mock_vendor])

    result = await close_vendor_remittance(
        session,
        vendor_remittance_id,
        full_bottles_returned=3,
        empty_bottles_collected=2,  # expected empties = 10 - 3 = 7, but only 2
        cash_collected=500.0,
    )

    assert result.status == VendorRemittanceStatus.DISCREPANCY
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_close_vendor_remittance_settled():
    """close_vendor_remittance should set status to SETTLED when empties match expectations."""
    from services.vendor_remittance_service import close_vendor_remittance
    from models.vendor_remittance_model import VendorRemittanceStatus

    vendor_remittance_id = uuid4()
    vendor_id = uuid4()

    mock_vendor_remittance = MagicMock()
    mock_vendor_remittance.id = vendor_remittance_id
    mock_vendor_remittance.vendor_id = vendor_id
    mock_vendor_remittance.status = VendorRemittanceStatus.OPEN
    mock_vendor_remittance.full_bottles_out = 10

    mock_vendor = MagicMock()
    mock_vendor.full_bottle_inventory = 0
    mock_vendor.empty_bottle_inventory = 0

    session = AsyncMock()
    session.get = AsyncMock(side_effect=[mock_vendor_remittance, mock_vendor])

    result = await close_vendor_remittance(
        session,
        vendor_remittance_id,
        full_bottles_returned=3,
        empty_bottles_collected=7,  # expected = 10 - 3 = 7 → match
        cash_collected=700.0,
    )

    assert result.status == VendorRemittanceStatus.SETTLED
    session.commit.assert_awaited_once()
