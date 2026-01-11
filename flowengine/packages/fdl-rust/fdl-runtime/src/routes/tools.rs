//! 工具管理路由
//!
//! 提供 API 服务、数据源和 UDF 的 CRUD 操作：
//! - `/api/tools/services` - API 服务管理
//! - `/api/tools/datasources` - 数据源管理
//! - `/api/tools/udfs` - UDF 管理
//! - `/api/tools/oss` - OSS 对象存储管理
//! - `/api/tools/mq` - 消息队列管理
//! - `/api/tools/mail` - 邮件服务管理
//! - `/api/tools/sms` - 短信服务管理
//! - `/api/tools/svc` - 微服务管理
//!
//! 所有操作都支持多租户隔离。

use crate::state::AppState;
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
};
use fdl_tools::{
    ApiServiceConfig,
    AuthType,
    DatabaseType,
    DatasourceConfig,
    LoadBalancer,
    MailConfig,
    MailProvider,
    MessageSerialization,
    MqBroker,
    MqConfig,
    OssConfig,
    OssCredentials,
    OssProvider,
    ServiceDiscovery,
    ServiceProtocol,
    SmsConfig,
    SmsProvider,
    SvcConfig,
    ToolService,
    ToolServiceConfig,
    // ToolSpec 模型
    ToolType,
    UdfConfig,
    UdfType,
};
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
        // OSS 对象存储管理
        .route("/oss", get(list_oss_services))
        .route("/oss", post(create_oss_service))
        .route("/oss/{name}", get(get_oss_service))
        .route("/oss/{name}", put(update_oss_service))
        .route("/oss/{name}", delete(delete_oss_service))
        .route("/oss/{name}/test", post(test_oss_connection))
        // MQ 消息队列管理
        .route("/mq", get(list_mq_services))
        .route("/mq", post(create_mq_service))
        .route("/mq/{name}", get(get_mq_service))
        .route("/mq/{name}", put(update_mq_service))
        .route("/mq/{name}", delete(delete_mq_service))
        .route("/mq/{name}/test", post(test_mq_connection))
        // Mail 邮件服务管理
        .route("/mail", get(list_mail_services))
        .route("/mail", post(create_mail_service))
        .route("/mail/{name}", get(get_mail_service))
        .route("/mail/{name}", put(update_mail_service))
        .route("/mail/{name}", delete(delete_mail_service))
        .route("/mail/{name}/test", post(test_mail_send))
        // SMS 短信服务管理
        .route("/sms", get(list_sms_services))
        .route("/sms", post(create_sms_service))
        .route("/sms/{name}", get(get_sms_service))
        .route("/sms/{name}", put(update_sms_service))
        .route("/sms/{name}", delete(delete_sms_service))
        // Svc 微服务管理
        .route("/svc", get(list_svc_services))
        .route("/svc", post(create_svc_service))
        .route("/svc/{name}", get(get_svc_service))
        .route("/svc/{name}", put(update_svc_service))
        .route("/svc/{name}", delete(delete_svc_service))
        .route("/svc/{name}/health", get(check_svc_health))
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

// ==================== OSS 对象存储处理器 ====================

/// OSS 服务列表项
#[derive(Serialize)]
pub struct OssServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub provider: String,
    pub bucket: String,
    pub region: Option<String>,
    pub endpoint: Option<String>,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub path_style: bool,
    pub enabled: bool,
}

/// 创建 OSS 服务请求
#[derive(Deserialize)]
pub struct CreateOssServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub provider: String,
    pub bucket: String,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default)]
    pub endpoint: Option<String>,
    pub access_key_id: String,
    pub secret_access_key: String,
    #[serde(default)]
    pub path_style: bool,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

