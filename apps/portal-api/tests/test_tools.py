import pytest


@pytest.mark.asyncio
async def test_tools_endpoint(client):
    """Test that tools endpoint returns list of tools."""
    response = await client.get("/api/tools")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # At least URL Inspector is registered

    # Check tool structure
    tool = data[0]
    assert "id" in tool
    assert "name" in tool
    assert "description" in tool
    assert "category" in tool
    assert "tags" in tool


@pytest.mark.asyncio
async def test_url_inspector_in_registry(client):
    """Test that URL Inspector tool is registered."""
    response = await client.get("/api/tools")
    data = response.json()
    tool_ids = [t["id"] for t in data]
    assert "url-inspector" in tool_ids
