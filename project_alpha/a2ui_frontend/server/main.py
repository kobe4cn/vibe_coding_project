"""A2UI Agent Server - Main entry point."""
import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse, parse_qs

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
            search = query_params.get("search", "")
            status = query_params.get("status", "")
            priority = query_params.get("priority", "")
            page = safe_int(query_params.get("page"), 1)
            
            tickets_data = await api_client.list_tickets(
                search=search if search else None,
                status=status if status else None,
                priority=priority if priority else None,
                page=page,
            )
            page_id, _ = build_tickets_page(builder)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_tickets_data(tickets_data, search, status, priority, page):
                yield msg
            yield builder.build_begin_rendering("app-layout")

        elif path == "/tickets/new":
            # Ticket create page - fetch tags for selection
            tags = await api_client.list_tags()
            page_id, _ = build_ticket_create_page(builder, tags)
            build_app_layout(builder, page_id, "tickets")

            yield builder.build_surface_update()
            for msg in build_ticket_create_data(tags):
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
    # Parse query params from the path parameter itself (e.g., /tickets?page=2)
    parsed = urlparse(path)
    actual_path = parsed.path
    path_query_params = parse_qs(parsed.query)

    # Also get query params from the request URL (excluding 'path')
    request_params = dict(request.query_params)
    request_params.pop("path", None)

    # Merge query params (path params take precedence)
    query_params = request_params.copy()
    for key, values in path_query_params.items():
        if values:
            query_params[key] = values[0]  # Take first value

    # Use actual_path for routing
    path = actual_path

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
        # Return error as JSON instead of raising HTTPException
        # This allows the client to display the error message
        error_message = str(e)
        if "409" in error_message or "Conflict" in error_message:
            error_message = "操作失败：该名称已存在，请使用其他名称"
        elif "400" in error_message or "Bad Request" in error_message:
            error_message = "操作失败：请检查输入内容"
        elif "404" in error_message or "Not Found" in error_message:
            error_message = "操作失败：资源未找到"
        else:
            error_message = f"操作失败：{error_message}"
        return {"success": False, "error": error_message}


async def process_action(action: UserAction) -> dict:
    """Process a userAction and return the result."""
    name = action.name
    context = action.context
    logger.info(f"Processing action '{name}' with context: {context}")

    if name == "navigate":
        # Navigation is handled client-side by reconnecting to SSE
        return {"navigate": context.get("to", "/tickets")}

    elif name in ["search_tickets", "filter_status", "filter_priority", "paginate"]:
        # Get current query params from context (passed from client)
        # Client should pass current query state
        # Handle None/null values from data model
        current_search = context.get("current_search") or ""
        current_status = context.get("current_status") or ""
        current_priority = context.get("current_priority") or ""
        current_page = safe_int(context.get("current_page"), 1)
        
        logger.info(f"Current state: search={current_search}, status={current_status}, priority={current_priority}, page={current_page}")

        # Initialize new values
        new_search = current_search
        new_status = current_status
        new_priority = current_priority
        new_page = current_page

        # Update based on action
        if name == "search_tickets":
            search_term = context.get('search') or ''
            new_search = search_term
            new_page = 1  # Reset to page 1 on new search
        elif name == "filter_status":
            status = context.get("status")
            if status is None:
                status = ""
            new_status = status
            new_page = 1  # Reset to page 1 on filter change
        elif name == "filter_priority":
            priority = context.get("priority")
            if priority is None:
                priority = ""
            new_priority = priority
            new_page = 1  # Reset to page 1 on filter change
        elif name == "paginate":
            page = safe_int(context.get("page"), 1)
            new_page = page

        logger.info(f"New state: search={new_search}, status={new_status}, priority={new_priority}, page={new_page}")

        # Build query string
        query_parts = []
        if new_search:
            query_parts.append(f"search={new_search}")
        if new_status:
            query_parts.append(f"status={new_status}")
        if new_priority:
            query_parts.append(f"priority={new_priority}")
        if new_page > 1:
            query_parts.append(f"page={new_page}")

        query_string = "?" + "&".join(query_parts) if query_parts else ""
        return {"navigate": f"/tickets{query_string}"}

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
        ticket_id = ticket['id']
        
        # Add selected tags to the ticket
        selected_tag_ids = form.get("selectedTagIds", "")
        if selected_tag_ids:
            tag_ids = [tid.strip() for tid in selected_tag_ids.split(",") if tid.strip()]
            for tag_id in tag_ids:
                try:
                    await api_client.add_tag_to_ticket(ticket_id, tag_id)
                except Exception as e:
                    logger.warning(f"Failed to add tag {tag_id} to ticket {ticket_id}: {e}")
        
        return {"navigate": f"/tickets/{ticket_id}"}

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

    elif name in ["show_create_tag_form", "hide_create_tag_form", "set_tag_color", "set_form_priority", "toggle_form_tag", "toggle_multi_select"]:
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
