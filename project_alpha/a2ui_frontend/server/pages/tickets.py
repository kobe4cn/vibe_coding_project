"""Ticket page builders."""
from typing import Any, Optional
from a2ui_builder import A2UIBuilder, value_string, value_number, value_map, build_value_map_from_dict
from models import (
    STATUS_LABELS, PRIORITY_LABELS, STATUS_TRANSITIONS,
    TicketStatus, Priority
)


def build_tickets_page(builder: A2UIBuilder) -> tuple[str, list[str]]:
    """Build the tickets list page."""
    # Page header
    builder.text("tickets-title", "票据列表", usage_hint="h1")
    builder.text("tickets-add-text", "+ 新建票据")
    builder.button(
        "tickets-add-btn",
        "tickets-add-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets/new"}}],
    )
    builder.row("tickets-header", ["tickets-title", "tickets-add-btn"], distribution="spaceBetween", alignment="center")

    # Search
    builder.text_field("tickets-search", "搜索票据...", builder.path("/app/tickets/query/search"))
    builder.text("tickets-search-btn-text", "搜索")
    builder.button(
        "tickets-search-btn",
        "tickets-search-btn-text",
        "search_tickets",
        [{"key": "search", "value": {"path": "/app/tickets/query/search"}}],
    )
    builder.row("tickets-search-row", ["tickets-search", "tickets-search-btn"], alignment="center")

    # Status filter buttons
    builder.text("filter-all-text", "全部")
    builder.button("filter-all", "filter-all-text", "filter_status", [{"key": "status", "value": {"literalString": ""}}])
    builder.text("filter-open-text", "待处理")
    builder.button("filter-open", "filter-open-text", "filter_status", [{"key": "status", "value": {"literalString": "open"}}])
    builder.text("filter-progress-text", "处理中")
    builder.button("filter-progress", "filter-progress-text", "filter_status", [{"key": "status", "value": {"literalString": "in_progress"}}])
    builder.text("filter-completed-text", "已完成")
    builder.button("filter-completed", "filter-completed-text", "filter_status", [{"key": "status", "value": {"literalString": "completed"}}])
    builder.text("filter-cancelled-text", "已取消")
    builder.button("filter-cancelled", "filter-cancelled-text", "filter_status", [{"key": "status", "value": {"literalString": "cancelled"}}])
    builder.row("tickets-status-filters", ["filter-all", "filter-open", "filter-progress", "filter-completed", "filter-cancelled"], alignment="center")

    # Priority filter buttons
    builder.text("priority-all-text", "全部优先级")
    builder.button("priority-all", "priority-all-text", "filter_priority", [{"key": "priority", "value": {"literalString": ""}}])
    builder.text("priority-low-text", "低")
    builder.button("priority-low", "priority-low-text", "filter_priority", [{"key": "priority", "value": {"literalString": "low"}}])
    builder.text("priority-medium-text", "中")
    builder.button("priority-medium", "priority-medium-text", "filter_priority", [{"key": "priority", "value": {"literalString": "medium"}}])
    builder.text("priority-high-text", "高")
    builder.button("priority-high", "priority-high-text", "filter_priority", [{"key": "priority", "value": {"literalString": "high"}}])
    builder.text("priority-urgent-text", "紧急")
    builder.button("priority-urgent", "priority-urgent-text", "filter_priority", [{"key": "priority", "value": {"literalString": "urgent"}}])
    builder.row("tickets-priority-filters", ["priority-all", "priority-low", "priority-medium", "priority-high", "priority-urgent"], alignment="center")

    builder.column("tickets-filters", ["tickets-search-row", "tickets-status-filters", "tickets-priority-filters"])
    builder.card("tickets-filters-card", "tickets-filters")

    # Ticket list template - simplified without icons
    builder.text("ticket-item-title", builder.path("title"), usage_hint="h3")
    builder.text("ticket-item-status", builder.path("statusLabel"))
    builder.text("ticket-item-priority", builder.path("priorityLabel"))
    builder.text("ticket-item-date", builder.path("created_at"))
    builder.row("ticket-item-meta", ["ticket-item-status", "ticket-item-priority", "ticket-item-date"], alignment="center")
    builder.column("ticket-item-content", ["ticket-item-title", "ticket-item-meta"])
    builder.text("ticket-item-arrow", "→")
    builder.row("ticket-item-row", ["ticket-item-content", "ticket-item-arrow"], distribution="spaceBetween", alignment="center")
    builder.button(
        "ticket-item-btn",
        "ticket-item-row",
        "view_ticket",
        [{"key": "id", "value": {"path": "id"}}],
    )
    builder.card("ticket-item-card", "ticket-item-btn")

    # Ticket list
    builder.list_component(
        "tickets-list",
        template={"componentId": "ticket-item-card", "dataBinding": "/app/tickets/list"},
        direction="vertical",
    )

    # Empty state
    builder.text("tickets-empty-title", "暂无票据", usage_hint="h3")
    builder.text("tickets-empty-desc", "点击上方按钮创建第一个票据")
    builder.column("tickets-empty", ["tickets-empty-title", "tickets-empty-desc"], alignment="center")

    # Pagination - use literalNumber for page values since they're numbers
    builder.text("pagination-prev-text", "← 上一页")
    builder.button(
        "pagination-prev",
        "pagination-prev-text",
        "paginate",
        [{"key": "page", "value": {"path": "/app/tickets/pagination/prevPage"}}],
    )
    builder.text("pagination-info", builder.path("/app/tickets/pagination/info"))
    builder.text("pagination-next-text", "下一页 →")
    builder.button(
        "pagination-next",
        "pagination-next-text",
        "paginate",
        [{"key": "page", "value": {"path": "/app/tickets/pagination/nextPage"}}],
    )
    builder.row("tickets-pagination", ["pagination-prev", "pagination-info", "pagination-next"], distribution="center", alignment="center")

    # Main content
    builder.column("tickets-content", ["tickets-list", "tickets-pagination"])
    builder.column("tickets-page", ["tickets-header", "tickets-filters-card", "tickets-content"])

    return "tickets-page", []