async fn list_oss_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .tool_service_store()
        .list_services_by_type(&query.tenant_id, ToolType::Oss)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list OSS services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<OssServiceListItem> = services
        .into_iter()
        .filter_map(|s| {
            if let ToolServiceConfig::Oss(config) = s.config {
                Some(OssServiceListItem {
                    name: s.code,
                    display_name: s.name,
                    description: s.description,
                    provider: format!("{:?}", config.provider).to_lowercase(),
                    bucket: config.bucket,
                    region: config.region,
                    endpoint: config.endpoint,
                    access_key_id: "******".to_string(),
                    secret_access_key: "******".to_string(),
                    path_style: config.path_style,
                    enabled: s.enabled,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(Json(serde_json::json!({
        "configs": items,
        "total": items.len()
    })))
}

async fn create_oss_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateOssServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let provider = parse_oss_provider(&req.provider);

    let config = ToolServiceConfig::Oss(OssConfig {
        provider,
        bucket: req.bucket.clone(),
        region: req.region,
        endpoint: req.endpoint,
        credentials: OssCredentials {
            access_key_id: req.access_key_id,
            secret_access_key: req.secret_access_key,
            session_token: None,
        },
        path_style: req.path_style,
    });

    let service = ToolService::new(
        ToolType::Oss,
        &req.name,
        &req.display_name,
        config,
        &req.tenant_id,
    );

    let saved = state
        .tool_service_store()
        .save_service(&req.tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": saved.code,
            "display_name": saved.name,
            "enabled": saved.enabled
        })),
    ))
}

async fn get_oss_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Oss, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let ToolServiceConfig::Oss(config) = service.config {
        Ok(Json(serde_json::json!({
            "name": service.code,
            "display_name": service.name,
            "description": service.description,
            "provider": format!("{:?}", config.provider).to_lowercase(),
            "bucket": config.bucket,
            "region": config.region,
            "endpoint": config.endpoint,
            "access_key_id": "***",
            "secret_access_key": "***",
            "path_style": config.path_style,
            "enabled": service.enabled
        })))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn update_oss_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let tenant_id = req
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let mut service = state
        .tool_service_store()
        .get_service_by_code(tenant_id, ToolType::Oss, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // 更新基础字段
    if let Some(display_name) = req.get("display_name").and_then(|v| v.as_str()) {
        service.name = display_name.to_string();
    }
    if let Some(description) = req.get("description").and_then(|v| v.as_str()) {
        service.description = Some(description.to_string());
    }
    if let Some(enabled) = req.get("enabled").and_then(|v| v.as_bool()) {
        service.enabled = enabled;
    }

    // 更新 OSS 配置
    if let ToolServiceConfig::Oss(ref mut config) = service.config {
        if let Some(provider) = req.get("provider").and_then(|v| v.as_str()) {
            config.provider = parse_oss_provider(provider);
        }
        if let Some(bucket) = req.get("bucket").and_then(|v| v.as_str()) {
            config.bucket = bucket.to_string();
        }
        if let Some(region) = req.get("region").and_then(|v| v.as_str()) {
            config.region = if region.is_empty() {
                None
            } else {
                Some(region.to_string())
            };
        }
        if let Some(endpoint) = req.get("endpoint").and_then(|v| v.as_str()) {
            config.endpoint = if endpoint.is_empty() {
                None
            } else {
                Some(endpoint.to_string())
            };
        }
        if let Some(path_style) = req.get("path_style").and_then(|v| v.as_bool()) {
            config.path_style = path_style;
        }
        // 密钥字段：只有非掩码值才更新
        if let Some(access_key_id) = req.get("access_key_id").and_then(|v| v.as_str()) {
            if !access_key_id.is_empty() && !access_key_id.contains('*') {
                config.credentials.access_key_id = access_key_id.to_string();
            }
        }
        if let Some(secret_access_key) = req.get("secret_access_key").and_then(|v| v.as_str()) {
            if !secret_access_key.is_empty() && !secret_access_key.contains('*') {
                config.credentials.secret_access_key = secret_access_key.to_string();
            }
        }
    }

    let saved = state
        .tool_service_store()
        .save_service(tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": saved.code,
        "display_name": saved.name,
        "enabled": saved.enabled,
        "updated": true
    })))
}

