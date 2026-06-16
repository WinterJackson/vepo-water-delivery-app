"""Tests for M-Pesa payment callback handling."""
import pytest
import respx
import httpx
from unittest.mock import AsyncMock, patch

class TestPaymentCallback:
    """Tests for check_payment ResultCode validation logic."""

    @pytest.mark.asyncio
    @patch("services.payment_service.generate_password", return_value=("test_pass", "20260414120000"))
    @patch("services.payment_service.get_access_token", new_callable=AsyncMock)
    @respx.mock
    async def test_result_code_0_marks_paid(self, mock_token, mock_pwd):
        """ResultCode=0 should mark payment as paid."""
        mock_token.return_value = "test_token"

        respx.post("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query").mock(
            return_value=httpx.Response(200, json={"ResultCode": "0", "ResultDesc": "Success"})
        )

        with patch("services.payment_service.update_orders_payment_status_by_checkout_id", new_callable=AsyncMock) as mock_update:
            mock_update.return_value = {"message": "Payment confirmed"}
            from services.payment_service import check_payment

            session = AsyncMock()
            result = await check_payment("ws_CO_TEST123", session)

            mock_update.assert_called_once_with(
                session=session,
                checkout_request_id="ws_CO_TEST123",
                new_status="paid"
            )
            assert result == {"message": "Payment confirmed"}

    @pytest.mark.asyncio
    @patch("services.payment_service.generate_password", return_value=("test_pass", "20260414120000"))
    @patch("services.payment_service.get_access_token", new_callable=AsyncMock)
    @respx.mock
    async def test_result_code_1032_marks_failed(self, mock_token, mock_pwd):
        """ResultCode=1032 (cancelled) should mark payment as failed."""
        mock_token.return_value = "test_token"

        respx.post("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query").mock(
            return_value=httpx.Response(200, json={"ResultCode": "1032", "ResultDesc": "Cancelled"})
        )

        with patch("services.payment_service.update_orders_payment_status_by_checkout_id", new_callable=AsyncMock) as mock_update:
            from services.payment_service import check_payment

            session = AsyncMock()
            result = await check_payment("ws_CO_FAIL", session)

            mock_update.assert_called_once_with(
                session=session,
                checkout_request_id="ws_CO_FAIL",
                new_status="failed"
            )
            assert result["code"] == "1032"
            assert "cancelled" in result["message"].lower()

    @pytest.mark.asyncio
    @patch("services.payment_service.generate_password", return_value=("test_pass", "20260414120000"))
    @patch("services.payment_service.get_access_token", new_callable=AsyncMock)
    @respx.mock
    async def test_missing_result_code_returns_error(self, mock_token, mock_pwd):
        """Missing ResultCode should return an error message."""
        mock_token.return_value = "test_token"

        respx.post("https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query").mock(
            return_value=httpx.Response(200, json={"errorMessage": "Invalid request"})
        )

        from services.payment_service import check_payment

        session = AsyncMock()
        result = await check_payment("ws_CO_MISSING", session)
        assert "missing ResultCode" in result["message"] or "processing" in result["message"]
        assert result["code"] == "pending"

