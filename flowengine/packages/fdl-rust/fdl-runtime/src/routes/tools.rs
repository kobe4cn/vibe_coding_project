//! 工具管理路由
//!
//! 提供 API 服务、数据源和 UDF 的 CRUD 操作：
//! - `/api/tools/services` - API 服务管理
//! - `/api/tools/datasources` - 数据源管理
//! - `/api/tools/udfs` - UDF 管理
//!
//! 所有操作都支持多租户隔离。

use crate::state::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use fdl_tools::{ApiServiceConfig, AuthType, DatabaseType, DatasourceConfig, UdfConfig, UdfType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// 查询参数
#[derive(Deserialize)]
pub struct TenantQuery {
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_tenant() -> String {
    "default".to_string()
}

// ==================== API 服务管理 ====================

/// API 服务列表项
#[derive(Serialize)]
pub struct ApiServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub base_url: String,
    pub auth_type: String,
    pub timeout_ms: u64,
    pub enabled: bool,
}

/// 创建 API 服务请求
#[derive(Deserialize)]
pub struct CreateApiServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub base_url: String,
    #[serde(default = "default_auth_type")]
    pub auth_type: String,
    #[serde(default)]
    pub auth_config: HashMap<String, String>,
    #[serde(default)]
    pub default_headers: HashMap<String, String>,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_auth_type() -> String {
    "none".to_string()
}

fn default_timeout() -> u64 {
    30000
}

fn default_enabled() -> bool {
    true
}

/// 更新 API 服务请求
#[derive(Deserialize)]
pub struct UpdateApiServiceRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub base_url: Option<String>,
    pub auth_type: Option<String>,
    pub auth_config: Option<HashMap<String, String>>,
    pub default_headers: Option<HashMap<String, String>>,
    pub timeout_ms: Option<u64>,
    pub enabled: Option<bool>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

// ==================== 数据源管理 ====================

/// 数据源列表项
#[derive(Serialize)]
pub struct DatasourceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub db_type: String,
    pub schema: Option<String>,
    pub table: Option<String>,
    pub pool_size: u32,
    pub timeout_ms: u64,
    pub read_only: bool,
    pub enabled: bool,
}

/// 创建数据源请求
#[derive(Deserialize)]
pub struct CreateDatasourceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub db_type: String,
    pub connection_string: String,
    #[serde(default)]
    pub schema: Option<String>,
    #[serde(default)]
    pub table: Option<String>,
    #[serde(default = "default_pool_size")]
    pub pool_size: u32,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub read_only: bool,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_pool_size() -> u32 {
    10
}

/// 更新数据源请求
#[derive(Deserialize)]
pub struct UpdateDatasourceRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub connection_string: Option<String>,
    pub schema: Option<String>,
    pub table: Option<String>,
    pub pool_size: Option<u32>,
    pub timeout_ms: Option<u64>,
    pub read_only: Option<bool>,
    pub enabled: Option<bool>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

// ==================== UDF 管理 ====================

/// UDF 列表项
#[derive(Serialize)]
pub struct UdfListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub udf_type: String,
    pub handler: String,
    pub is_builtin: bool,
    pub enabled: bool,
}

/// 创建 UDF 请求
#[derive(Deserialize)]
pub struct CreateUdfRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_udf_type")]
    pub udf_type: String,
    pub handler: String,
    #[serde(default)]
    pub input_schema: Option<serde_json::Value>,
    #[serde(default)]
    pub output_schema: Option<serde_json::Value>,
    #[serde(default)]
    pub applicable_db_types: Vec<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_udf_type() -> String {
    "builtin".to_string()
}

/// 更新 UDF 请求
#[derive(Deserialize)]
pub struct UpdateUdfRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub handler: Option<String>,
    pub input_schema: Option<serde_json::Value>,
    pub output_schema: Option<serde_json::Value>,
    pub enabled: Option<bool>,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

/// 构建工具管理路由
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        // API 服务管理
        .route("/services", get(list_api_services))
        .route("/services", post(create_api_service))
        .route("/services/{name}", get(get_api_service))
        .route("/services/{name}", put(update_api_service))
        .route("/services/{name}", delete(delete_api_service))
        // 数据源管理
        .route("/datasources", get(list_datasources))
        .route("/datasources", post(create_datasource))
        .route("/datasources/{name}", get(get_datasource))
        .route("/datasources/{name}", put(update_datasource))
        .route("/datasources/{name}", delete(delete_datasource))
        // UDF 管理
        .route("/udfs", get(list_udfs))
        .route("/udfs", post(create_udf))
        .route("/udfs/{name}", get(get_udf))
        .route("/udfs/{name}", put(update_udf))
        .route("/udfs/{name}", delete(delete_udf))
        // 内置 UDF 列表
        .route("/udfs/builtin", get(list_builtin_udfs))
}

