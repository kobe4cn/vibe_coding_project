//! A2UI Handlers
//!
//! HTTP handlers for A2UI SSE streams and actions.

use axum::{
    Json,
    extract::{Path, Query, State},
    response::sse::Sse,
};
use futures::stream::Stream;
use serde::Deserialize;
use std::convert::Infallible;
use tracing::info;

use crate::a2ui::{
    builder::{ComponentBuilder, MessageBuilder},
    sse::{A2UISender, create_channel, sse_from_channel},
    types::*,
};
use crate::error::AppError;
use crate::handlers;
use crate::routes::AppState;

/// Helper function to convert ValueMap to serde_json::Value
fn valuemap_to_json(item: &ValueMap) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    obj.insert("id".to_string(), serde_json::json!(&item.key));

    if let Some(ref v) = item.value_string {
        obj.insert(item.key.clone(), serde_json::json!(v));
    }
    if let Some(ref v) = item.value_number {
        obj.insert(item.key.clone(), serde_json::json!(v));
    }
    if let Some(ref v) = item.value_boolean {
        obj.insert(item.key.clone(), serde_json::json!(v));
    }
    if let Some(ref contents) = item.value_map {
        for content in contents {
            if let Some(ref v) = content.value_string {
                obj.insert(content.key.clone(), serde_json::json!(v));
            }
            if let Some(ref v) = content.value_number {
                obj.insert(content.key.clone(), serde_json::json!(v));
            }
            if let Some(ref v) = content.value_boolean {
                obj.insert(content.key.clone(), serde_json::json!(v));
            }
        }
    }

    serde_json::Value::Object(obj)
}

#[derive(Debug, Deserialize)]
pub struct StreamQuery {
    #[serde(rename = "surfaceId")]
    pub surface_id: Option<String>,
    pub page: Option<i64>,
}

// ============================================================================
// Tickets List Stream
// ============================================================================

const TICKETS_PAGE_SIZE: i64 = 5;

#[derive(Debug, serde::Deserialize)]
pub struct TicketsStreamQuery {
    #[serde(rename = "surfaceId")]
    pub surface_id: Option<String>,
    pub page: Option<i64>,
    pub status: Option<String>,
    pub search: Option<String>,
}

pub async fn tickets_stream(
    State(state): State<AppState>,
    Query(query): Query<TicketsStreamQuery>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, Infallible>>>, AppError> {
    let surface_id = query.surface_id.unwrap_or_else(|| "tickets".to_string());
    let page = query.page.unwrap_or(1).max(1);
    let status = query.status.clone().unwrap_or_default();
    let search = query.search.clone().unwrap_or_default();

    // Debug logging
    info!(
        "tickets_stream: page={}, status='{}', search='{}'",
        page, status, search
    );

    let (tx, rx) = create_channel(32);

    // Spawn task to build and send UI
    let db = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = build_tickets_ui(&tx, &surface_id, &db, page, &status, &search).await {
            tracing::error!("Failed to build tickets UI: {}", e);
        }
        // Keep the connection open for future updates
        // The tx will be dropped when the client disconnects
        std::future::pending::<()>().await;
    });

    Ok(sse_from_channel(rx))
}

