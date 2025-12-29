"""Error page builders."""
from a2ui_builder import A2UIBuilder


def build_not_found_page(builder: A2UIBuilder) -> tuple[str, list[str]]:
    """Build the 404 not found page."""
    builder.icon("notfound-icon", "error_outline")
    builder.text("notfound-title", "404", usage_hint="h1")
    builder.text("notfound-subtitle", "页面未找到", usage_hint="h2")
    builder.text("notfound-desc", "您访问的页面不存在，请检查URL是否正确")

    builder.icon("notfound-home-icon", "home")
    builder.text("notfound-home-text", "返回首页")
    builder.row("notfound-home-content", ["notfound-home-icon", "notfound-home-text"], alignment="center")
    builder.button(
        "notfound-home-btn",
        "notfound-home-content",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )

    builder.column(
        "notfound-page",
        ["notfound-icon", "notfound-title", "notfound-subtitle", "notfound-desc", "notfound-home-btn"],
        alignment="center",
    )

    return "notfound-page", []


def build_error_page(builder: A2UIBuilder, error_message: str = "发生错误") -> tuple[str, list[str]]:
    """Build a generic error page."""
    builder.icon("error-icon", "error")
    builder.text("error-title", "出错了", usage_hint="h1")
    builder.text("error-message", error_message)

    builder.icon("error-retry-icon", "refresh")
    builder.text("error-retry-text", "重试")
    builder.row("error-retry-content", ["error-retry-icon", "error-retry-text"], alignment="center")
    builder.button("error-retry-btn", "error-retry-content", "retry", [])

    builder.icon("error-home-icon", "home")
    builder.text("error-home-text", "返回首页")
    builder.row("error-home-content", ["error-home-icon", "error-home-text"], alignment="center")
    builder.button(
        "error-home-btn",
        "error-home-content",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )

    builder.row("error-actions", ["error-retry-btn", "error-home-btn"], alignment="center")
    builder.column("error-page", ["error-icon", "error-title", "error-message", "error-actions"], alignment="center")

    return "error-page", []


def build_loading_state(builder: A2UIBuilder) -> tuple[str, list[str]]:
    """Build a loading state component."""
    builder.icon("loading-icon", "hourglass_empty")
    builder.text("loading-text", "加载中...")
    builder.column("loading-state", ["loading-icon", "loading-text"], alignment="center")

    return "loading-state", []
