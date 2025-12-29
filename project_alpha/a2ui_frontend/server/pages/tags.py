"""Tag page builders."""
from a2ui_builder import A2UIBuilder, value_string, value_map, build_value_map_from_dict


def build_tags_page(builder: A2UIBuilder) -> tuple[str, list[str]]:
    """Build the tags management page."""
    # Page header
    builder.text("tags-title", "标签管理", usage_hint="h1")
    builder.text("tags-add-text", "+ 新建标签")
    builder.button("tags-add-btn", "tags-add-text", "show_create_tag_form", [])
    builder.row("tags-header", ["tags-title", "tags-add-btn"], distribution="spaceBetween", alignment="center")

    # Create form
    builder.text("tag-form-title", "新建标签", usage_hint="h3")
    builder.text("tag-form-name-label", "标签名称", usage_hint="h4")
    builder.text_field("tag-form-name-input", "请输入标签名称", builder.path("/app/tags/form/name"))
    builder.text("tag-form-color-label", "颜色", usage_hint="h4")
    # Color selection buttons
    builder.text("tag-color-blue-text", "● 蓝色")
    builder.button("tag-color-blue", "tag-color-blue-text", "set_tag_color", [{"key": "color", "value": {"literalString": "#3B82F6"}}])
    builder.text("tag-color-green-text", "● 绿色")
    builder.button("tag-color-green", "tag-color-green-text", "set_tag_color", [{"key": "color", "value": {"literalString": "#10B981"}}])
    builder.text("tag-color-yellow-text", "● 黄色")
    builder.button("tag-color-yellow", "tag-color-yellow-text", "set_tag_color", [{"key": "color", "value": {"literalString": "#F59E0B"}}])
    builder.text("tag-color-red-text", "● 红色")
    builder.button("tag-color-red", "tag-color-red-text", "set_tag_color", [{"key": "color", "value": {"literalString": "#EF4444"}}])
    builder.text("tag-color-purple-text", "● 紫色")
    builder.button("tag-color-purple", "tag-color-purple-text", "set_tag_color", [{"key": "color", "value": {"literalString": "#8B5CF6"}}])
    builder.row("tag-color-btns", ["tag-color-blue", "tag-color-green", "tag-color-yellow", "tag-color-red", "tag-color-purple"], alignment="center")

    builder.column("tag-form-fields", [
        "tag-form-name-label", "tag-form-name-input",
        "tag-form-color-label", "tag-color-btns",
    ])

    builder.text("tag-form-cancel-text", "取消")
    builder.button("tag-form-cancel", "tag-form-cancel-text", "hide_create_tag_form", [])
    builder.text("tag-form-submit-text", "创建标签")
    builder.button(
        "tag-form-submit",
        "tag-form-submit-text",
        "create_tag",
        [{"key": "form", "value": {"path": "/app/tags/form"}}],
    )
    builder.row("tag-form-actions", ["tag-form-cancel", "tag-form-submit"], distribution="end")
    builder.column("tag-form-content", ["tag-form-title", "tag-form-fields", "tag-form-actions"])
    builder.card("tag-form-card", "tag-form-content")

    # Predefined tags section
    builder.text("tags-predefined-label", "预定义标签", usage_hint="h4")
    builder.text("predefined-tag-name", builder.path("name"))
    builder.list_component(
        "tags-predefined-list",
        template={"componentId": "predefined-tag-name", "dataBinding": "/app/tags/predefined"},
        direction="horizontal",
    )
    builder.column("tags-predefined-section", ["tags-predefined-label", "tags-predefined-list"])
    builder.card("tags-predefined-card", "tags-predefined-section")

    # Custom tags section
    builder.text("tags-custom-label", "自定义标签", usage_hint="h4")

    # Custom tag item template - simplified without icon
    builder.text("custom-tag-name", builder.path("name"))
    builder.text("custom-tag-delete-text", "删除")
    builder.button(
        "custom-tag-delete",
        "custom-tag-delete-text",
        "delete_tag",
        [{"key": "id", "value": {"path": "id"}}],
    )
    builder.row("custom-tag-item", ["custom-tag-name", "custom-tag-delete"], distribution="spaceBetween", alignment="center")

    builder.list_component(
        "tags-custom-list",
        template={"componentId": "custom-tag-item", "dataBinding": "/app/tags/custom"},
        direction="vertical",
    )

    # Empty state
    builder.text("tags-custom-empty", "暂无自定义标签")

    builder.column("tags-custom-section", ["tags-custom-label", "tags-custom-list"])
    builder.card("tags-custom-card", "tags-custom-section")

    # Page layout
    builder.column("tags-page", ["tags-header", "tag-form-card", "tags-predefined-card", "tags-custom-card"])

    return "tags-page", []


def build_tags_data(tags: list) -> list[str]:
    """Build data model updates for tags page."""
    messages = []
    builder = A2UIBuilder()

    # Form data
    form_data = [
        value_string("name", ""),
        value_string("color", "#3B82F6"),
    ]
    messages.append(builder.build_data_model_update("/app/tags/form", form_data))

    # Predefined tags
    predefined = [t for t in tags if t.get("is_predefined")]
    predefined_data = []
    for i, tag in enumerate(predefined):
        predefined_data.append(value_map(f"tag{i}", build_value_map_from_dict({
            "id": tag["id"],
            "name": tag["name"],
            "color": tag["color"],
        })))
    messages.append(builder.build_data_model_update("/app/tags/predefined", predefined_data))

    # Custom tags
    custom = [t for t in tags if not t.get("is_predefined")]
    custom_data = []
    for i, tag in enumerate(custom):
        custom_data.append(value_map(f"tag{i}", build_value_map_from_dict({
            "id": tag["id"],
            "name": tag["name"],
            "color": tag["color"],
        })))
    messages.append(builder.build_data_model_update("/app/tags/custom", custom_data))

    return messages