async fn build_tickets_ui(
    tx: &A2UISender,
    surface_id: &str,
    db: &sqlx::PgPool,
    page: i64,
    status_filter: &str,
    search_filter: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg = MessageBuilder::new(surface_id);

    // Build components
    let mut builder = ComponentBuilder::new();

    // Page header
    builder.h1("page-title", "工单管理");

    // Search row - search and status filter work together (AND)
    builder.text_field(
        "tickets-search",
        BoundValue::string("搜索工单..."),
        BoundValue::path("/app/tickets/query/search"),
    );
    builder.button(
        "search-btn",
        "search-btn-text",
        Action::new("search_tickets")
            .with_context("search", BoundValue::path("/app/tickets/query/search"))
            .with_context("status", BoundValue::path("/app/tickets/query/status")),
    );
    builder.text("search-btn-text", BoundValue::string("搜索"));

    // Create button
    builder.button(
        "create-btn",
        "create-btn-text",
        Action::new("navigate_create_ticket"),
    );
    builder.text("create-btn-text", BoundValue::string("新建工单"));

    builder.row_with_props(
        "header-row",
        Children::explicit(vec!["page-title", "create-btn"]),
        None,
        Some("spaceBetween"),
    );

    builder.row(
        "search-row",
        Children::explicit(vec!["tickets-search", "search-btn"]),
    );

    // Filter buttons - now include search context for AND query
    // Use data binding to show selected state
    let status_filters = vec![
        ("filter-all", "全部", ""),
        ("filter-open", "待处理", "open"),
        ("filter-progress", "处理中", "in_progress"),
        ("filter-completed", "已完成", "completed"),
    ];

    for (id, label, status) in &status_filters {
        builder.text(format!("{}-text", id), BoundValue::string(*label));
        builder.button_with_variant(
            *id,
            format!("{}-text", id),
            Action::new("filter_status")
                .with_context("status", BoundValue::string(*status))
                .with_context("search", BoundValue::path("/app/tickets/query/search")),
            None, // Default variant, selected state will be controlled by data-selected attribute
        );
    }

    builder.row(
        "status-filters",
        Children::explicit(
            status_filters
                .iter()
                .map(|(id, _, _)| id.to_string())
                .collect(),
        ),
    );

    // Ticket item template - enhanced with more info
    // Title row
    builder.text_with_width("ticket-item-title", BoundValue::path("title"), "auto");

    // Tags display (using color swatches in a row)
    builder.text_with_hint(
        "ticket-item-tags",
        BoundValue::path("tags_display"),
        Some("caption"),
    );

    // Status and priority badges
    builder.text_with_hint(
        "ticket-item-status",
        BoundValue::path("status_label"),
        Some("badge"),
    );
    builder.text_with_hint(
        "ticket-item-priority",
        BoundValue::path("priority_label"),
        Some("badge"),
    );

    // Time info
    builder.text_with_hint(
        "ticket-item-created",
        BoundValue::path("created_at_display"),
        Some("caption"),
    );
    builder.text_with_hint(
        "ticket-item-updated",
        BoundValue::path("updated_at_display"),
        Some("caption"),
    );

    // Process button (only shown for non-completed tickets via process_btn_text binding)
    builder.text("process-btn-text", BoundValue::path("process_btn_text"));
    builder.button_with_variant(
        "ticket-process-btn",
        "process-btn-text",
        Action::new("open_process_modal")
            .with_context("ticketId", BoundValue::path("id"))
            .with_context("currentStatus", BoundValue::path("status")),
        Some("action"), // Blue action button for visibility
    );

    // Layout structure
    builder.row(
        "ticket-item-badges",
        Children::explicit(vec!["ticket-item-status", "ticket-item-priority"]),
    );

    builder.column(
        "ticket-item-info",
        Children::explicit(vec![
            "ticket-item-title",
            "ticket-item-tags",
            "ticket-item-badges",
        ]),
    );

    builder.column(
        "ticket-item-times",
        Children::explicit(vec!["ticket-item-created", "ticket-item-updated"]),
    );

    // Main info area (clickable to navigate to detail)
    builder.button_with_variant(
        "ticket-item-main-btn",
        "ticket-item-info",
        Action::new("navigate_ticket_detail").with_context("ticketId", BoundValue::path("id")),
        Some("ghost"),
    );

    // Action buttons column (process button)
    builder.column(
        "ticket-item-actions",
        Children::explicit(vec!["ticket-item-times", "ticket-process-btn"]),
    );

    // Whole row: info on left, times + actions on right
    builder.row_with_props(
        "ticket-item-content",
        Children::explicit(vec!["ticket-item-main-btn", "ticket-item-actions"]),
        Some("center"),
        Some("spaceBetween"),
    );

    builder.card("ticket-item-card", "ticket-item-content");

    // Tickets list
    builder.list(
        "tickets-list",
        Children::template("ticket-item-card", "/app/tickets/items"),
    );

    // Pagination controls
    builder.text("prev-page-text", BoundValue::string("← 上一页"));
    builder.button(
        "prev-page-btn",
        "prev-page-text",
        Action::new("prev_page")
            .with_context(
                "currentPage",
                BoundValue::path("/app/tickets/pagination/page"),
            )
            .with_context(
                "totalPages",
                BoundValue::path("/app/tickets/pagination/totalPages"),
            )
            .with_context("search", BoundValue::path("/app/tickets/query/search"))
            .with_context("status", BoundValue::path("/app/tickets/query/status")),
    );
    builder.text(
        "page-info",
        BoundValue::path("/app/tickets/pagination/info"),
    );
    builder.text("next-page-text", BoundValue::string("下一页 →"));
    builder.button(
        "next-page-btn",
        "next-page-text",
        Action::new("next_page")
            .with_context(
                "currentPage",
                BoundValue::path("/app/tickets/pagination/page"),
            )
            .with_context(
                "totalPages",
                BoundValue::path("/app/tickets/pagination/totalPages"),
            )
            .with_context("search", BoundValue::path("/app/tickets/query/search"))
            .with_context("status", BoundValue::path("/app/tickets/query/status")),
    );

    builder.row_with_props(
        "pagination-row",
        Children::explicit(vec!["prev-page-btn", "page-info", "next-page-btn"]),
        Some("mt-6 justify-center items-center gap-4"),
        None,
    );

    // Main layout
    builder.column(
        "tickets-content",
        Children::explicit(vec![
            "header-row",
            "search-row",
            "status-filters",
            "tickets-list",
            "pagination-row",
        ]),
    );

    builder.column_with_props(
        "app-layout",
        Children::explicit(vec!["tickets-content"]),
        None,
        None,
    );

    let components = builder.build();

    // Send surface update
    tx.send(msg.surface_update(components)).await?;

    // Fetch tickets with pagination and filters
    let (items, total_count) =
        fetch_tickets_with_details(db, search_filter, status_filter, page, TICKETS_PAGE_SIZE)
            .await?;
    // Fix pagination: if total_count is 0, total_pages should be 0
    let total_pages = if total_count == 0 {
        0
    } else {
        ((total_count as f64) / (TICKETS_PAGE_SIZE as f64)).ceil() as i64
    };

    // Build filter button selected states
    // Each filter button state needs to be a nested map: filters -> {button_id} -> selected
    let mut filter_button_states = Vec::new();
    for (id, _, status) in &status_filters {
        let is_selected = status == &status_filter;
        filter_button_states.push(ValueMap::map(
            *id,
            vec![ValueMap::string(
                "selected",
                if is_selected { "true" } else { "false" },
            )],
        ));
    }

    // Send data update
    tx.send(msg.data_update(
        Some("/app/tickets".to_string()),
        vec![
            ValueMap::map("items", items),
            ValueMap::map(
                "query",
                vec![
                    ValueMap::string("search", search_filter),
                    ValueMap::string("status", status_filter),
                ],
            ),
            ValueMap::map(
                "pagination",
                vec![
                    ValueMap::string("page", page.to_string()),
                    ValueMap::string("totalPages", total_pages.to_string()),
                    ValueMap::string(
                        "info",
                        if total_pages == 0 {
                            "无数据".to_string()
                        } else {
                            format!("第 {} 页 / 共 {} 页", page, total_pages)
                        },
                    ),
                    ValueMap::string(
                        "prevEnabled",
                        if total_pages == 0 || page <= 1 {
                            "false"
                        } else {
                            "true"
                        },
                    ),
                    ValueMap::string(
                        "nextEnabled",
                        if total_pages == 0 || page >= total_pages {
                            "false"
                        } else {
                            "true"
                        },
                    ),
                ],
            ),
            ValueMap::map("filters", filter_button_states),
        ],
    ))
    .await?;

    // Begin rendering
    tx.send(msg.begin_rendering("app-layout")).await?;

    Ok(())
}

