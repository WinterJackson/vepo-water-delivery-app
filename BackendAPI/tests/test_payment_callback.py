"""Tests for M-Pesa payment callback handling."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


class TestPaymentCallback:
    """Tests for check_payment ResultCode validation logic."""

    @pytest.mark.asyncio
    @patch("services.payment_service.generate_password", return_value=("test_pass", "20260414120000"))
    @patch("services.payment_service.get_access_token", new_callable=AsyncMock)
    @patch("services.payment_service.httpx.AsyncClient")
    async def test_result_code_0_marks_paid(self, mock_client_cls, mock_token, mock_pwd):
        """ResultCode=0 should mark payment as paid."""
        mock_token.return_value = "test_token"

        mock_response = MagicMock()
        mock_response.json.return_value = {"ResultCode": "0", "ResultDesc": "Success"}
        mock_response.text = '{"ResultCode":"0"}'

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

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
    @patch("services.payment_service.httpx.AsyncClient")
    async def test_result_code_1032_marks_failed(self, mock_client_cls, mock_token, mock_pwd):
        """ResultCode=1032 (cancelled) should mark payment as failed."""
        mock_token.return_value = "test_token"

        mock_response = MagicMock()
        mock_response.json.return_value = {"ResultCode": "1032", "ResultDesc": "Cancelled"}
        mock_response.text = '{"ResultCode":"1032"}'

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

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
    @patch("services.payment_service.httpx.AsyncClient")
    async def test_missing_result_code_returns_error(self, mock_client_cls, mock_token, mock_pwd):
        """Missing ResultCode should return an error message."""
        mock_token.return_value = "test_token"

        mock_response = MagicMock()
        mock_response.json.return_value = {"errorMessage": "Invalid request"}
        mock_response.text = '{"errorMessage":"Invalid request"}'

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        from services.payment_service import check_payment

        session = AsyncMock()
        result = await check_payment("ws_CO_MISSING", session)
        assert "missing ResultCode" in result["message"] or "processing" in result["message"]
        assert result["code"] == "pending"