async fn delete_oss_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // 先获取服务 ID
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Oss, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    state
        .tool_service_store()
        .delete_service(&query.tenant_id, &service.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete OSS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

async fn test_oss_connection(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(_query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // TODO: 实现实际的连接测试
    Ok(Json(serde_json::json!({
        "success": true,
        "name": name,
        "message": "Connection test not implemented yet"
    })))
}

fn parse_oss_provider(s: &str) -> OssProvider {
    match s.to_lowercase().as_str() {
        "s3" | "aws" => OssProvider::S3,
        "alioss" | "aliyun" => OssProvider::AliOss,
        "minio" => OssProvider::MinIO,
        "azure" => OssProvider::Azure,
        "gcs" | "google" => OssProvider::Gcs,
        _ => OssProvider::S3,
    }
}

// ==================== MQ 消息队列处理器 ====================

/// MQ 服务列表项
#[derive(Serialize)]
pub struct MqServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub broker: String,
    pub connection_string: String,
    pub default_queue: Option<String>,
    pub default_exchange: Option<String>,
    pub default_routing_key: Option<String>,
    pub serialization: String,
    pub enabled: bool,
}

/// 创建 MQ 服务请求
#[derive(Deserialize)]
pub struct CreateMqServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub broker: String,
    pub connection_string: String,
    #[serde(default)]
    pub default_queue: Option<String>,
    #[serde(default)]
    pub default_exchange: Option<String>,
    #[serde(default)]
    pub default_routing_key: Option<String>,
    #[serde(default = "default_serialization")]
    pub serialization: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_serialization() -> String {
    "json".to_string()
}

async fn list_mq_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .tool_service_store()
        .list_services_by_type(&query.tenant_id, ToolType::Mq)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list MQ services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<MqServiceListItem> = services
        .into_iter()
        .filter_map(|s| {
            if let ToolServiceConfig::Mq(config) = s.config {
                Some(MqServiceListItem {
                    name: s.code,
                    display_name: s.name,
                    description: s.description,
                    broker: format!("{:?}", config.broker).to_lowercase(),
                    connection_string: "******".to_string(),
                    default_queue: config.default_queue,
                    default_exchange: config.default_exchange,
                    default_routing_key: config.default_routing_key,
                    serialization: format!("{:?}", config.serialization).to_lowercase(),
                    enabled: s.enabled,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(Json(serde_json::json!({
        "configs": items,
        "total": items.len()
    })))
}

async fn create_mq_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateMqServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let broker = parse_mq_broker(&req.broker);
    let serialization = parse_mq_serialization(&req.serialization);

    let config = ToolServiceConfig::Mq(MqConfig {
        broker,
        connection_string: req.connection_string,
        default_queue: req.default_queue,
        default_exchange: req.default_exchange,
        default_routing_key: req.default_routing_key,
        serialization,
    });

    let service = ToolService::new(
        ToolType::Mq,
        &req.name,
        &req.display_name,
        config,
        &req.tenant_id,
    );

    let saved = state
        .tool_service_store()
        .save_service(&req.tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": saved.code,
            "display_name": saved.name,
            "enabled": saved.enabled
        })),
    ))
}

async fn get_mq_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Mq, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let ToolServiceConfig::Mq(config) = service.config {
        Ok(Json(serde_json::json!({
            "name": service.code,
            "display_name": service.name,
            "description": service.description,
            "broker": format!("{:?}", config.broker).to_lowercase(),
            "connection_string": mask_connection_string(&config.connection_string),
            "default_queue": config.default_queue,
            "default_exchange": config.default_exchange,
            "default_routing_key": config.default_routing_key,
            "serialization": format!("{:?}", config.serialization).to_lowercase(),
            "enabled": service.enabled
        })))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn update_mq_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let tenant_id = req
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let mut service = state
        .tool_service_store()
        .get_service_by_code(tenant_id, ToolType::Mq, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(display_name) = req.get("display_name").and_then(|v| v.as_str()) {
        service.name = display_name.to_string();
    }
    if let Some(enabled) = req.get("enabled").and_then(|v| v.as_bool()) {
        service.enabled = enabled;
    }

    // 更新 MQ 配置字段
    if let ToolServiceConfig::Mq(ref mut config) = service.config {
        if let Some(broker) = req.get("broker").and_then(|v| v.as_str()) {
            config.broker = parse_mq_broker(broker);
        }
        // 只有当连接字符串不包含掩码时才更新
        if let Some(connection_string) = req.get("connection_string").and_then(|v| v.as_str()) {
            if !connection_string.contains('*') {
                config.connection_string = connection_string.to_string();
            }
        }
        if let Some(default_queue) = req.get("default_queue").and_then(|v| v.as_str()) {
            config.default_queue = Some(default_queue.to_string());
        }
        if let Some(default_exchange) = req.get("default_exchange").and_then(|v| v.as_str()) {
            config.default_exchange = Some(default_exchange.to_string());
        }
        if let Some(default_routing_key) = req.get("default_routing_key").and_then(|v| v.as_str()) {
            config.default_routing_key = Some(default_routing_key.to_string());
        }
        if let Some(serialization) = req.get("serialization").and_then(|v| v.as_str()) {
            config.serialization = parse_mq_serialization(serialization);
        }
    }

    let saved = state
        .tool_service_store()
        .save_service(tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": saved.code,
        "display_name": saved.name,
        "enabled": saved.enabled,
        "updated": true
    })))
}