/// Fetch tickets with all details including tags
async fn fetch_tickets_with_details(
    db: &sqlx::PgPool,
    search: &str,
    status: &str,
    page: i64,
    page_size: i64,
) -> Result<(Vec<ValueMap>, i64), AppError> {
    let offset = (page - 1) * page_size;

    // Build query with filters
    let mut query = String::from(
        "SELECT t.*, COALESCE(MAX(th.created_at), t.updated_at) as last_activity FROM tickets t LEFT JOIN ticket_history th ON t.id = th.ticket_id WHERE 1=1",
    );
    let mut count_query = String::from("SELECT COUNT(*) FROM tickets WHERE 1=1");
    let mut params: Vec<String> = Vec::new();

    if !search.is_empty() {
        params.push(format!("%{}%", search));
        let param_idx = params.len();
        query.push_str(&format!(" AND t.title ILIKE ${}", param_idx));
        count_query.push_str(&format!(" AND title ILIKE ${}", param_idx));
    }

    if !status.is_empty() {
        params.push(status.to_string());
        let param_idx = params.len();
        query.push_str(&format!(" AND t.status = ${}", param_idx));
        count_query.push_str(&format!(" AND status = ${}", param_idx));
    }

    query.push_str(" GROUP BY t.id ORDER BY t.created_at DESC");
    query.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));

    // Get total count
    let mut count_q = sqlx::query_scalar::<_, i64>(&count_query);
    for param in &params {
        count_q = count_q.bind(param);
    }
    let total_count = count_q.fetch_one(db).await.unwrap_or(0);

    // Custom struct for the query result
    #[derive(sqlx::FromRow)]
    #[allow(dead_code)]
    struct TicketWithActivity {
        id: uuid::Uuid,
        title: String,
        description: Option<String>,
        priority: String,
        status: String,
        resolution: Option<String>,
        completed_at: Option<chrono::DateTime<chrono::Utc>>,
        created_at: chrono::DateTime<chrono::Utc>,
        updated_at: chrono::DateTime<chrono::Utc>,
        last_activity: chrono::DateTime<chrono::Utc>,
    }

    let mut q = sqlx::query_as::<_, TicketWithActivity>(&query);
    for param in &params {
        q = q.bind(param);
    }
    let tickets = q.fetch_all(db).await?;

    // Build items with additional data
    let mut items = Vec::new();
    for ticket in tickets {
        // Get tags for this ticket
        let tags: Vec<(String, String)> = sqlx::query_as(
            "SELECT t.name, t.color FROM tags t JOIN ticket_tags tt ON t.id = tt.tag_id WHERE tt.ticket_id = $1"
        )
            .bind(ticket.id)
            .fetch_all(db)
            .await
            .unwrap_or_default();

        let tags_display = if tags.is_empty() {
            "无标签".to_string()
        } else {
            tags.iter()
                .map(|(name, _)| name.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        };

        let status_label = ticket
            .status
            .parse::<crate::models::ticket::TicketStatus>()
            .map(|s| s.label())
            .unwrap_or(&ticket.status);
        let priority_label = ticket
            .priority
            .parse::<crate::models::ticket::Priority>()
            .map(|p| p.label())
            .unwrap_or(&ticket.priority);

        // Format times
        let created_at_display = format!("创建: {}", ticket.created_at.format("%Y-%m-%d %H:%M"));
        let updated_at_display = format!("更新: {}", ticket.last_activity.format("%Y-%m-%d %H:%M"));

        items.push(ValueMap::map(
            ticket.id.to_string(),
            vec![
                ValueMap::string("id", ticket.id.to_string()),
                ValueMap::string("title", &ticket.title),
                ValueMap::string("status", &ticket.status),
                ValueMap::string("status_label", status_label),
                ValueMap::string("priority", &ticket.priority),
                ValueMap::string("priority_label", priority_label),
                ValueMap::string("tags_display", &tags_display),
                ValueMap::string("created_at_display", &created_at_display),
                ValueMap::string("updated_at_display", &updated_at_display),
                // Only show process button for non-completed tickets
                ValueMap::string(
                    "process_btn_text",
                    if ticket.status == "completed" {
                        ""
                    } else {
                        "处理"
                    },
                ),
            ],
        ));
    }

    Ok((items, total_count))
}

// ============================================================================
// Tickets Action Handler
// ============================================================================

