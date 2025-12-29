"""Page builders for A2UI frontend."""
from .layout import build_app_layout
from .tickets import (
    build_tickets_page,
    build_ticket_detail_page,
    build_ticket_create_page,
    build_ticket_edit_page,
)
from .tags import build_tags_page
from .error import build_not_found_page, build_error_page

__all__ = [
    "build_app_layout",
    "build_tickets_page",
    "build_ticket_detail_page",
    "build_ticket_create_page",
    "build_ticket_edit_page",
    "build_tags_page",
    "build_not_found_page",
    "build_error_page",
]