// ==================== API 服务处理器 ====================

async fn list_api_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .config_store()
        .list_api_services(&query.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list API services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<ApiServiceListItem> = services
        .into_iter()
        .map(|s| ApiServiceListItem {
            name: s.name,
            display_name: s.display_name,
            description: s.description,
            base_url: s.base_url,
            auth_type: format!("{:?}", s.auth_type).to_lowercase(),
            timeout_ms: s.timeout_ms,
            enabled: s.enabled,
        })
        .collect();

    Ok(Json(serde_json::json!({
        "services": items,
        "total": items.len()
    })))
}

async fn create_api_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateApiServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let auth_type = parse_auth_type(&req.auth_type);

    let config = ApiServiceConfig {
        name: req.name.clone(),
        display_name: req.display_name,
        description: req.description,
        base_url: req.base_url,
        auth_type,
        auth_config: req.auth_config,
        default_headers: req.default_headers,
        timeout_ms: req.timeout_ms,
        retry_count: 3,
        enabled: req.enabled,
        created_at: None,
        updated_at: None,
    };

    state
        .config_store()
        .save_api_service(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create API service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": config.name,
            "display_name": config.display_name,
            "base_url": config.base_url,
            "enabled": config.enabled
        })),
    ))
}

async fn get_api_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .config_store()
        .get_api_service(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get API service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "name": service.name,
        "display_name": service.display_name,
        "description": service.description,
        "base_url": service.base_url,
        "auth_type": format!("{:?}", service.auth_type).to_lowercase(),
        "default_headers": service.default_headers,
        "timeout_ms": service.timeout_ms,
        "retry_count": service.retry_count,
        "enabled": service.enabled
    })))
}

async fn update_api_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateApiServiceRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 获取现有配置
    let mut config = state
        .config_store()
        .get_api_service(&req.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get API service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // 更新字段
    if let Some(display_name) = req.display_name {
        config.display_name = display_name;
    }
    if let Some(description) = req.description {
        config.description = Some(description);
    }
    if let Some(base_url) = req.base_url {
        config.base_url = base_url;
    }
    if let Some(auth_type) = req.auth_type {
        config.auth_type = parse_auth_type(&auth_type);
    }
    if let Some(auth_config) = req.auth_config {
        config.auth_config = auth_config;
    }
    if let Some(default_headers) = req.default_headers {
        config.default_headers = default_headers;
    }
    if let Some(timeout_ms) = req.timeout_ms {
        config.timeout_ms = timeout_ms;
    }
    if let Some(enabled) = req.enabled {
        config.enabled = enabled;
    }

    state
        .config_store()
        .save_api_service(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to update API service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": config.name,
        "display_name": config.display_name,
        "enabled": config.enabled,
        "updated": true
    })))
}

async fn delete_api_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .config_store()
        .delete_api_service(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete API service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

// ==================== 数据源处理器 ====================

async fn list_datasources(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let datasources = state
        .config_store()
        .list_datasources(&query.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list datasources: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<DatasourceListItem> = datasources
        .into_iter()
        .map(|d| DatasourceListItem {
            name: d.name,
            display_name: d.display_name,
            description: d.description,
            db_type: format!("{:?}", d.db_type),
            schema: d.schema,
            table: d.table,
            pool_size: d.pool_size,
            timeout_ms: d.timeout_ms,
            read_only: d.read_only,
            enabled: d.enabled,
        })
        .collect();

    Ok(Json(serde_json::json!({
        "datasources": items,
        "total": items.len()
    })))
}

async fn create_datasource(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateDatasourceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let db_type = parse_db_type(&req.db_type);

    let config = DatasourceConfig {
        name: req.name.clone(),
        display_name: req.display_name,
        description: req.description,
        db_type,
        connection_string: req.connection_string,
        schema: req.schema,
        table: req.table,
        pool_size: req.pool_size,
        timeout_ms: req.timeout_ms,
        read_only: req.read_only,
        enabled: req.enabled,
        created_at: None,
        updated_at: None,
    };

    state
        .config_store()
        .save_datasource(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create datasource: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": config.name,
            "display_name": config.display_name,
            "db_type": format!("{:?}", config.db_type),
            "enabled": config.enabled
        })),
    ))
}

