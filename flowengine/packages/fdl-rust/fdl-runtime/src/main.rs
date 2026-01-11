//! FDL Runtime 服务器
//!
//! FDL 运行时服务的主入口点，提供：
//! - REST API 端点（流程管理、执行等）
//! - WebSocket 支持（实时执行更新）
//! - OpenAPI 文档（Swagger UI）
//! - 多租户支持
//! - 数据库和内存存储后端

use axum::{Json, Router, routing::get};
use fdl_runtime::{
    routes,
    state::{AppState, ServerConfig},
    ws,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// OpenAPI documentation
#[derive(OpenApi)]
#[openapi(
    info(
        title = "FDL Runtime API",
        version = "0.1.0",
        description = "Flow Definition Language Runtime Service API"
    ),
    paths(
        root
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "auth", description = "Authentication endpoints"),
        (name = "flows", description = "Flow management endpoints"),
        (name = "execute", description = "Flow execution endpoints"),
        (name = "websocket", description = "WebSocket endpoints")
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() {
    // 加载 .env 文件（如果存在，忽略文件不存在的错误）
    dotenvy::dotenv().ok();

    // 初始化日志追踪系统
    // 支持通过 RUST_LOG 环境变量控制日志级别
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "fdl_server=info,fdl_runtime=debug,fdl_executor=debug,fdl_tools=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // 从环境变量加载配置
    let config = ServerConfig::from_env();
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));

    tracing::info!("Configuration loaded:");
    tracing::info!("  Host: {}", config.host);
    tracing::info!("  Port: {}", config.port);
    tracing::info!("  Dev mode: {}", config.dev_mode);
    tracing::info!("  Database enabled: {}", config.database.enabled);
    if config.database.enabled {
        tracing::info!(
            "  Database URL: {}",
            config
                .database
                .url
                .as_ref()
                .map(|u| {
                    // Mask password in URL for logging
                    if let Some(at_pos) = u.find('@')
                        && let Some(colon_pos) = u[..at_pos].rfind(':')
                    {
                        return format!("{}:***@{}", &u[..colon_pos], &u[at_pos + 1..]);
                    }
                    u.clone()
                })
                .unwrap_or_else(|| "not set".to_string())
        );
        tracing::info!("  Pool size: {}", config.database.pool_size);
    }

    // 创建应用状态（共享所有处理器）
    // 包含 JWT 服务、存储后端、执行器管理等
    let state = Arc::new(AppState::with_config(config).await);

    // 构建路由
    let app = Router::new()
        // 根端点（服务信息）
        .route("/", get(root))
        // Swagger UI（同时提供 /openapi.json 端点）
        .merge(SwaggerUi::new("/swagger-ui").url("/openapi.json", ApiDoc::openapi()))
        // API 路由（流程管理、执行等）
        .nest("/api", routes::api_routes(state.clone()))
        // WebSocket 端点（实时执行更新）
        .route("/ws", get(ws::ws_handler))
        // 中间件
        .layer(TraceLayer::new_for_http()) // HTTP 请求追踪
        .layer(CorsLayer::permissive()) // CORS 支持（开发模式）
        .with_state(state);

    // Start server
    tracing::info!("FDL Runtime starting on http://{}", addr);
    tracing::info!("Swagger UI available at http://{}/swagger-ui/", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Root endpoint
#[utoipa::path(
    get,
    path = "/",
    responses(
        (status = 200, description = "Service information", body = String)
    )
)]
async fn root() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "name": "FDL Runtime Service",
        "version": env!("CARGO_PKG_VERSION"),
        "status": "running",
        "endpoints": {
            "api": "/api",
            "websocket": "/ws",
            "swagger": "/swagger-ui/",
            "openapi": "/openapi.json"
        }
    }))
}
