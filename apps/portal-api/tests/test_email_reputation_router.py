"""Tests for Email Reputation router."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


class TestEmailReputationRouter:
    """Tests for Email Reputation API endpoints."""

    def test_run_valid_domain(self):
        """Test analysis with valid domain."""
        # Mock the orchestrator to avoid actual DNS queries
        with patch(
            "app.tools.email_reputation.router.EmailReputationOrchestrator"
        ) as mock_orch:
            mock_instance = MagicMock()
            mock_instance.run = AsyncMock(
                return_value=MagicMock(
                    domain="example.com",
                    queried_at="2024-01-01T00:00:00Z",
                    cached=False,
                    options={},
                    risk=None,
                    auth=None,
                    infrastructure=None,
                    reputation=None,
                    provider=None,
                    behavioral=None,
                    errors=[],
                    model_dump=lambda mode=None: {
                        "domain": "example.com",
                        "queried_at": "2024-01-01T00:00:00Z",
                        "cached": False,
                        "options": {},
                        "errors": [],
                    },
                )
            )
            mock_orch.return_value = mock_instance

            response = client.post(
                "/api/tools/email-reputation/run",
                json={"domain": "example.com"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["domain"] == "example.com"

    def test_run_invalid_domain(self):
        """Test analysis with invalid domain."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={"domain": "not a domain!"},
        )

        assert response.status_code == 400

    def test_run_domain_with_protocol(self):
        """Test analysis rejects domain with protocol."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={"domain": "https://example.com"},
        )

        assert response.status_code == 400
        assert "protocol" in response.json()["detail"].lower()

    def test_run_with_sending_ip(self):
        """Test analysis with valid sending IP."""
        with patch(
            "app.tools.email_reputation.router.EmailReputationOrchestrator"
        ) as mock_orch:
            mock_instance = MagicMock()
            mock_instance.run = AsyncMock(
                return_value=MagicMock(
                    domain="example.com",
                    queried_at="2024-01-01T00:00:00Z",
                    cached=False,
                    options={"sending_ip": "192.0.2.1"},
                    risk=None,
                    auth=None,
                    infrastructure=None,
                    reputation=None,
                    provider=None,
                    behavioral=None,
                    errors=[],
                    model_dump=lambda mode=None: {
                        "domain": "example.com",
                        "queried_at": "2024-01-01T00:00:00Z",
                        "cached": False,
                        "options": {"sending_ip": "192.0.2.1"},
                        "errors": [],
                    },
                )
            )
            mock_orch.return_value = mock_instance

            response = client.post(
                "/api/tools/email-reputation/run",
                json={"domain": "example.com", "sending_ip": "192.0.2.1"},
            )

            assert response.status_code == 200

    def test_run_with_invalid_ip(self):
        """Test analysis with invalid sending IP."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={"domain": "example.com", "sending_ip": "not.an.ip"},
        )

        assert response.status_code == 400

    def test_run_with_valid_from_address(self):
        """Test analysis with valid from address."""
        from datetime import datetime, timezone
        from app.tools.email_reputation.models import EmailReputationReport

        mock_report = EmailReputationReport(
            domain="example.com",
            queried_at=datetime.now(timezone.utc),
            cached=False,
            options={},
            errors=[],
        )

        with patch(
            "app.tools.email_reputation.router.EmailReputationOrchestrator"
        ) as mock_orch:
            mock_instance = MagicMock()
            mock_instance.run = AsyncMock(return_value=mock_report)
            mock_orch.return_value = mock_instance

            response = client.post(
                "/api/tools/email-reputation/run",
                json={"domain": "example.com", "from_address": "user@example.com"},
            )

            assert response.status_code == 200

    def test_run_with_invalid_from_address(self):
        """Test analysis with invalid from address."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={"domain": "example.com", "from_address": "not-an-email"},
        )

        assert response.status_code == 400

    def test_presets_endpoint(self):
        """Test presets endpoint."""
        response = client.get("/api/tools/email-reputation/presets")

        assert response.status_code == 200
        data = response.json()
        assert "cache_ttl_seconds" in data
        assert isinstance(data["cache_ttl_seconds"], int)

    def test_missing_domain(self):
        """Test request without domain."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={},
        )

        assert response.status_code == 422  # Validation error

    def test_empty_domain(self):
        """Test request with empty domain."""
        response = client.post(
            "/api/tools/email-reputation/run",
            json={"domain": ""},
        )

        assert response.status_code == 422  # Validation error