async fn delete_mq_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Mq, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    state
        .tool_service_store()
        .delete_service(&query.tenant_id, &service.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete MQ service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

async fn test_mq_connection(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(_query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "success": true,
        "name": name,
        "message": "Connection test not implemented yet"
    })))
}

fn parse_mq_broker(s: &str) -> MqBroker {
    match s.to_lowercase().as_str() {
        "rabbitmq" | "rabbit" => MqBroker::RabbitMq,
        "kafka" => MqBroker::Kafka,
        "rocketmq" | "rocket" => MqBroker::RocketMq,
        "redis" => MqBroker::Redis,
        _ => MqBroker::RabbitMq,
    }
}

fn parse_mq_serialization(s: &str) -> MessageSerialization {
    match s.to_lowercase().as_str() {
        "json" => MessageSerialization::Json,
        "protobuf" | "proto" => MessageSerialization::Protobuf,
        "avro" => MessageSerialization::Avro,
        _ => MessageSerialization::Json,
    }
}

// ==================== Mail 邮件服务处理器 ====================

/// Mail 服务列表项
#[derive(Serialize)]
pub struct MailServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub provider: String,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub api_key: String,
    pub from_address: String,
    pub from_name: Option<String>,
    pub enabled: bool,
}

/// 创建 Mail 服务请求
#[derive(Deserialize)]
pub struct CreateMailServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub provider: String,
    #[serde(default)]
    pub smtp_host: Option<String>,
    #[serde(default)]
    pub smtp_port: Option<u16>,
    #[serde(default)]
    pub use_tls: Option<bool>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    pub from_address: String,
    #[serde(default)]
    pub from_name: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

async fn list_mail_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .tool_service_store()
        .list_services_by_type(&query.tenant_id, ToolType::Mail)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list Mail services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<MailServiceListItem> = services
        .into_iter()
        .filter_map(|s| {
            if let ToolServiceConfig::Mail(config) = s.config {
                Some(MailServiceListItem {
                    name: s.code,
                    display_name: s.name,
                    description: s.description,
                    provider: format!("{:?}", config.provider).to_lowercase(),
                    smtp_host: config.smtp_host,
                    smtp_port: config.smtp_port,
                    api_key: "******".to_string(),
                    from_address: config.from_address,
                    from_name: config.from_name,
                    enabled: s.enabled,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(Json(serde_json::json!({
        "configs": items,
        "total": items.len()
    })))
}

async fn create_mail_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateMailServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let provider = parse_mail_provider(&req.provider);

    let config = ToolServiceConfig::Mail(MailConfig {
        provider,
        smtp_host: req.smtp_host,
        smtp_port: req.smtp_port,
        api_key: req.api_key,
        from_address: req.from_address.clone(),
        from_name: req.from_name,
    });

    let service = ToolService::new(
        ToolType::Mail,
        &req.name,
        &req.display_name,
        config,
        &req.tenant_id,
    );

    let saved = state
        .tool_service_store()
        .save_service(&req.tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": saved.code,
            "display_name": saved.name,
            "enabled": saved.enabled
        })),
    ))
}