def build_tickets_data(tickets_response: dict) -> list[str]:
    """Build data model updates for tickets page."""
    messages = []
    builder = A2UIBuilder()

    # Query state
    query_data = [
        value_string("search", ""),
        value_string("status", ""),
        value_string("priority", ""),
        value_number("page", tickets_response.get("page", 1)),
    ]
    messages.append(builder.build_data_model_update("/app/tickets/query", query_data))

    # Tickets list
    tickets = tickets_response.get("data", [])
    list_data = []
    for i, ticket in enumerate(tickets):
        ticket_map = build_value_map_from_dict({
            "id": ticket["id"],
            "title": ticket["title"],
            "status": ticket["status"],
            "statusLabel": STATUS_LABELS.get(TicketStatus(ticket["status"]), ticket["status"]),
            "priority": ticket["priority"],
            "priorityLabel": PRIORITY_LABELS.get(Priority(ticket["priority"]), ticket["priority"]),
            "created_at": ticket["created_at"][:10],  # Date only
        })
        list_data.append(value_map(f"ticket{i}", ticket_map))
    messages.append(builder.build_data_model_update("/app/tickets/list", list_data))

    # Pagination
    page = tickets_response.get("page", 1)
    total_pages = tickets_response.get("total_pages", 1)
    pagination_data = [
        value_number("page", page),
        value_number("totalPages", total_pages),
        value_number("prevPage", max(1, page - 1)),
        value_number("nextPage", min(total_pages, page + 1)),
        value_string("info", f"第 {page} 页 / 共 {total_pages} 页"),
    ]
    messages.append(builder.build_data_model_update("/app/tickets/pagination", pagination_data))

    return messages


