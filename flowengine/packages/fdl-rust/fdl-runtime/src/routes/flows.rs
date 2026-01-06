//! 流程管理路由
//!
//! 提供流程和版本的 CRUD 操作：
//! - 流程：创建、查询、更新、删除、列表
//! - 版本：创建、查询、删除、列表
//! 
//! 所有操作都支持多租户隔离。

use crate::state::AppState;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Flow list item response
#[derive(Serialize)]
pub struct FlowListItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub version_count: usize,
    pub created_at: String,
    pub updated_at: String,
}

/// Create flow request
#[derive(Deserialize)]
pub struct CreateFlowRequest {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_tenant() -> String {
    "default".to_string()
}

/// Update flow request
#[derive(Deserialize)]
pub struct UpdateFlowRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// List query parameters
#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub offset: usize,
}

fn default_limit() -> usize {
    20
}

/// Version list item
#[derive(Serialize)]
pub struct VersionListItem {
    pub id: String,
    pub flow_id: String,
    pub version_number: i32,
    pub label: Option<String>,
    pub created_at: String,
}

/// Create version request
#[derive(Deserialize)]
pub struct CreateVersionRequest {
    pub data: serde_json::Value,
    pub label: Option<String>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// Publish flow request
#[derive(Deserialize)]
pub struct PublishFlowRequest {
    pub version_id: String,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// Unpublish flow request (only needs tenant_id)
#[derive(Deserialize)]
pub struct UnpublishFlowRequest {
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// Build flow routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_flows))
        .route("/", post(create_flow))
        .route("/{id}", get(get_flow))
        .route("/{id}", put(update_flow))
        .route("/{id}", delete(delete_flow))
        .route("/{id}/versions", get(list_versions))
        .route("/{id}/versions", post(create_version))
        .route("/{id}/versions/{version_id}", get(get_version))
        .route("/{id}/versions/{version_id}", delete(delete_version))
        // Publish operations
        .route("/{id}/publish", post(publish_flow))
        .route("/{id}/unpublish", post(unpublish_flow))
        .route("/{id}/publish-status", get(get_publish_status))
        // API Keys - 嵌套路由
        .nest("/{id}/api-keys", super::api_keys::routes())
}

async fn list_flows(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let (flows, total) = state
        .list_flows(&query.tenant_id, query.limit, query.offset)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list flows: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut items = Vec::new();
    for f in flows {
        let flow_id = f.id.to_string();
        let version_count = state.version_count(&query.tenant_id, &flow_id).await;
        items.push(FlowListItem {
            id: flow_id,
            name: f.name,
            description: f.description,
            thumbnail: f.thumbnail,
            version_count,
            created_at: f.created_at.to_rfc3339(),
            updated_at: f.updated_at.to_rfc3339(),
        });
    }

    Ok(Json(serde_json::json!({
        "flows": items,
        "total": total,
        "limit": query.limit,
        "offset": query.offset
    })))
}

async fn create_flow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateFlowRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let flow = state
        .create_flow(&req.tenant_id, &req.name, req.description)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create flow: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": flow.id.to_string(),
            "name": flow.name,
            "description": flow.description,
            "tenant_id": flow.tenant_id.to_string(),
            "version_count": 0,
            "created_at": flow.created_at.to_rfc3339(),
            "updated_at": flow.updated_at.to_rfc3339()
        })),
    ))
}

async fn get_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let flow = state
        .get_flow(&query.tenant_id, &id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let flow_id = flow.id.to_string();
    let version_count = state.version_count(&query.tenant_id, &flow_id).await;

    Ok(Json(serde_json::json!({
        "id": flow_id,
        "name": flow.name,
        "description": flow.description,
        "thumbnail": flow.thumbnail,
        "tenant_id": flow.tenant_id.to_string(),
        "version_count": version_count,
        "created_at": flow.created_at.to_rfc3339(),
        "updated_at": flow.updated_at.to_rfc3339()
    })))
}

async fn update_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateFlowRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let flow = state
        .update_flow(&req.tenant_id, &id, req.name, req.description)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "id": flow.id.to_string(),
        "name": flow.name,
        "description": flow.description,
        "updated_at": flow.updated_at.to_rfc3339()
    })))
}

async fn delete_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .delete_flow(&query.tenant_id, &id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_id": id
    })))
}

async fn list_versions(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Check if flow exists
    state
        .get_flow(&query.tenant_id, &flow_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let versions = state
        .list_versions(&query.tenant_id, &flow_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list versions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<VersionListItem> = versions
        .into_iter()
        .map(|v| VersionListItem {
            id: v.id.to_string(),
            flow_id: v.flow_id.to_string(),
            version_number: v.version_number,
            label: v.label,
            created_at: v.created_at.to_rfc3339(),
        })
        .collect();

    Ok(Json(serde_json::json!({
        "flow_id": flow_id,
        "versions": items,
        "total": items.len()
    })))
}

async fn create_version(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Json(req): Json<CreateVersionRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    // Check if flow exists
    state
        .get_flow(&req.tenant_id, &flow_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let version = state
        .create_version(&flow_id, &req.tenant_id, req.data, req.label)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create version: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": version.id.to_string(),
            "flow_id": version.flow_id.to_string(),
            "version_number": version.version_number,
            "label": version.label,
            "created_at": version.created_at.to_rfc3339()
        })),
    ))
}

async fn get_version(
    State(state): State<Arc<AppState>>,
    Path((flow_id, version_id)): Path<(String, String)>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let version = state
        .get_version(&query.tenant_id, &flow_id, &version_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "id": version.id.to_string(),
        "flow_id": version.flow_id.to_string(),
        "version_number": version.version_number,
        "label": version.label,
        "data": version.data,
        "created_at": version.created_at.to_rfc3339()
    })))
}

async fn delete_version(
    State(state): State<Arc<AppState>>,
    Path((flow_id, version_id)): Path<(String, String)>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .delete_version(&query.tenant_id, &flow_id, &version_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "success": true,
        "flow_id": flow_id,
        "deleted_version_id": version_id
    })))
}

// Publish operations

async fn publish_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<PublishFlowRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let flow = state
        .publish_flow(&req.tenant_id, &id, &req.version_id)
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

    Ok(Json(serde_json::json!({
        "id": flow.id.to_string(),
        "name": flow.name,
        "published": flow.published,
        "published_at": flow.published_at.map(|t| t.to_rfc3339()),
        "published_version_id": flow.published_version_id.map(|id| id.to_string())
    })))
}

async fn unpublish_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UnpublishFlowRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let flow = state
        .unpublish_flow(&req.tenant_id, &id)
        .await
        .map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

    Ok(Json(serde_json::json!({
        "id": flow.id.to_string(),
        "name": flow.name,
        "published": flow.published
    })))
}

async fn get_publish_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let flow = state
        .get_flow(&query.tenant_id, &id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "id": flow.id.to_string(),
        "name": flow.name,
        "published": flow.published,
        "published_at": flow.published_at.map(|t| t.to_rfc3339()),
        "published_version_id": flow.published_version_id.map(|id| id.to_string())
    })))
}
