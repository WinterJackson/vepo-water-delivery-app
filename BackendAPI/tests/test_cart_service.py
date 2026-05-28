import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from decimal import Decimal
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_add_to_cart_rejects_insufficient_stock():
    """Adding to cart should raise HTTPException when stock is insufficient."""
    from services.cart_services import add_to_cart_service

    product = MagicMock()
    product.stock = 2
    product.name = "Water 5L"

    with patch("services.cart_services.get_product_for_cart", return_value=product):
        with pytest.raises(HTTPException) as exc_info:
            await add_to_cart_service(
                user_id=uuid4(),
                session=AsyncMock(),
                product_id=uuid4(),
                quantity=5,  # More than stock of 2
            )
        assert exc_info.value.status_code == 400
        assert "Insufficient stock" in str(exc_info.value.detail)