async fn get_mail_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Mail, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let ToolServiceConfig::Mail(config) = service.config {
        Ok(Json(serde_json::json!({
            "name": service.code,
            "display_name": service.name,
            "description": service.description,
            "provider": format!("{:?}", config.provider).to_lowercase(),
            "smtp_host": config.smtp_host,
            "smtp_port": config.smtp_port,
            "api_key": config.api_key.as_ref().map(|_| "***"),
            "from_address": config.from_address,
            "from_name": config.from_name,
            "enabled": service.enabled
        })))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn update_mail_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let tenant_id = req
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let mut service = state
        .tool_service_store()
        .get_service_by_code(tenant_id, ToolType::Mail, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(display_name) = req.get("display_name").and_then(|v| v.as_str()) {
        service.name = display_name.to_string();
    }
    if let Some(enabled) = req.get("enabled").and_then(|v| v.as_bool()) {
        service.enabled = enabled;
    }

    let saved = state
        .tool_service_store()
        .save_service(tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": saved.code,
        "display_name": saved.name,
        "enabled": saved.enabled,
        "updated": true
    })))
}

async fn delete_mail_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Mail, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    state
        .tool_service_store()
        .delete_service(&query.tenant_id, &service.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete Mail service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

async fn test_mail_send(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(_query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "success": true,
        "name": name,
        "message": "Test email not implemented yet"
    })))
}

fn parse_mail_provider(s: &str) -> MailProvider {
    match s.to_lowercase().as_str() {
        "smtp" => MailProvider::Smtp,
        "sendgrid" => MailProvider::SendGrid,
        "mailgun" => MailProvider::Mailgun,
        "ses" | "aws" => MailProvider::Ses,
        "aliyun" | "alimail" => MailProvider::Aliyun,
        _ => MailProvider::Smtp,
    }
}

// ==================== SMS 短信服务处理器 ====================

/// SMS 服务列表项
#[derive(Serialize)]
pub struct SmsServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub provider: String,
    pub api_key: String,
    pub api_secret: String,
    pub sign_name: Option<String>,
    pub region: Option<String>,
    pub enabled: bool,
}

/// 创建 SMS 服务请求
#[derive(Deserialize)]
pub struct CreateSmsServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub provider: String,
    pub api_key: String,
    #[serde(default)]
    pub api_secret: Option<String>,
    #[serde(default)]
    pub sign_name: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

async fn list_sms_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .tool_service_store()
        .list_services_by_type(&query.tenant_id, ToolType::Sms)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list SMS services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<SmsServiceListItem> = services
        .into_iter()
        .filter_map(|s| {
            if let ToolServiceConfig::Sms(config) = s.config {
                Some(SmsServiceListItem {
                    name: s.code,
                    display_name: s.name,
                    description: s.description,
                    provider: format!("{:?}", config.provider).to_lowercase(),
                    api_key: "******".to_string(),
                    api_secret: "******".to_string(),
                    sign_name: config.sign_name,
                    region: config.region,
                    enabled: s.enabled,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(Json(serde_json::json!({
        "configs": items,
        "total": items.len()
    })))
}

async fn create_sms_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSmsServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let provider = parse_sms_provider(&req.provider);

    let config = ToolServiceConfig::Sms(SmsConfig {
        provider,
        api_key: req.api_key,
        api_secret: req.api_secret,
        sign_name: req.sign_name,
        region: req.region,
    });

    let service = ToolService::new(
        ToolType::Sms,
        &req.name,
        &req.display_name,
        config,
        &req.tenant_id,
    );

    let saved = state
        .tool_service_store()
        .save_service(&req.tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": saved.code,
            "display_name": saved.name,
            "enabled": saved.enabled
        })),
    ))
}

async fn get_sms_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Sms, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let ToolServiceConfig::Sms(config) = service.config {
        Ok(Json(serde_json::json!({
            "name": service.code,
            "display_name": service.name,
            "description": service.description,
            "provider": format!("{:?}", config.provider).to_lowercase(),
            "api_key": "***",
            "api_secret": config.api_secret.as_ref().map(|_| "***"),
            "sign_name": config.sign_name,
            "region": config.region,
            "enabled": service.enabled
        })))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn update_sms_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let tenant_id = req
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let mut service = state
        .tool_service_store()
        .get_service_by_code(tenant_id, ToolType::Sms, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(display_name) = req.get("display_name").and_then(|v| v.as_str()) {
        service.name = display_name.to_string();
    }
    if let Some(enabled) = req.get("enabled").and_then(|v| v.as_bool()) {
        service.enabled = enabled;
    }

    let saved = state
        .tool_service_store()
        .save_service(tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": saved.code,
        "display_name": saved.name,
        "enabled": saved.enabled,
        "updated": true
    })))
}

