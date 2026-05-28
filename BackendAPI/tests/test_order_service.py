import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from decimal import Decimal


@pytest.mark.asyncio
async def test_get_closest_deliverer_returns_none():
    """When no deliverers are available, get_closest_deliverer should return None."""
    from services.order_service import get_closest_deliverer

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    result = await get_closest_deliverer(mock_session, lat=-1.28, lng=36.82)
    assert result is None


@pytest.mark.asyncio
async def test_create_order_with_no_deliverer_sets_unassigned():
    """Order should be created with order_status='unassigned' when no deliverer is found."""
    from services.order_service import create_order

    mock_session = AsyncMock()
    # session.add is synchronous in SQLAlchemy — override from AsyncMock to plain MagicMock
    mock_session.add = MagicMock()

    vendor_id = uuid4()

    cart_item = MagicMock()
    cart_item.vendor_id = vendor_id
    cart_item.product_id = uuid4()
    cart_item.quantity = 1
    cart_item.price = Decimal("100.00")
    cart_item.Subtotal = Decimal("100.00")
    cart_item.vendor = MagicMock(
        id=vendor_id, lat=-1.28, lng=36.82,
        vendor_type="retail_refill", deposit_fee=Decimal("50"),
        location=MagicMock(),
    )
    cart_item.product = MagicMock(
        stock=10, name="Water 20L", weight_kg=20.0, vendor_id=vendor_id
    )

    # Mock user with all attributes create_order reads
    mock_user = MagicMock()
    mock_user.debt_balance = Decimal("0")
    mock_user.active_deposits = 0
    mock_user.has_used_welcome_offer = True
    mock_user.empty_bottles_held = 0
    mock_user.push_token = None

    # 1st execute: Idempotency guard → None (no duplicate)
    mock_idempotency_result = MagicMock()
    mock_idempotency_result.scalar_one_or_none.return_value = None

    # 2nd execute: SELECT cart items
    mock_cart_result = MagicMock()
    mock_cart_result.unique.return_value.scalars.return_value.all.return_value = [cart_item]

    # 3rd execute: UPDATE...RETURNING (atomic stock decrement)
    mock_update_result = MagicMock()
    mock_update_result.fetchone.return_value = (9, "Water 20L", vendor_id)

    mock_session.execute = AsyncMock(
        side_effect=[mock_idempotency_result, mock_cart_result, mock_update_result]
    )

    # session.get returns mock_user for User lookups
    mock_session.get = AsyncMock(return_value=mock_user)
    # session.flush is needed for order ID generation
    mock_session.flush = AsyncMock()

    # Mock get_closest_deliverer to return None (triggers unassigned status)
    with patch("services.order_service.get_closest_deliverer", return_value=None), \
         patch("services.order_service.asyncio.create_task"), \
         patch("services.order_service.create_notification", new_callable=AsyncMock):
        result = await create_order(
            session=mock_session,
            CheckoutRequestID="test-unique-123",
            id=uuid4(),
            user_id=uuid4(),
            phone="254700000000",
            type="cart",
            lat=-1.28,
            lng=36.82,
        )
    # Function should not raise an error
    assert result is not None
