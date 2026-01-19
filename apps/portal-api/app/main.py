"""Internal Tools Portal API - Main application."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import logger
from app.core.settings import settings
from app.registry import tool_registry

# Import tools to trigger registration
import app.tools  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"Registered tools: {[t.id for t in tool_registry.get_all_metadata()]}")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "healthy"}


@app.get("/api/tools")
async def list_tools() -> list[dict]:
    """Return metadata for all registered tools."""
    tools = tool_registry.get_all_metadata()
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
            "nav_order": t.nav_order,
            "tags": t.tags,
            "has_backend": t.has_backend,
        }
        for t in tools
    ]


# Mount tool routers
for tool_id, router in tool_registry.get_routers():
    app.include_router(router, prefix=f"/api/tools/{tool_id}", tags=[tool_id])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