pub async fn tickets_action(
    State(state): State<AppState>,
    Json(action): Json<UserAction>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!(
        "Received action: {} from {}",
        action.name, action.source_component_id
    );

    match action.name.as_str() {
        "search_tickets" | "filter_status" => {
            // For search and filter actions, we only acknowledge the action.
            // The actual data will be fetched through SSE stream when URL changes.
            // This avoids race conditions between action response and SSE data.
            Ok(Json(serde_json::json!({
                "success": true
            })))
        }
        "prev_page" | "next_page" => {
            // Pagination actions are handled through URL changes triggering SSE stream.
            // Just acknowledge the action here.
            Ok(Json(serde_json::json!({
                "success": true
            })))
        }
        "process_ticket" => {
            // Handle ticket processing - update status and add progress description
            let ticket_id = action
                .context
                .get("ticketId")
                .and_then(|v| v.as_str())
                .and_then(|s| uuid::Uuid::parse_str(s).ok());
            let new_status = action
                .context
                .get("newStatus")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let progress_note = action
                .context
                .get("progressNote")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let Some(ticket_id) = ticket_id else {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "缺少工单 ID"
                })));
            };

            if new_status.is_empty() {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "请选择新状态"
                })));
            }

            // Get current ticket status
            let current: Option<String> =
                sqlx::query_scalar("SELECT status FROM tickets WHERE id = $1")
                    .bind(ticket_id)
                    .fetch_optional(&state.db)
                    .await?;

            let Some(current_status) = current else {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "工单不存在"
                })));
            };

            // Validate status transition
            let current_status_enum =
                current_status.parse::<crate::models::ticket::TicketStatus>()?;
            let new_status_enum = new_status.parse::<crate::models::ticket::TicketStatus>()?;

            if !current_status_enum.can_transition_to(&new_status_enum) {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": format!("无法从 {} 转换到 {}", current_status_enum.label(), new_status_enum.label())
                })));
            }

            // Update ticket status
            let completed_at = if new_status_enum == crate::models::ticket::TicketStatus::Completed
            {
                Some(chrono::Utc::now())
            } else {
                None
            };

            sqlx::query(
                "UPDATE tickets SET status = $1, completed_at = $2, updated_at = NOW() WHERE id = $3"
            )
                .bind(new_status)
                .bind(completed_at)
                .bind(ticket_id)
                .execute(&state.db)
                .await?;

            // Add history record
            sqlx::query(
                "INSERT INTO ticket_history (ticket_id, change_type, field_name, old_value, new_value) VALUES ($1, 'status', 'status', $2, $3)"
            )
                .bind(ticket_id)
                .bind(&current_status)
                .bind(new_status)
                .execute(&state.db)
                .await?;

            // Add progress note if provided
            if !progress_note.is_empty() {
                sqlx::query(
                    "INSERT INTO ticket_history (ticket_id, change_type, field_name, old_value, new_value) VALUES ($1, 'resolution', 'progress_note', NULL, $2)"
                )
                    .bind(ticket_id)
                    .bind(progress_note)
                    .execute(&state.db)
                    .await?;
            }

            info!(
                "Processed ticket {}: {} -> {}",
                ticket_id, current_status, new_status
            );

            // Return updated ticket list
            let (items, total_count) =
                fetch_tickets_with_details(&state.db, "", "", 1, TICKETS_PAGE_SIZE).await?;
            let total_pages = if total_count == 0 {
                0
            } else {
                ((total_count as f64) / (TICKETS_PAGE_SIZE as f64)).ceil() as i64
            };

            let items_json: Vec<serde_json::Value> = items.iter().map(valuemap_to_json).collect();

            Ok(Json(serde_json::json!({
                "success": true,
                "closeModal": true,
                "dataUpdate": {
                    "path": "/app/tickets/items",
                    "items": items_json
                },
                "paginationUpdate": {
                    "page": 1,
                    "totalPages": total_pages,
                    "info": if total_pages == 0 { "无数据".to_string() } else { format!("第 1 页 / 共 {} 页", total_pages) },
                    "prevEnabled": if total_pages == 0 || 1 >= total_pages { "false" } else { "true" },
                    "nextEnabled": if total_pages == 0 || 1 <= total_pages { "false" } else { "true" }
                }
            })))
        }
        _ => Ok(Json(serde_json::json!({
            "success": true,
            "message": format!("Action {} received", action.name)
        }))),
    }
}

// ============================================================================
// Ticket Edit Form Stream
// ============================================================================

