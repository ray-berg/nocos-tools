from dataclasses import dataclass, field
from typing import Callable

from fastapi import APIRouter


@dataclass
class ToolMetadata:
    id: str
    name: str
    description: str
    category: str
    nav_order: int = 100
    tags: list[str] = field(default_factory=list)
    has_backend: bool = False


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolMetadata] = {}
        self._routers: dict[str, APIRouter] = {}

    def register(
        self,
        metadata: ToolMetadata,
        router: APIRouter | None = None,
    ) -> None:
        self._tools[metadata.id] = metadata
        if router:
            metadata.has_backend = True
            self._routers[metadata.id] = router

    def get_all_metadata(self) -> list[ToolMetadata]:
        return sorted(self._tools.values(), key=lambda t: (t.nav_order, t.name))

    def get_routers(self) -> list[tuple[str, APIRouter]]:
        return [(tool_id, router) for tool_id, router in self._routers.items()]

    def tool(
        self,
        metadata: ToolMetadata,
    ) -> Callable[[APIRouter], APIRouter]:
        """Decorator to register a tool with its router."""

        def decorator(router: APIRouter) -> APIRouter:
            self.register(metadata, router)
            return router

        return decorator


tool_registry = ToolRegistry()
