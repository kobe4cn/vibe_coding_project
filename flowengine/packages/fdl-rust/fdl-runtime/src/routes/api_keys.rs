//! API Key 管理路由
//!
//! 提供 API Key 的 CRUD 操作：
//! - 创建 Key：为已发布流程生成访问密钥
//! - 列表：查看流程的所有 Key
//! - 删除：撤销指定 Key

use crate::state::AppState;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

/// API Key 列表项（不含完整 Key）
#[derive(Serialize)]
pub struct ApiKeyListItem {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub key_prefix: String,
    pub rate_limit: i32,
    pub is_active: bool,
    pub last_used_at: Option<String>,
    pub usage_count: i32,
    pub created_at: String,
    pub expires_at: Option<String>,
}

/// 创建 API Key 请求
#[derive(Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: String,
    pub description: Option<String>,
    #[serde(default = "default_rate_limit")]
    pub rate_limit: i32,
    pub expires_in_days: Option<i64>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_rate_limit() -> i32 {
    100
}

fn default_tenant() -> String {
    "default".to_string()
}

/// 创建成功响应（包含完整 Key，只返回一次）
#[derive(Serialize)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub name: String,
    pub key: String, // 完整 Key，只在创建时返回
    pub key_prefix: String,
    pub rate_limit: i32,
    pub created_at: String,
    pub expires_at: Option<String>,
}

/// 列表查询参数
#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// 构建 API Key 路由
///
/// 路由挂载在 `/api/flows/{flow_id}/api-keys` 下
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_api_keys))
        .route("/", post(create_api_key))
        .route("/{key_id}", delete(delete_api_key))
}

/// 生成 API Key
///
/// 格式: fk_{flow_id前8位}_{随机32字符}
/// 使用两个 UUID v4 的十六进制表示生成随机部分
/// 返回 (完整key, key_hash, key_prefix)
fn generate_api_key(flow_id: &str) -> (String, String, String) {
    // 使用 UUID v4 生成随机字符串（两个 UUID 组合，取32字符）
    let uuid1 = Uuid::new_v4().simple().to_string();
    let uuid2 = Uuid::new_v4().simple().to_string();
    let random_part = format!("{}{}", &uuid1[..16], &uuid2[..16]);

    let flow_prefix = if flow_id.len() >= 8 {
        &flow_id[..8]
    } else {
        flow_id
    };

    let full_key = format!("fk_{}_{}", flow_prefix, random_part);
    // key_prefix 只保存前 8 个字符，用于数据库存储和前端显示识别
    let key_prefix = full_key.chars().take(8).collect::<String>();

    // SHA-256 哈希
    let mut hasher = Sha256::new();
    hasher.update(full_key.as_bytes());
    let key_hash = format!("{:x}", hasher.finalize());

    (full_key, key_hash, key_prefix)
}

async fn list_api_keys(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 验证流程存在且属于该租户
    state
        .get_flow(&query.tenant_id, &flow_id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let keys = state
        .list_api_keys(&query.tenant_id, &flow_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list API keys: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<ApiKeyListItem> = keys
        .into_iter()
        .map(|k| ApiKeyListItem {
            id: k.id.to_string(),
            name: k.name,
            description: k.description,
            key_prefix: k.key_prefix,
            rate_limit: k.rate_limit,
            is_active: k.is_active,
            last_used_at: k.last_used_at.map(|t| t.to_rfc3339()),
            usage_count: k.usage_count,
            created_at: k.created_at.to_rfc3339(),
            expires_at: k.expires_at.map(|t| t.to_rfc3339()),
        })
        .collect();

    Ok(Json(serde_json::json!({
        "flow_id": flow_id,
        "api_keys": items,
        "total": items.len()
    })))
}

async fn create_api_key(
    State(state): State<Arc<AppState>>,
    Path(flow_id): Path<String>,
    Json(req): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateApiKeyResponse>), (StatusCode, Json<serde_json::Value>)> {
    // 验证流程存在
    let flow = state
        .get_flow(&req.tenant_id, &flow_id)
        .await
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            )
        })?;

    // 验证流程已发布
    if !flow.published {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Flow must be published before creating API keys"})),
        ));
    }

    // 生成 Key
    let (full_key, key_hash, key_prefix) = generate_api_key(&flow_id);

    // 计算过期时间
    let expires_at = req
        .expires_in_days
        .map(|days| chrono::Utc::now() + chrono::Duration::days(days));

    // 创建记录
    let api_key = state
        .create_api_key(
            &req.tenant_id,
            &flow_id,
            &req.name,
            req.description,
            &key_hash,
            &key_prefix,
            Some(req.rate_limit),
            expires_at,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to create API key: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

    Ok((
        StatusCode::CREATED,
        Json(CreateApiKeyResponse {
            id: api_key.id.to_string(),
            name: api_key.name,
            key: full_key, // 只在这里返回完整 Key
            key_prefix: api_key.key_prefix,
            rate_limit: api_key.rate_limit,
            created_at: api_key.created_at.to_rfc3339(),
            expires_at: api_key.expires_at.map(|t| t.to_rfc3339()),
        }),
    ))
}

async fn delete_api_key(
    State(state): State<Arc<AppState>>,
    Path((flow_id, key_id)): Path<(String, String)>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // 验证流程存在
    state
        .get_flow(&query.tenant_id, &flow_id)
        .await
        .map_err(|_| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Flow not found"})),
            )
        })?;

    // 删除 Key
    state
        .delete_api_key(&query.tenant_id, &key_id)
        .await
        .map_err(|e| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_key_id": key_id
    })))
}