async fn get_datasource(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let ds = state
        .config_store()
        .get_datasource(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get datasource: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // 返回掩码后的连接字符串，保护敏感信息
    let masked_connection_string = mask_connection_string(&ds.connection_string);

    Ok(Json(serde_json::json!({
        "name": ds.name,
        "display_name": ds.display_name,
        "description": ds.description,
        "db_type": format!("{:?}", ds.db_type),
        "connection_string": masked_connection_string,
        "schema": ds.schema,
        "table": ds.table,
        "pool_size": ds.pool_size,
        "timeout_ms": ds.timeout_ms,
        "read_only": ds.read_only,
        "enabled": ds.enabled
    })))
}

async fn update_datasource(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateDatasourceRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut config = state
        .config_store()
        .get_datasource(&req.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get datasource: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(display_name) = req.display_name {
        config.display_name = display_name;
    }
    if let Some(description) = req.description {
        config.description = Some(description);
    }
    if let Some(connection_string) = req.connection_string {
        config.connection_string = connection_string;
    }
    if let Some(schema) = req.schema {
        config.schema = Some(schema);
    }
    if let Some(table) = req.table {
        config.table = Some(table);
    }
    if let Some(pool_size) = req.pool_size {
        config.pool_size = pool_size;
    }
    if let Some(timeout_ms) = req.timeout_ms {
        config.timeout_ms = timeout_ms;
    }
    if let Some(read_only) = req.read_only {
        config.read_only = read_only;
    }
    if let Some(enabled) = req.enabled {
        config.enabled = enabled;
    }

    state
        .config_store()
        .save_datasource(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to update datasource: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": config.name,
        "display_name": config.display_name,
        "enabled": config.enabled,
        "updated": true
    })))
}

async fn delete_datasource(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .config_store()
        .delete_datasource(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete datasource: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

// ==================== UDF 处理器 ====================

async fn list_udfs(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let udfs = state
        .config_store()
        .list_udfs(&query.tenant_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list UDFs: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<UdfListItem> = udfs
        .into_iter()
        .map(|u| UdfListItem {
            name: u.name,
            display_name: u.display_name,
            description: u.description,
            udf_type: format!("{:?}", u.udf_type).to_lowercase(),
            handler: u.handler,
            is_builtin: u.is_builtin,
            enabled: u.enabled,
        })
        .collect();

    Ok(Json(serde_json::json!({
        "udfs": items,
        "total": items.len()
    })))
}

async fn list_builtin_udfs(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 返回内置 UDF 列表
    let builtin_udfs = vec![
        serde_json::json!({
            "name": "take",
            "display_name": "获取单条记录",
            "description": "根据条件获取单条记录",
            "handler": "builtin::take"
        }),
        serde_json::json!({
            "name": "list",
            "display_name": "获取记录列表",
            "description": "获取符合条件的记录列表",
            "handler": "builtin::list"
        }),
        serde_json::json!({
            "name": "count",
            "display_name": "统计记录数",
            "description": "统计符合条件的记录数量",
            "handler": "builtin::count"
        }),
        serde_json::json!({
            "name": "page",
            "display_name": "分页查询",
            "description": "分页获取记录列表",
            "handler": "builtin::page"
        }),
        serde_json::json!({
            "name": "create",
            "display_name": "创建记录",
            "description": "创建新记录",
            "handler": "builtin::create"
        }),
        serde_json::json!({
            "name": "modify",
            "display_name": "修改记录",
            "description": "根据条件修改记录",
            "handler": "builtin::modify"
        }),
        serde_json::json!({
            "name": "delete",
            "display_name": "删除记录",
            "description": "根据条件删除记录",
            "handler": "builtin::delete"
        }),
        serde_json::json!({
            "name": "native",
            "display_name": "原生 SQL",
            "description": "执行原生 SQL 语句",
            "handler": "builtin::native"
        }),
    ];

    Ok(Json(serde_json::json!({
        "builtin_udfs": builtin_udfs,
        "total": builtin_udfs.len()
    })))
}

async fn create_udf(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateUdfRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let udf_type = parse_udf_type(&req.udf_type);
    let applicable_db_types: Vec<DatabaseType> = req
        .applicable_db_types
        .iter()
        .map(|s| parse_db_type(s))
        .collect();

    let config = UdfConfig {
        name: req.name.clone(),
        display_name: req.display_name,
        description: req.description,
        udf_type,
        handler: req.handler,
        input_schema: req.input_schema,
        output_schema: req.output_schema,
        applicable_db_types,
        is_builtin: false,
        enabled: req.enabled,
        created_at: None,
        updated_at: None,
    };

    state
        .config_store()
        .save_udf(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to create UDF: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": config.name,
            "display_name": config.display_name,
            "udf_type": format!("{:?}", config.udf_type).to_lowercase(),
            "enabled": config.enabled
        })),
    ))
}

