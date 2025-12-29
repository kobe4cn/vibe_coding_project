"""HTTP client for backend API."""
import httpx
from typing import Any, Optional

from config import settings


class ApiClient:
    """Client for communicating with the backend API."""

    def __init__(self):
        self.base_url = settings.backend_url

    async def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        json: Optional[dict] = None,
    ) -> Any:
        """Make HTTP request to backend."""
        # Disable proxy for local backend requests (trust_env=False ignores HTTP_PROXY env vars)
        async with httpx.AsyncClient(trust_env=False) as client:
            url = f"{self.base_url}{path}"
            response = await client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=30.0,
            )
            response.raise_for_status()
            if response.status_code == 204:
                return None
            return response.json()

    async def get(self, path: str, params: Optional[dict] = None) -> Any:
        return await self._request("GET", path, params=params)

    async def post(self, path: str, json: Optional[dict] = None) -> Any:
        return await self._request("POST", path, json=json)

    async def put(self, path: str, json: Optional[dict] = None) -> Any:
        return await self._request("PUT", path, json=json)

    async def patch(self, path: str, json: Optional[dict] = None) -> Any:
        return await self._request("PATCH", path, json=json)

    async def delete(self, path: str) -> Any:
        return await self._request("DELETE", path)

    # Ticket API
    async def list_tickets(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        params = {"page": str(page), "per_page": str(per_page)}
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        if priority:
            params["priority"] = priority
        return await self.get("/api/tickets", params)

    async def get_ticket(self, ticket_id: str) -> dict:
        return await self.get(f"/api/tickets/{ticket_id}")

    async def create_ticket(self, data: dict) -> dict:
        return await self.post("/api/tickets", data)

    async def update_ticket(self, ticket_id: str, data: dict) -> dict:
        return await self.put(f"/api/tickets/{ticket_id}", data)

    async def delete_ticket(self, ticket_id: str) -> None:
        await self.delete(f"/api/tickets/{ticket_id}")

    async def update_ticket_status(self, ticket_id: str, data: dict) -> dict:
        return await self.patch(f"/api/tickets/{ticket_id}/status", data)

    async def get_ticket_history(self, ticket_id: str) -> dict:
        return await self.get(f"/api/tickets/{ticket_id}/history")

    async def get_ticket_attachments(self, ticket_id: str) -> list:
        return await self.get(f"/api/tickets/{ticket_id}/attachments")

    # Tag API
    async def list_tags(self) -> list:
        return await self.get("/api/tags")

    async def create_tag(self, data: dict) -> dict:
        return await self.post("/api/tags", data)

    async def delete_tag(self, tag_id: str) -> None:
        await self.delete(f"/api/tags/{tag_id}")


api_client = ApiClient()