async fn delete_sms_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Sms, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    state
        .tool_service_store()
        .delete_service(&query.tenant_id, &service.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete SMS service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

fn parse_sms_provider(s: &str) -> SmsProvider {
    match s.to_lowercase().as_str() {
        "aliyun" | "ali" => SmsProvider::Aliyun,
        "tencent" | "qcloud" => SmsProvider::Tencent,
        "twilio" => SmsProvider::Twilio,
        _ => SmsProvider::Aliyun,
    }
}

// ==================== Svc 微服务处理器 ====================

/// Svc 服务列表项
#[derive(Serialize)]
pub struct SvcServiceListItem {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub discovery_type: String,
    pub endpoints: Option<Vec<String>>,
    pub consul_address: Option<String>,
    pub k8s_service_name: Option<String>,
    pub k8s_namespace: Option<String>,
    pub protocol: String,
    pub load_balancer: String,
    pub timeout_ms: u64,
    pub enabled: bool,
}

/// 创建 Svc 服务请求
#[derive(Deserialize)]
pub struct CreateSvcServiceRequest {
    pub name: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub discovery_type: String,
    #[serde(default)]
    pub endpoints: Option<Vec<String>>,
    #[serde(default)]
    pub consul_address: Option<String>,
    #[serde(default)]
    pub k8s_service_name: Option<String>,
    #[serde(default)]
    pub k8s_namespace: Option<String>,
    #[serde(default = "default_protocol")]
    pub protocol: String,
    #[serde(default = "default_load_balancer")]
    pub load_balancer: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default = "default_tenant")]
    pub tenant_id: String,
}

fn default_protocol() -> String {
    "http".to_string()
}

fn default_load_balancer() -> String {
    "round_robin".to_string()
}

async fn list_svc_services(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let services = state
        .tool_service_store()
        .list_services_by_type(&query.tenant_id, ToolType::Svc)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list Svc services: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let items: Vec<SvcServiceListItem> = services
        .into_iter()
        .filter_map(|s| {
            if let ToolServiceConfig::Svc(config) = s.config {
                let (discovery_type, endpoints, consul_address, k8s_service_name, k8s_namespace) =
                    match &config.discovery {
                        ServiceDiscovery::Static { endpoints } => {
                            ("static", Some(endpoints.clone()), None, None, None)
                        }
                        ServiceDiscovery::Consul {
                            address,
                            service_name,
                        } => (
                            "consul",
                            None,
                            Some(address.clone()),
                            Some(service_name.clone()),
                            None,
                        ),
                        ServiceDiscovery::K8sDns {
                            service_name,
                            namespace,
                        } => (
                            "k8s_dns",
                            None,
                            None,
                            Some(service_name.clone()),
                            Some(namespace.clone()),
                        ),
                    };
                Some(SvcServiceListItem {
                    name: s.code,
                    display_name: s.name,
                    description: s.description,
                    discovery_type: discovery_type.to_string(),
                    endpoints,
                    consul_address,
                    k8s_service_name,
                    k8s_namespace,
                    protocol: format!("{:?}", config.protocol).to_lowercase(),
                    load_balancer: format!("{:?}", config.load_balancer).to_lowercase(),
                    timeout_ms: config.timeout_ms,
                    enabled: s.enabled,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(Json(serde_json::json!({
        "configs": items,
        "total": items.len()
    })))
}

async fn create_svc_service(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSvcServiceRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let discovery = parse_service_discovery(
        &req.discovery_type,
        req.endpoints,
        req.consul_address,
        req.k8s_service_name,
        req.k8s_namespace,
    );
    let protocol = parse_service_protocol(&req.protocol);
    let load_balancer = parse_load_balancer(&req.load_balancer);

    let config = ToolServiceConfig::Svc(SvcConfig {
        discovery,
        protocol,
        timeout_ms: req.timeout_ms,
        load_balancer,
    });

    let service = ToolService::new(
        ToolType::Svc,
        &req.name,
        &req.display_name,
        config,
        &req.tenant_id,
    );

    let saved = state
        .tool_service_store()
        .save_service(&req.tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "name": saved.code,
            "display_name": saved.name,
            "enabled": saved.enabled
        })),
    ))
}

async fn get_svc_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Svc, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let ToolServiceConfig::Svc(config) = service.config {
        let (discovery_type, endpoints, consul_address, k8s_service_name, k8s_namespace) =
            match &config.discovery {
                ServiceDiscovery::Static { endpoints } => {
                    ("static", Some(endpoints.clone()), None, None, None)
                }
                ServiceDiscovery::Consul {
                    address,
                    service_name,
                } => (
                    "consul",
                    None,
                    Some(address.clone()),
                    Some(service_name.clone()),
                    None,
                ),
                ServiceDiscovery::K8sDns {
                    service_name,
                    namespace,
                } => (
                    "k8s_dns",
                    None,
                    None,
                    Some(service_name.clone()),
                    Some(namespace.clone()),
                ),
            };

        Ok(Json(serde_json::json!({
            "name": service.code,
            "display_name": service.name,
            "description": service.description,
            "discovery_type": discovery_type,
            "endpoints": endpoints,
            "consul_address": consul_address,
            "k8s_service_name": k8s_service_name,
            "k8s_namespace": k8s_namespace,
            "protocol": format!("{:?}", config.protocol).to_lowercase(),
            "load_balancer": format!("{:?}", config.load_balancer).to_lowercase(),
            "timeout_ms": config.timeout_ms,
            "enabled": service.enabled
        })))
    } else {
        Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
}

async fn update_svc_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let tenant_id = req
        .get("tenant_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default");

    let mut service = state
        .tool_service_store()
        .get_service_by_code(tenant_id, ToolType::Svc, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    if let Some(display_name) = req.get("display_name").and_then(|v| v.as_str()) {
        service.name = display_name.to_string();
    }
    if let Some(enabled) = req.get("enabled").and_then(|v| v.as_bool()) {
        service.enabled = enabled;
    }

    let saved = state
        .tool_service_store()
        .save_service(tenant_id, service)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "name": saved.code,
        "display_name": saved.name,
        "enabled": saved.enabled,
        "updated": true
    })))
}