async fn get_udf(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let udf = state
        .config_store()
        .get_udf(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get UDF: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serde_json::json!({
        "name": udf.name,
        "display_name": udf.display_name,
        "description": udf.description,
        "udf_type": format!("{:?}", udf.udf_type).to_lowercase(),
        "handler": udf.handler,
        "input_schema": udf.input_schema,
        "output_schema": udf.output_schema,
        "is_builtin": udf.is_builtin,
        "enabled": udf.enabled
    })))
}

async fn update_udf(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<UpdateUdfRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut config = state
        .config_store()
        .get_udf(&req.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get UDF: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // 内置 UDF 不允许修改关键字段
    if config.is_builtin {
        return Err(StatusCode::FORBIDDEN);
    }

    if let Some(display_name) = req.display_name {
        config.display_name = display_name;
    }
    if let Some(description) = req.description {
        config.description = Some(description);
    }
    if let Some(handler) = req.handler {
        config.handler = handler;
    }
    if let Some(input_schema) = req.input_schema {
        config.input_schema = Some(input_schema);
    }
    if let Some(output_schema) = req.output_schema {
        config.output_schema = Some(output_schema);
    }
    if let Some(enabled) = req.enabled {
        config.enabled = enabled;
    }

    state
        .config_store()
        .save_udf(&req.tenant_id, config.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to update UDF: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": config.name,
        "display_name": config.display_name,
        "enabled": config.enabled,
        "updated": true
    })))
}

async fn delete_udf(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 检查是否是内置 UDF
    if let Ok(Some(udf)) = state.config_store().get_udf(&query.tenant_id, &name).await {
        if udf.is_builtin {
            return Err(StatusCode::FORBIDDEN);
        }
    }

    state
        .config_store()
        .delete_udf(&query.tenant_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete UDF: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

// ==================== 辅助函数 ====================

fn parse_auth_type(s: &str) -> AuthType {
    match s.to_lowercase().as_str() {
        "apikey" | "api_key" => AuthType::ApiKey,
        "basic" => AuthType::Basic,
        "bearer" => AuthType::Bearer,
        "oauth2" => AuthType::OAuth2,
        "custom" => AuthType::Custom,
        _ => AuthType::None,
    }
}

fn parse_db_type(s: &str) -> DatabaseType {
    match s.to_lowercase().as_str() {
        "mysql" => DatabaseType::MySQL,
        "postgresql" | "postgres" => DatabaseType::PostgreSQL,
        "sqlite" => DatabaseType::SQLite,
        "mongodb" => DatabaseType::MongoDB,
        "redis" => DatabaseType::Redis,
        "elasticsearch" | "es" => DatabaseType::Elasticsearch,
        _ => DatabaseType::MySQL,
    }
}

fn parse_udf_type(s: &str) -> UdfType {
    match s.to_lowercase().as_str() {
        "sql" => UdfType::Sql,
        "wasm" => UdfType::Wasm,
        "http" => UdfType::Http,
        _ => UdfType::Builtin,
    }
}

/// 掩码连接字符串中的敏感信息（用户名和密码）
///
/// 支持的格式：
/// - `postgres://user:password@host:port/database`
/// - `mysql://user:password@host:port/database`
/// - `mongodb://user:password@host:port/database`
///
/// 掩码后：`postgres://***:***@host:port/database`
fn mask_connection_string(conn_str: &str) -> String {
    // 尝试解析 URL 格式的连接字符串
    if let Some(at_pos) = conn_str.find('@') {
        if let Some(scheme_end) = conn_str.find("://") {
            let scheme = &conn_str[..scheme_end + 3]; // 包含 "://"
            let after_scheme = &conn_str[scheme_end + 3..at_pos];
            let after_at = &conn_str[at_pos..];

            // 检查是否有用户名:密码格式
            if after_scheme.contains(':') {
                // 用户名和密码都掩码
                return format!("{}***:***{}", scheme, after_at);
            } else if !after_scheme.is_empty() {
                // 只有用户名，没有密码
                return format!("{}***{}", scheme, after_at);
            }
        }
    }

    // 无法解析或不包含凭证，返回原字符串
    conn_str.to_string()
}
