"""App layout components."""
from a2ui_builder import A2UIBuilder


def build_app_layout(builder: A2UIBuilder, content_id: str, active_nav: str = "tickets"):
    """Build the main app layout with navigation."""
    # Navigation header - simplified without icons
    builder.text("nav-logo-text", "Ticket System", usage_hint="h2")

    # Nav items - simple text buttons
    builder.text("nav-tickets-text", "票据管理")
    builder.button(
        "nav-tickets",
        "nav-tickets-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )

    builder.text("nav-tags-text", "标签管理")
    builder.button(
        "nav-tags",
        "nav-tags-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tags"}}],
    )

    builder.row("nav-items", ["nav-tickets", "nav-tags"], alignment="center")
    builder.row("nav-header", ["nav-logo-text", "nav-items"], distribution="spaceBetween", alignment="center")

    # Main layout
    builder.divider("divider-nav")
    builder.column("app-layout", ["nav-header", "divider-nav", content_id])

    return builder