pub async fn ticket_edit_stream(
    State(state): State<AppState>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, Infallible>>>, AppError> {
    let surface_id = format!("ticket-edit-form-{}", id);

    let (tx, rx) = create_channel(32);

    let db = state.db.clone();
    tokio::spawn(async move {
        if let Err(e) = build_ticket_edit_ui(&tx, &surface_id, id, &db).await {
            tracing::error!("Failed to build ticket edit UI: {}", e);
        }
        // Keep the connection open for future updates
        std::future::pending::<()>().await;
    });

    Ok(sse_from_channel(rx))
}

async fn build_ticket_edit_ui(
    tx: &A2UISender,
    surface_id: &str,
    ticket_id: uuid::Uuid,
    db: &sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg = MessageBuilder::new(surface_id);

    // Fetch ticket
    let ticket =
        sqlx::query_as::<_, crate::models::ticket::Ticket>("SELECT * FROM tickets WHERE id = $1")
            .bind(ticket_id)
            .fetch_optional(db)
            .await?;

    let ticket = match ticket {
        Some(t) => t,
        None => {
            // Send empty UI for not found
            tx.send(msg.begin_rendering("not-found")).await?;
            return Ok(());
        }
    };

    // Build form components
    let mut builder = ComponentBuilder::new();

    // Title field
    builder.label("title-label", "标题");
    builder.text_field(
        "title-field",
        BoundValue::string("请输入标题"),
        BoundValue::path("/app/form/edit/title"),
    );
    builder.column(
        "title-group",
        Children::explicit(vec!["title-label", "title-field"]),
    );

    // Description field
    builder.label("desc-label", "描述");
    builder.textarea(
        "desc-field",
        BoundValue::string("请输入描述（可选）"),
        BoundValue::path("/app/form/edit/description"),
    );
    builder.column(
        "desc-group",
        Children::explicit(vec!["desc-label", "desc-field"]),
    );

    // Priority selector
    builder.label("priority-label", "优先级");

    let priorities = vec![
        ("low", "低"),
        ("medium", "中"),
        ("high", "高"),
        ("urgent", "紧急"),
    ];

    for (value, label) in &priorities {
        let btn_id = format!("edit-priority-{}", value);
        let text_id = format!("edit-priority-{}-text", value);
        builder.text(&text_id, BoundValue::string(*label));
        builder.button_with_variant(
            &btn_id,
            &text_id,
            Action::new("select_priority").with_context("priority", BoundValue::string(*value)),
            Some("secondary"),
        );
    }

    builder.row(
        "priority-buttons",
        Children::explicit(
            priorities
                .iter()
                .map(|(v, _)| format!("edit-priority-{}", v))
                .collect(),
        ),
    );

    builder.column(
        "priority-group",
        Children::explicit(vec!["priority-label", "priority-buttons"]),
    );

    // Form layout
    builder.column(
        "edit-form",
        Children::explicit(vec!["title-group", "desc-group", "priority-group"]),
    );

    let components = builder.build();

    // Send surface update
    tx.send(msg.surface_update(components)).await?;

    // Send initial form data
    tx.send(msg.data_update(
        Some("/app/form/edit".to_string()),
        vec![
            ValueMap::string("title", &ticket.title),
            ValueMap::string("description", ticket.description.as_deref().unwrap_or("")),
            ValueMap::string("priority", ticket.priority.as_str()),
        ],
    ))
    .await?;

    // Begin rendering
    tx.send(msg.begin_rendering("edit-form")).await?;

    Ok(())
}

pub async fn ticket_edit_action(
    State(_state): State<AppState>,
    Path(_id): Path<uuid::Uuid>,
    Json(action): Json<UserAction>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Received edit action: {}", action.name);

    Ok(Json(serde_json::json!({ "success": true })))
}

// ============================================================================
// Tags Stream
// ============================================================================

pub async fn tags_stream(
    State(state): State<AppState>,
    Query(query): Query<StreamQuery>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, Infallible>>>, AppError> {
    let surface_id = query.surface_id.unwrap_or_else(|| "tags".to_string());
    let page = query.page.unwrap_or(1);
    let (tx, rx) = create_channel(32);
    let db = state.db.clone();

    tokio::spawn(async move {
        if let Err(e) = build_tags_ui_with_page(&tx, &surface_id, &db, page).await {
            tracing::error!("Failed to build tags UI: {}", e);
        }
        std::future::pending::<()>().await;
    });

    Ok(sse_from_channel(rx))
}

const TAGS_PAGE_SIZE: i64 = 10;

#[allow(dead_code)]
async fn build_tags_ui(
    tx: &A2UISender,
    surface_id: &str,
    db: &sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    build_tags_ui_with_page(tx, surface_id, db, 1).await
}

async fn build_tags_ui_with_page(
    tx: &A2UISender,
    surface_id: &str,
    db: &sqlx::PgPool,
    page: i64,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg = MessageBuilder::new(surface_id);
    let mut builder = ComponentBuilder::new();

    // Get total count for pagination
    let total_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM tags")
        .fetch_one(db)
        .await?;
    let total_pages = (total_count.0 + TAGS_PAGE_SIZE - 1) / TAGS_PAGE_SIZE;
    let current_page = page.max(1).min(total_pages.max(1));

    // Page header
    builder.h1("page-title", "标签管理");

    // Create button
    builder.text("create-tag-text", BoundValue::string("新建标签"));
    builder.button(
        "create-tag-btn",
        "create-tag-text",
        Action::new("open_create_form"),
    );

    builder.row_with_props(
        "header-row",
        Children::explicit(vec!["page-title", "create-tag-btn"]),
        None,
        Some("spaceBetween"),
    );

    // Tag item template - use fixed widths for alignment
    builder.text_with_width("tag-name", BoundValue::path("name"), "200px");
    builder.color_swatch_with_width("tag-color", BoundValue::path("color"), Some("60px"));

    builder.text("edit-btn-text", BoundValue::string("编辑"));
    builder.button_with_variant(
        "tag-edit-btn",
        "edit-btn-text",
        Action::new("edit_tag").with_context("tagId", BoundValue::path("id")),
        Some("secondary"),
    );

    builder.text("delete-btn-text", BoundValue::string("删除"));
    builder.button_with_variant(
        "tag-delete-btn",
        "delete-btn-text",
        Action::new("delete_tag").with_context("tagId", BoundValue::path("id")),
        Some("ghost"),
    );

    builder.row(
        "tag-actions",
        Children::explicit(vec!["tag-edit-btn", "tag-delete-btn"]),
    );
    builder.row_with_props(
        "tag-item-content",
        Children::explicit(vec!["tag-name", "tag-color", "tag-actions"]),
        None,
        Some("spaceBetween"),
    );
    builder.card("tag-item-card", "tag-item-content");

    // Tags list
    builder.list(
        "tags-list",
        Children::template("tag-item-card", "/app/tags/items"),
    );

    // Pagination controls
    let mut pagination_children = vec![];

    // Previous button
    builder.text("prev-btn-text", BoundValue::string("← 上一页"));
    if current_page > 1 {
        builder.button_with_variant(
            "prev-btn",
            "prev-btn-text",
            Action::new("prev_page"),
            Some("secondary"),
        );
    } else {
        builder.button_with_variant(
            "prev-btn",
            "prev-btn-text",
            Action::new("noop"),
            Some("ghost"),
        );
    }
    pagination_children.push("prev-btn");

    // Page info
    builder.text("page-info", BoundValue::path("/app/tags/pagination/info"));
    pagination_children.push("page-info");

    // Next button
    builder.text("next-btn-text", BoundValue::string("下一页 →"));
    if current_page < total_pages {
        builder.button_with_variant(
            "next-btn",
            "next-btn-text",
            Action::new("next_page"),
            Some("secondary"),
        );
    } else {
        builder.button_with_variant(
            "next-btn",
            "next-btn-text",
            Action::new("noop"),
            Some("ghost"),
        );
    }
    pagination_children.push("next-btn");

    builder.row_with_props(
        "pagination-row",
        Children::explicit(pagination_children),
        None,
        Some("center"),
    );

    // Main layout with pagination
    builder.column(
        "tags-content",
        Children::explicit(vec!["header-row", "tags-list", "pagination-row"]),
    );

    let components = builder.build();
    tx.send(msg.surface_update(components)).await?;

    // Fetch tags with pagination
    let offset = (current_page - 1) * TAGS_PAGE_SIZE;
    let tags: Vec<crate::models::Tag> =
        sqlx::query_as("SELECT * FROM tags ORDER BY created_at DESC LIMIT $1 OFFSET $2")
            .bind(TAGS_PAGE_SIZE)
            .bind(offset)
            .fetch_all(db)
            .await?;

    let mut items = Vec::new();
    for tag in tags {
        items.push(ValueMap::map(
            tag.id.to_string(),
            vec![
                ValueMap::string("id", tag.id.to_string()),
                ValueMap::string("name", &tag.name),
                ValueMap::string("color", &tag.color),
            ],
        ));
    }

    // Send data update with items and pagination info
    tx.send(msg.data_update(
        Some("/app/tags".to_string()),
        vec![
            ValueMap::map("items", items),
            ValueMap::map(
                "pagination",
                vec![
                    ValueMap::string(
                        "info",
                        format!("第 {} 页 / 共 {} 页", current_page, total_pages.max(1)),
                    ),
                    ValueMap::string("page", current_page.to_string()),
                    ValueMap::string("totalPages", total_pages.to_string()),
                ],
            ),
        ],
    ))
    .await?;

    tx.send(msg.begin_rendering("tags-content")).await?;
    Ok(())
}

pub async fn tags_action(
    State(state): State<AppState>,
    Json(action): Json<UserAction>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!(
        "Received tags action: {} from {}",
        action.name, action.source_component_id
    );

    match action.name.as_str() {
        "open_create_form" => {
            // This is handled on frontend
            Ok(Json(serde_json::json!({ "success": true })))
        }
        "edit_tag" => {
            // This is handled on frontend
            Ok(Json(serde_json::json!({ "success": true })))
        }
        "delete_tag" => {
            let tag_id = action
                .context
                .get("tagId")
                .and_then(|v| v.as_str())
                .and_then(|s| uuid::Uuid::parse_str(s).ok());

            if let Some(id) = tag_id {
                sqlx::query("DELETE FROM tags WHERE id = $1")
                    .bind(id)
                    .execute(&state.db)
                    .await?;

                info!("Deleted tag: {}", id);

                // Return updated tags list
                let items = fetch_all_tags(&state.db).await?;
                Ok(Json(serde_json::json!({
                    "success": true,
                    "dataUpdate": {
                        "path": "/app/tags/items",
                        "items": items
                    }
                })))
            } else {
                Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "Invalid tag ID"
                })))
            }
        }
        "submit_tag" => {
            // Create or update tag
            let name = action
                .context
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let color = action
                .context
                .get("color")
                .and_then(|v| v.as_str())
                .unwrap_or("#3B82F6")
                .to_string();
            let editing_id = action
                .context
                .get("editingId")
                .and_then(|v| v.as_str())
                .and_then(|s| uuid::Uuid::parse_str(s).ok());

            if name.is_empty() {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "标签名称不能为空"
                })));
            }

            if let Some(id) = editing_id {
                // Update existing tag
                sqlx::query("UPDATE tags SET name = $1, color = $2 WHERE id = $3")
                    .bind(&name)
                    .bind(&color)
                    .bind(id)
                    .execute(&state.db)
                    .await?;
                info!("Updated tag: {} - {}", id, name);
            } else {
                // Create new tag
                let tag_id = uuid::Uuid::new_v4();
                sqlx::query("INSERT INTO tags (id, name, color, is_predefined, created_at) VALUES ($1, $2, $3, false, NOW())")
                    .bind(tag_id)
                    .bind(&name)
                    .bind(&color)
                    .execute(&state.db)
                    .await?;
                info!("Created tag: {} - {}", tag_id, name);
            }

            // Return updated tags list
            let items = fetch_all_tags(&state.db).await?;
            Ok(Json(serde_json::json!({
                "success": true,
                "closeForm": true,
                "dataUpdate": {
                    "path": "/app/tags/items",
                    "items": items
                }
            })))
        }
        "prev_page" | "next_page" | "noop" => {
            // Pagination is handled by frontend - just acknowledge
            Ok(Json(serde_json::json!({ "success": true })))
        }
        _ => Ok(Json(serde_json::json!({ "success": true }))),
    }
}

