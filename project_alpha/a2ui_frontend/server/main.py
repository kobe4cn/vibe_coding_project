"""A2UI Agent Server - Main entry point."""
import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

from config import settings
from models import UserAction
from api_client import api_client
from a2ui_builder import A2UIBuilder
from pages.layout import build_app_layout
from pages.tickets import (
    build_tickets_page, build_tickets_data,
    build_ticket_detail_page, build_ticket_detail_data,
    build_ticket_create_page, build_ticket_create_data,
    build_ticket_edit_page, build_ticket_edit_data,
)
from pages.tags import build_tags_page, build_tags_data
from pages.error import build_not_found_page, build_error_page

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="A2UI Agent Server", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_int(value, default: int = 1) -> int:
    """Safely convert value to int with default fallback."""
    if value is None:
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


async def generate_page_messages(path: str, query_params: dict) -> AsyncGenerator[str, None]:
    """Generate A2UI messages for a given page path."""
    builder = A2UIBuilder("main")

    try:
        # Route to appropriate page builder
        if path == "/" or path == "/tickets":
            # Tickets list page
            tickets_data = await api_client.list_tickets(
                search=query_params.get("search"),
                status=query_params.get("status"),
                priority=query_params.get("priority"),
                page=safe_int(query_params.get("page"), 1),
            )
            page_id, _ = build_tickets_page(builder)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_tickets_data(tickets_data):
                yield msg
            yield builder.build_begin_rendering("app-layout")

        elif path == "/tickets/new":
            # Ticket create page
            page_id, _ = build_ticket_create_page(builder)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_ticket_create_data():
                yield msg
            yield builder.build_begin_rendering("app-layout")

        elif path.startswith("/tickets/") and path.endswith("/edit"):
            # Ticket edit page
            ticket_id = path.split("/")[2]
            ticket = await api_client.get_ticket(ticket_id)
            page_id, _ = build_ticket_edit_page(builder, ticket)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_ticket_edit_data(ticket):
                yield msg
            yield builder.build_begin_rendering("app-layout")

        elif path.startswith("/tickets/"):
            # Ticket detail page
            ticket_id = path.split("/")[2]
            ticket = await api_client.get_ticket(ticket_id)
            attachments = await api_client.get_ticket_attachments(ticket_id)
            history_response = await api_client.get_ticket_history(ticket_id)
            history = history_response.get("data", [])

            page_id, _ = build_ticket_detail_page(builder, ticket)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_ticket_detail_data(ticket, attachments, history):
                yield msg
            yield builder.build_begin_rendering("app-layout")

        elif path == "/tags":
            # Tags page
            tags = await api_client.list_tags()
            page_id, _ = build_tags_page(builder)
            build_app_layout(builder, page_id, "tags")

            yield builder.build_surface_update()
            for msg in build_tags_data(tags):
                yield msg
            yield builder.build_begin_rendering("app-layout")

        else:
            # 404 page
            page_id, _ = build_not_found_page(builder)
            build_app_layout(builder, page_id, "")

            yield builder.build_surface_update()
            yield builder.build_begin_rendering("app-layout")

    except Exception as e:
        logger.exception(f"Error generating page: {e}")
        builder.reset()
        page_id, _ = build_error_page(builder, str(e))
        build_app_layout(builder, page_id, "")

        yield builder.build_surface_update()
        yield builder.build_begin_rendering("app-layout")


@app.get("/api/a2ui/stream")
async def stream_ui(
    request: Request,
    path: str = Query("/", description="Page path to render"),
):
    """SSE endpoint for A2UI messages."""
    query_params = dict(request.query_params)
    query_params.pop("path", None)

    async def event_generator():
        async for message in generate_page_messages(path, query_params):
            if await request.is_disconnected():
                break
            yield {"event": "message", "data": message}

    return EventSourceResponse(event_generator())


@app.post("/api/a2ui/action")
async def handle_action(action: UserAction):
    """Handle userAction from client."""
    logger.info(f"Received action: {action.name} with context: {action.context}")

    try:
        result = await process_action(action)
        return {"success": True, "result": result}
    except Exception as e:
        logger.exception(f"Error processing action: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def process_action(action: UserAction) -> dict:
    """Process a userAction and return the result."""
    name = action.name
    context = action.context

    if name == "navigate":
        # Navigation is handled client-side by reconnecting to SSE
        return {"navigate": context.get("to", "/tickets")}

    elif name == "search_tickets":
        # Search is handled by reconnecting with new params
        return {"navigate": f"/tickets?search={context.get('search', '')}"}

    elif name == "filter_status":
        status = context.get("status", "")
        return {"navigate": f"/tickets?status={status}" if status else "/tickets"}

    elif name == "filter_priority":
        priority = context.get("priority", "")
        return {"navigate": f"/tickets?priority={priority}" if priority else "/tickets"}

    elif name == "paginate":
        page = safe_int(context.get("page"), 1)
        return {"navigate": f"/tickets?page={page}"}

    elif name == "view_ticket":
        ticket_id = context.get("id")
        return {"navigate": f"/tickets/{ticket_id}"}

    elif name == "create_ticket":
        form = context.get("form", {})
        ticket = await api_client.create_ticket({
            "title": form.get("title"),
            "description": form.get("description"),
            "priority": form.get("priority", "medium"),
        })
        return {"navigate": f"/tickets/{ticket['id']}"}

    elif name == "update_ticket":
        ticket_id = context.get("id")
        form = context.get("form", {})
        await api_client.update_ticket(ticket_id, {
            "title": form.get("title"),
            "description": form.get("description"),
            "priority": form.get("priority"),
        })
        return {"navigate": f"/tickets/{ticket_id}"}

    elif name == "delete_ticket":
        ticket_id = context.get("id")
        await api_client.delete_ticket(ticket_id)
        return {"navigate": "/tickets"}

    elif name == "change_status":
        ticket_id = context.get("id")
        status = context.get("status")
        resolution = context.get("resolution")
        await api_client.update_ticket_status(ticket_id, {
            "status": status,
            "resolution": resolution,
        })
        return {"navigate": f"/tickets/{ticket_id}"}

    elif name == "create_tag":
        form = context.get("form", {})
        await api_client.create_tag({
            "name": form.get("name"),
            "color": form.get("color", "#3B82F6"),
        })
        return {"navigate": "/tags"}

    elif name == "delete_tag":
        tag_id = context.get("id")
        await api_client.delete_tag(tag_id)
        return {"navigate": "/tags"}

    elif name in ["show_create_tag_form", "hide_create_tag_form", "set_tag_color", "set_form_priority"]:
        # These are handled client-side via data model updates
        return {"handled": True}

    elif name in ["show_delete_dialog", "dismiss_dialog"]:
        # Dialog handling is client-side
        return {"handled": True}

    elif name == "retry":
        # Retry by refreshing current page
        return {"refresh": True}

    else:
        logger.warning(f"Unknown action: {name}")
        return {"unknown": True}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Serve static files for the client
try:
    app.mount("/", StaticFiles(directory="../client/dist", html=True), name="static")
except RuntimeError:
    # Client not built yet
    @app.get("/")
    async def root():
        return {"message": "A2UI Agent Server is running. Build the client to serve the UI."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.host, port=settings.port)