async fn delete_svc_service(
    State(state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let service = state
        .tool_service_store()
        .get_service_by_code(&query.tenant_id, ToolType::Svc, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    state
        .tool_service_store()
        .delete_service(&query.tenant_id, &service.id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete Svc service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "deleted_name": name
    })))
}

async fn check_svc_health(
    State(_state): State<Arc<AppState>>,
    Path(name): Path<String>,
    Query(_query): Query<TenantQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "name": name,
        "healthy": true,
        "message": "Health check not implemented yet"
    })))
}

fn parse_service_discovery(
    discovery_type: &str,
    endpoints: Option<Vec<String>>,
    consul_address: Option<String>,
    k8s_service_name: Option<String>,
    k8s_namespace: Option<String>,
) -> ServiceDiscovery {
    match discovery_type.to_lowercase().as_str() {
        "static" => ServiceDiscovery::Static {
            endpoints: endpoints.unwrap_or_default(),
        },
        "consul" => ServiceDiscovery::Consul {
            address: consul_address.unwrap_or_else(|| "localhost:8500".to_string()),
            service_name: k8s_service_name.unwrap_or_default(),
        },
        "k8s_dns" | "k8s" | "kubernetes" => ServiceDiscovery::K8sDns {
            service_name: k8s_service_name.unwrap_or_default(),
            namespace: k8s_namespace.unwrap_or_else(|| "default".to_string()),
        },
        _ => ServiceDiscovery::Static {
            endpoints: endpoints.unwrap_or_default(),
        },
    }
}

fn parse_service_protocol(s: &str) -> ServiceProtocol {
    match s.to_lowercase().as_str() {
        "http" => ServiceProtocol::Http,
        "grpc" => ServiceProtocol::Grpc,
        _ => ServiceProtocol::Http,
    }
}

fn parse_load_balancer(s: &str) -> LoadBalancer {
    match s.to_lowercase().as_str() {
        "round_robin" | "roundrobin" => LoadBalancer::RoundRobin,
        "random" => LoadBalancer::Random,
        "least_connections" | "leastconnections" => LoadBalancer::LeastConnections,
        "weighted" => LoadBalancer::Weighted,
        _ => LoadBalancer::RoundRobin,
    }
}