async fn fetch_all_tags(db: &sqlx::PgPool) -> Result<Vec<serde_json::Value>, AppError> {
    let tags: Vec<crate::models::Tag> =
        sqlx::query_as("SELECT * FROM tags ORDER BY created_at DESC")
            .fetch_all(db)
            .await?;

    let items: Vec<serde_json::Value> = tags
        .iter()
        .map(|tag| {
            serde_json::json!({
                "id": tag.id.to_string(),
                "name": tag.name,
                "color": tag.color
            })
        })
        .collect();

    Ok(items)
}

// ============================================================================
// Ticket Detail Stream
// ============================================================================

pub async fn ticket_detail_stream(
    State(state): State<AppState>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, Infallible>>>, AppError> {
    let surface_id = format!("ticket-detail-{}", id);
    let (tx, rx) = create_channel(32);
    let db = state.db.clone();

    tokio::spawn(async move {
        if let Err(e) = build_ticket_detail_ui(&tx, &surface_id, id, &db).await {
            tracing::error!("Failed to build ticket detail UI: {}", e);
        }
        std::future::pending::<()>().await;
    });

    Ok(sse_from_channel(rx))
}

async fn build_ticket_detail_ui(
    tx: &A2UISender,
    surface_id: &str,
    ticket_id: uuid::Uuid,
    db: &sqlx::PgPool,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg = MessageBuilder::new(surface_id);

    // Fetch ticket
    let ticket =
        sqlx::query_as::<_, crate::models::ticket::Ticket>("SELECT * FROM tickets WHERE id = $1")
            .bind(ticket_id)
            .fetch_optional(db)
            .await?;

    let ticket = match ticket {
        Some(t) => t,
        None => {
            let mut builder = ComponentBuilder::new();
            builder.h1("not-found", "工单不存在");
            let components = builder.build();
            tx.send(msg.surface_update(components)).await?;
            tx.send(msg.begin_rendering("not-found")).await?;
            return Ok(());
        }
    };

    let mut builder = ComponentBuilder::new();

    // Back button and title
    builder.text("back-text", BoundValue::string("← 返回"));
    builder.button_with_variant(
        "back-btn",
        "back-text",
        Action::new("navigate_back"),
        Some("ghost"),
    );

    builder.text_with_hint(
        "detail-title",
        BoundValue::path("/app/ticket/title"),
        Some("h1"),
    );
    builder.row(
        "header-row",
        Children::explicit(vec!["back-btn", "detail-title"]),
    );

    // Status and priority badges
    builder.text_with_hint(
        "status-badge",
        BoundValue::path("/app/ticket/status_label"),
        Some("badge"),
    );
    builder.text_with_hint(
        "priority-badge",
        BoundValue::path("/app/ticket/priority_label"),
        Some("badge"),
    );
    builder.row(
        "meta-row",
        Children::explicit(vec!["status-badge", "priority-badge"]),
    );

    // Description
    builder.label("desc-label", "描述");
    builder.text("desc-text", BoundValue::path("/app/ticket/description"));
    builder.column(
        "desc-section",
        Children::explicit(vec!["desc-label", "desc-text"]),
    );

    // Action buttons
    builder.text("edit-text", BoundValue::string("编辑"));
    builder.button("edit-btn", "edit-text", Action::new("navigate_edit"));

    builder.text("delete-text", BoundValue::string("删除"));
    builder.button_with_variant(
        "delete-btn",
        "delete-text",
        Action::new("delete_ticket"),
        Some("ghost"),
    );

    builder.row(
        "action-buttons",
        Children::explicit(vec!["edit-btn", "delete-btn"]),
    );

    // Card content
    builder.column(
        "card-content",
        Children::explicit(vec![
            "meta-row".to_string(),
            "desc-section".to_string(),
            "action-buttons".to_string(),
        ]),
    );
    builder.card("detail-card", "card-content");

    // Main layout
    builder.column(
        "detail-layout",
        Children::explicit(vec!["header-row", "detail-card"]),
    );

    let components = builder.build();
    tx.send(msg.surface_update(components)).await?;

    // Send data
    let status_label = ticket
        .status
        .parse::<crate::models::ticket::TicketStatus>()
        .map(|s| s.label())
        .unwrap_or(&ticket.status);
    let priority_label = ticket
        .priority
        .parse::<crate::models::ticket::Priority>()
        .map(|p| p.label())
        .unwrap_or(&ticket.priority);

    tx.send(msg.data_update(
        Some("/app/ticket".to_string()),
        vec![
            ValueMap::string("id", ticket.id.to_string()),
            ValueMap::string("title", &ticket.title),
            ValueMap::string(
                "description",
                ticket.description.as_deref().unwrap_or("暂无描述"),
            ),
            ValueMap::string("status", &ticket.status),
            ValueMap::string("status_label", status_label),
            ValueMap::string("priority", &ticket.priority),
            ValueMap::string("priority_label", priority_label),
        ],
    ))
    .await?;

    tx.send(msg.begin_rendering("detail-layout")).await?;
    Ok(())
}

pub async fn ticket_detail_action(
    State(_state): State<AppState>,
    Path(id): Path<uuid::Uuid>,
    Json(action): Json<UserAction>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!(
        "Received ticket detail action: {} for ticket {}",
        action.name, id
    );

    match action.name.as_str() {
        "navigate_back" | "navigate_edit" | "delete_ticket" => {
            Ok(Json(serde_json::json!({ "success": true })))
        }
        _ => Ok(Json(serde_json::json!({ "success": true }))),
    }
}

// ============================================================================
// Ticket Create Stream
// ============================================================================

pub async fn ticket_create_stream(
    State(_state): State<AppState>,
    Query(query): Query<StreamQuery>,
) -> Result<Sse<impl Stream<Item = Result<axum::response::sse::Event, Infallible>>>, AppError> {
    let surface_id = query
        .surface_id
        .unwrap_or_else(|| "ticket-create".to_string());
    let (tx, rx) = create_channel(32);

    tokio::spawn(async move {
        if let Err(e) = build_ticket_create_ui(&tx, &surface_id).await {
            tracing::error!("Failed to build ticket create UI: {}", e);
        }
        std::future::pending::<()>().await;
    });

    Ok(sse_from_channel(rx))
}

async fn build_ticket_create_ui(
    tx: &A2UISender,
    surface_id: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg = MessageBuilder::new(surface_id);
    let mut builder = ComponentBuilder::new();

    // Back button and title
    builder.text("back-text", BoundValue::string("← 返回"));
    builder.button_with_variant(
        "back-btn",
        "back-text",
        Action::new("navigate_back"),
        Some("ghost"),
    );
    builder.h1("create-title", "新建工单");
    builder.row(
        "header-row",
        Children::explicit(vec!["back-btn", "create-title"]),
    );

    // Title field
    builder.label("title-label", "标题 *");
    builder.text_field(
        "title-field",
        BoundValue::string("请输入工单标题"),
        BoundValue::path("/app/form/create/title"),
    );
    builder.column(
        "title-group",
        Children::explicit(vec!["title-label", "title-field"]),
    );

    // Description field
    builder.label("desc-label", "描述");
    builder.textarea(
        "desc-field",
        BoundValue::string("请输入详细描述（可选）"),
        BoundValue::path("/app/form/create/description"),
    );
    builder.column(
        "desc-group",
        Children::explicit(vec!["desc-label", "desc-field"]),
    );

    // Priority selection
    builder.label("priority-label", "优先级");
    let priorities = vec![
        ("low", "低"),
        ("medium", "中"),
        ("high", "高"),
        ("urgent", "紧急"),
    ];
    for (value, label) in &priorities {
        let btn_id = format!("priority-{}", value);
        let text_id = format!("priority-{}-text", value);
        builder.text(&text_id, BoundValue::string(*label));
        builder.button_with_variant(
            &btn_id,
            &text_id,
            Action::new("select_priority").with_context("priority", BoundValue::string(*value)),
            Some("secondary"),
        );
    }
    builder.row(
        "priority-buttons",
        Children::explicit(
            priorities
                .iter()
                .map(|(v, _)| format!("priority-{}", v))
                .collect(),
        ),
    );
    builder.column(
        "priority-group",
        Children::explicit(vec!["priority-label", "priority-buttons"]),
    );

    // Form content (without action buttons - those are rendered by React along with TagSelector)
    builder.column(
        "form-fields",
        Children::explicit(vec!["title-group", "desc-group", "priority-group"]),
    );

    builder.card("form-card", "form-fields");

    // Main layout
    builder.column(
        "create-layout",
        Children::explicit(vec!["header-row", "form-card"]),
    );

    let components = builder.build();
    tx.send(msg.surface_update(components)).await?;

    // Send initial form data
    tx.send(msg.data_update(
        Some("/app/form/create".to_string()),
        vec![
            ValueMap::string("title", ""),
            ValueMap::string("description", ""),
            ValueMap::string("priority", "medium"),
        ],
    ))
    .await?;

    tx.send(msg.begin_rendering("create-layout")).await?;
    Ok(())
}

pub async fn ticket_create_action(
    State(state): State<AppState>,
    Json(action): Json<UserAction>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Received ticket create action: {}", action.name);

    match action.name.as_str() {
        "submit_create" => {
            // Get form data from context
            let title = action
                .context
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let description = action
                .context
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty());
            let priority = action
                .context
                .get("priority")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Get tag_ids from context
            let tag_ids = action
                .context
                .get("tag_ids")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .filter_map(|s| uuid::Uuid::parse_str(s).ok())
                        .collect::<Vec<_>>()
                })
                .filter(|ids| !ids.is_empty());

            if title.is_empty() {
                return Ok(Json(serde_json::json!({
                    "success": false,
                    "error": "标题不能为空"
                })));
            }

            // Use create_ticket handler
            use crate::models::ticket::CreateTicketRequest;
            let req = CreateTicketRequest {
                title,
                description,
                priority,
                tag_ids,
            };

            let ticket = handlers::tickets::create_ticket(&state.db, req).await?;

            info!(
                "Created ticket: {} - {}",
                ticket.ticket.id, ticket.ticket.title
            );

            Ok(Json(serde_json::json!({
                "success": true,
                "ticketId": ticket.ticket.id.to_string()
            })))
        }
        "select_priority" => {
            // Update priority in data model
            let priority = action
                .context
                .get("priority")
                .and_then(|v| v.as_str())
                .unwrap_or("medium")
                .to_string();

            // Return dataUpdate in format expected by frontend
            Ok(Json(serde_json::json!({
                "success": true,
                "dataUpdate": {
                    "path": "/app/form/create",
                    "items": [
                        {"id": "priority", "value": priority}
                    ]
                }
            })))
        }
        "cancel_create" | "navigate_back" => Ok(Json(serde_json::json!({ "success": true }))),
        _ => Ok(Json(serde_json::json!({ "success": true }))),
    }
}
