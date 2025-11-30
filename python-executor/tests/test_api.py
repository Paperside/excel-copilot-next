"""
Integration tests for the FastAPI endpoints.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.mark.asyncio
class TestAPIEndpoints:
    """Test FastAPI endpoints."""

    @pytest.fixture
    async def client(self):
        """Create test client."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    async def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200

        data = response.json()
        assert data['status'] == 'ok'
        assert 'active_kernels' in data
        assert 'version' in data

    async def test_execute_simple_code(self, client):
        """Test executing simple Python code."""
        payload = {
            "user_id": "test_user",
            "code": "print('Hello, API!')",
            "working_dir": "/tmp/test_user"
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data['success'] is True
        assert 'Hello, API!' in data['output']

    async def test_execute_with_timeout(self, client):
        """Test execution with custom timeout."""
        payload = {
            "user_id": "test_user_timeout",
            "code": "import time; time.sleep(0.1); print('done')",
            "working_dir": "/tmp/test_user_timeout",
            "timeout": 5
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data['success'] is True
        assert 'done' in data['output']

    async def test_execute_invalid_code(self, client):
        """Test executing invalid Python code."""
        payload = {
            "user_id": "test_user_invalid",
            "code": "print('unclosed string",
            "working_dir": "/tmp/test_user_invalid"
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 400
        assert 'validation failed' in response.json()['detail'].lower()

    async def test_execute_dangerous_code(self, client):
        """Test executing dangerous code."""
        payload = {
            "user_id": "test_user_danger",
            "code": "os.system('ls')",
            "working_dir": "/tmp/test_user_danger"
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 400
        assert 'dangerous' in response.json()['detail'].lower()

    async def test_execute_with_error(self, client):
        """Test code execution that produces an error."""
        payload = {
            "user_id": "test_user_error",
            "code": "1 / 0",
            "working_dir": "/tmp/test_user_error"
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data['success'] is False
        assert 'ZeroDivisionError' in data['error']

    async def test_execute_polars_code(self, client):
        """Test executing Polars data processing code."""
        payload = {
            "user_id": "test_user_polars",
            "code": """
import polars as pl
df = pl.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
print(df.shape)
print(df['a'].sum())
""",
            "working_dir": "/tmp/test_user_polars"
        }

        response = await client.post("/execute", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data['success'] is True
        assert '(3, 2)' in data['output']
        assert '6' in data['output']