def build_ticket_detail_page(builder: A2UIBuilder, ticket: dict) -> tuple[str, list[str]]:
    """Build the ticket detail page."""
    ticket_id = ticket["id"]
    status = ticket["status"]

    # Back button
    builder.text("detail-back-text", "← 返回列表")
    builder.button(
        "detail-back-btn",
        "detail-back-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )

    # Title
    builder.text("detail-title", builder.path("/app/ticket/detail/title"), usage_hint="h1")

    # Actions
    builder.text("detail-edit-text", "编辑")
    builder.button(
        "detail-edit-btn",
        "detail-edit-text",
        "navigate",
        [{"key": "to", "value": {"literalString": f"/tickets/{ticket_id}/edit"}}],
    )

    builder.text("detail-delete-text", "删除")
    builder.button(
        "detail-delete-btn",
        "detail-delete-text",
        "show_delete_dialog",
        [{"key": "id", "value": {"literalString": ticket_id}}],
    )

    builder.row("detail-actions", ["detail-edit-btn", "detail-delete-btn"], alignment="center")
    builder.row("detail-header", ["detail-back-btn", "detail-title", "detail-actions"], distribution="spaceBetween", alignment="center")

    # Description card
    builder.text("detail-desc-label", "描述", usage_hint="h4")
    builder.text("detail-desc-content", builder.path("/app/ticket/detail/description"))
    builder.column("detail-desc-col", ["detail-desc-label", "detail-desc-content"])
    builder.card("detail-desc-card", "detail-desc-col")

    # Resolution card (if exists)
    builder.text("detail-resolution-label", "处理结果", usage_hint="h4")
    builder.text("detail-resolution-content", builder.path("/app/ticket/detail/resolution"))
    builder.column("detail-resolution-col", ["detail-resolution-label", "detail-resolution-content"])
    builder.card("detail-resolution-card", "detail-resolution-col")

    # Status card
    builder.text("detail-status-label", "状态", usage_hint="h4")
    builder.text("detail-status-value", builder.path("/app/ticket/detail/statusLabel"))

    # Status transition buttons
    allowed_transitions = STATUS_TRANSITIONS.get(TicketStatus(status), [])
    status_btns = []
    for target_status in allowed_transitions:
        btn_id = f"status-btn-{target_status.value}"
        text_id = f"status-btn-text-{target_status.value}"
        builder.text(text_id, f"→ {STATUS_LABELS[target_status]}")
        builder.button(
            btn_id,
            text_id,
            "change_status",
            [
                {"key": "id", "value": {"literalString": ticket_id}},
                {"key": "status", "value": {"literalString": target_status.value}},
            ],
        )
        status_btns.append(btn_id)

    builder.row("detail-status-btns", status_btns, alignment="center")
    builder.column("detail-status-col", ["detail-status-label", "detail-status-value", "detail-status-btns"])
    builder.card("detail-status-card", "detail-status-col")

    # Priority card
    builder.text("detail-priority-label", "优先级", usage_hint="h4")
    builder.text("detail-priority-value", builder.path("/app/ticket/detail/priorityLabel"))
    builder.column("detail-priority-col", ["detail-priority-label", "detail-priority-value"])
    builder.card("detail-priority-card", "detail-priority-col")

    # Tags card
    builder.text("detail-tags-label", "标签", usage_hint="h4")
    builder.text("detail-tag-name", builder.path("name"))
    builder.list_component(
        "detail-tags-list",
        template={"componentId": "detail-tag-name", "dataBinding": "/app/ticket/tags"},
        direction="horizontal",
    )
    builder.column("detail-tags-col", ["detail-tags-label", "detail-tags-list"])
    builder.card("detail-tags-card", "detail-tags-col")

    # Timestamps card
    builder.text("detail-time-label", "时间信息", usage_hint="h4")
    builder.text("detail-created-label", "创建时间")
    builder.text("detail-created-value", builder.path("/app/ticket/detail/created_at"))
    builder.row("detail-created-row", ["detail-created-label", "detail-created-value"], distribution="spaceBetween")
    builder.text("detail-updated-label", "更新时间")
    builder.text("detail-updated-value", builder.path("/app/ticket/detail/updated_at"))
    builder.row("detail-updated-row", ["detail-updated-label", "detail-updated-value"], distribution="spaceBetween")
    builder.column("detail-time-col", ["detail-time-label", "detail-created-row", "detail-updated-row"])
    builder.card("detail-time-card", "detail-time-col")

    # Attachments card
    builder.text("detail-attach-label", "附件", usage_hint="h4")
    builder.text("detail-attach-filename", builder.path("filename"))
    builder.text("detail-attach-size", builder.path("sizeFormatted"))
    builder.row("detail-attach-info", ["detail-attach-filename", "detail-attach-size"], distribution="spaceBetween")
    builder.text("detail-attach-download-text", "下载")
    builder.button(
        "detail-attach-download",
        "detail-attach-download-text",
        "download_attachment",
        [{"key": "id", "value": {"path": "id"}}],
    )
    builder.row("detail-attach-item", ["detail-attach-info", "detail-attach-download"], distribution="spaceBetween", alignment="center")
    builder.list_component(
        "detail-attach-list",
        template={"componentId": "detail-attach-item", "dataBinding": "/app/ticket/attachments"},
        direction="vertical",
    )
    builder.text("detail-attach-empty", "暂无附件")
    builder.column("detail-attach-col", ["detail-attach-label", "detail-attach-list"])
    builder.card("detail-attach-card", "detail-attach-col")

    # History card
    builder.text("detail-history-label", "变更历史", usage_hint="h4")
    builder.text("detail-history-type", builder.path("changeTypeLabel"))
    builder.text("detail-history-time", builder.path("created_at"))
    builder.text("detail-history-old", builder.path("old_value"))
    builder.text("detail-history-arrow", "→")
    builder.text("detail-history-new", builder.path("new_value"))
    builder.row("detail-history-change", ["detail-history-old", "detail-history-arrow", "detail-history-new"], alignment="center")
    builder.column("detail-history-item", ["detail-history-type", "detail-history-time", "detail-history-change"])
    builder.list_component(
        "detail-history-list",
        template={"componentId": "detail-history-item", "dataBinding": "/app/ticket/history"},
        direction="vertical",
    )
    builder.column("detail-history-col", ["detail-history-label", "detail-history-list"])
    builder.card("detail-history-card", "detail-history-col")

    # Left column (main content)
    main_cards = ["detail-desc-card"]
    if ticket.get("resolution"):
        main_cards.append("detail-resolution-card")
    main_cards.append("detail-attach-card")
    builder.column("detail-main", main_cards)

    # Right column (sidebar)
    builder.column("detail-sidebar", [
        "detail-status-card",
        "detail-priority-card",
        "detail-tags-card",
        "detail-time-card",
        "detail-history-card",
    ])

    # Layout
    builder.row("detail-body", ["detail-main", "detail-sidebar"], distribution="start")
    builder.column("detail-page", ["detail-header", "detail-body"])

    # Delete confirmation modal
    builder.text("delete-modal-title", "确认删除", usage_hint="h3")
    builder.text("delete-modal-desc", "确定要删除这个票据吗？此操作无法撤销。")
    builder.text("delete-modal-cancel-text", "取消")
    builder.button("delete-modal-cancel", "delete-modal-cancel-text", "dismiss_dialog", [])
    builder.text("delete-modal-confirm-text", "确认删除")
    builder.button(
        "delete-modal-confirm",
        "delete-modal-confirm-text",
        "delete_ticket",
        [{"key": "id", "value": {"literalString": ticket_id}}],
    )
    builder.row("delete-modal-actions", ["delete-modal-cancel", "delete-modal-confirm"], distribution="end")
    builder.column("delete-modal-content", ["delete-modal-title", "delete-modal-desc", "delete-modal-actions"])

    return "detail-page", []


def build_ticket_detail_data(ticket: dict, attachments: list, history: list) -> list[str]:
    """Build data model updates for ticket detail page."""
    messages = []
    builder = A2UIBuilder()

    # Ticket detail
    detail_data = build_value_map_from_dict({
        "id": ticket["id"],
        "title": ticket["title"],
        "description": ticket.get("description") or "无描述",
        "status": ticket["status"],
        "statusLabel": STATUS_LABELS.get(TicketStatus(ticket["status"]), ticket["status"]),
        "priority": ticket["priority"],
        "priorityLabel": PRIORITY_LABELS.get(Priority(ticket["priority"]), ticket["priority"]),
        "resolution": ticket.get("resolution") or "",
        "created_at": ticket["created_at"][:19].replace("T", " "),
        "updated_at": ticket["updated_at"][:19].replace("T", " "),
    })
    messages.append(builder.build_data_model_update("/app/ticket/detail", detail_data))

    # Tags
    tags = ticket.get("tags", [])
    tags_data = []
    for i, tag in enumerate(tags):
        tags_data.append(value_map(f"tag{i}", build_value_map_from_dict({
            "id": tag["id"],
            "name": tag["name"],
            "color": tag["color"],
        })))
    messages.append(builder.build_data_model_update("/app/ticket/tags", tags_data))

    # Attachments
    attach_data = []
    for i, att in enumerate(attachments):
        size_bytes = att["size_bytes"]
        if size_bytes < 1024:
            size_formatted = f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            size_formatted = f"{size_bytes / 1024:.1f} KB"
        else:
            size_formatted = f"{size_bytes / (1024 * 1024):.1f} MB"
        attach_data.append(value_map(f"att{i}", build_value_map_from_dict({
            "id": att["id"],
            "filename": att["filename"],
            "sizeFormatted": size_formatted,
        })))
    messages.append(builder.build_data_model_update("/app/ticket/attachments", attach_data))

    # History
    change_type_labels = {
        "status": "状态变更",
        "priority": "优先级变更",
        "resolution": "处理结果",
        "tag_added": "添加标签",
        "tag_removed": "移除标签",
    }
    history_data = []
    for i, h in enumerate(history):
        history_data.append(value_map(f"h{i}", build_value_map_from_dict({
            "changeTypeLabel": change_type_labels.get(h["change_type"], h["change_type"]),
            "old_value": h.get("old_value") or "-",
            "new_value": h.get("new_value") or "-",
            "created_at": h["created_at"][:19].replace("T", " "),
        })))
    messages.append(builder.build_data_model_update("/app/ticket/history", history_data))

    return messages


def build_ticket_create_page(builder: A2UIBuilder) -> tuple[str, list[str]]:
    """Build the ticket create page."""
    # Back button
    builder.text("create-back-text", "← 返回列表")
    builder.button(
        "create-back-btn",
        "create-back-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )

    builder.text("create-title", "新建票据", usage_hint="h1")
    builder.row("create-header", ["create-back-btn", "create-title"], alignment="center")

    # Form
    builder.text("create-title-label", "标题 *", usage_hint="h4")
    builder.text_field("create-title-input", "请输入票据标题", builder.path("/app/form/create/title"))

    builder.text("create-desc-label", "描述", usage_hint="h4")
    builder.text_field("create-desc-input", "请输入详细描述...", builder.path("/app/form/create/description"), text_field_type="multiline")

    builder.text("create-priority-label", "优先级", usage_hint="h4")
    # Priority selection buttons
    builder.text("create-priority-low-text", "低")
    builder.button("create-priority-low", "create-priority-low-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "low"}}])
    builder.text("create-priority-medium-text", "中")
    builder.button("create-priority-medium", "create-priority-medium-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "medium"}}])
    builder.text("create-priority-high-text", "高")
    builder.button("create-priority-high", "create-priority-high-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "high"}}])
    builder.text("create-priority-urgent-text", "紧急")
    builder.button("create-priority-urgent", "create-priority-urgent-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "urgent"}}])
    builder.row("create-priority-btns", ["create-priority-low", "create-priority-medium", "create-priority-high", "create-priority-urgent"], alignment="center")

    builder.column("create-form-fields", [
        "create-title-label", "create-title-input",
        "create-desc-label", "create-desc-input",
        "create-priority-label", "create-priority-btns",
    ])

    # Actions
    builder.divider("create-divider")
    builder.text("create-cancel-text", "取消")
    builder.button(
        "create-cancel-btn",
        "create-cancel-text",
        "navigate",
        [{"key": "to", "value": {"literalString": "/tickets"}}],
    )
    builder.text("create-submit-text", "创建票据")
    builder.button(
        "create-submit-btn",
        "create-submit-text",
        "create_ticket",
        [{"key": "form", "value": {"path": "/app/form/create"}}],
    )
    builder.row("create-actions", ["create-cancel-btn", "create-submit-btn"], distribution="end", alignment="center")

    builder.column("create-form", ["create-form-fields", "create-divider", "create-actions"])
    builder.card("create-form-card", "create-form")
    builder.column("create-page", ["create-header", "create-form-card"])

    return "create-page", []


def build_ticket_create_data() -> list[str]:
    """Build data model updates for ticket create page."""
    messages = []
    builder = A2UIBuilder()

    form_data = [
        value_string("title", ""),
        value_string("description", ""),
        value_string("priority", "medium"),
    ]
    messages.append(builder.build_data_model_update("/app/form/create", form_data))

    return messages


def build_ticket_edit_page(builder: A2UIBuilder, ticket: dict) -> tuple[str, list[str]]:
    """Build the ticket edit page."""
    ticket_id = ticket["id"]

    # Back button
    builder.text("edit-back-text", "← 返回详情")
    builder.button(
        "edit-back-btn",
        "edit-back-text",
        "navigate",
        [{"key": "to", "value": {"literalString": f"/tickets/{ticket_id}"}}],
    )

    builder.text("edit-title", "编辑票据", usage_hint="h1")
    builder.row("edit-header", ["edit-back-btn", "edit-title"], alignment="center")

    # Form
    builder.text("edit-title-label", "标题 *", usage_hint="h4")
    builder.text_field("edit-title-input", "请输入票据标题", builder.path("/app/form/edit/title"))

    builder.text("edit-desc-label", "描述", usage_hint="h4")
    builder.text_field("edit-desc-input", "请输入详细描述...", builder.path("/app/form/edit/description"), text_field_type="multiline")

    builder.text("edit-priority-label", "优先级", usage_hint="h4")
    builder.text("edit-priority-low-text", "低")
    builder.button("edit-priority-low", "edit-priority-low-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "low"}}])
    builder.text("edit-priority-medium-text", "中")
    builder.button("edit-priority-medium", "edit-priority-medium-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "medium"}}])
    builder.text("edit-priority-high-text", "高")
    builder.button("edit-priority-high", "edit-priority-high-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "high"}}])
    builder.text("edit-priority-urgent-text", "紧急")
    builder.button("edit-priority-urgent", "edit-priority-urgent-text", "set_form_priority", [{"key": "priority", "value": {"literalString": "urgent"}}])
    builder.row("edit-priority-btns", ["edit-priority-low", "edit-priority-medium", "edit-priority-high", "edit-priority-urgent"], alignment="center")

    builder.column("edit-form-fields", [
        "edit-title-label", "edit-title-input",
        "edit-desc-label", "edit-desc-input",
        "edit-priority-label", "edit-priority-btns",
    ])

    # Actions
    builder.divider("edit-divider")
    builder.text("edit-cancel-text", "取消")
    builder.button(
        "edit-cancel-btn",
        "edit-cancel-text",
        "navigate",
        [{"key": "to", "value": {"literalString": f"/tickets/{ticket_id}"}}],
    )
    builder.text("edit-submit-text", "保存更改")
    builder.button(
        "edit-submit-btn",
        "edit-submit-text",
        "update_ticket",
        [
            {"key": "id", "value": {"literalString": ticket_id}},
            {"key": "form", "value": {"path": "/app/form/edit"}},
        ],
    )
    builder.row("edit-actions", ["edit-cancel-btn", "edit-submit-btn"], distribution="end", alignment="center")

    builder.column("edit-form", ["edit-form-fields", "edit-divider", "edit-actions"])
    builder.card("edit-form-card", "edit-form")
    builder.column("edit-page", ["edit-header", "edit-form-card"])

    return "edit-page", []


def build_ticket_edit_data(ticket: dict) -> list[str]:
    """Build data model updates for ticket edit page."""
    messages = []
    builder = A2UIBuilder()

    form_data = [
        value_string("title", ticket["title"]),
        value_string("description", ticket.get("description") or ""),
        value_string("priority", ticket["priority"]),
    ]
    messages.append(builder.build_data_model_update("/app/form/edit", form_data))

    return messages
