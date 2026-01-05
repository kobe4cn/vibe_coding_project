//! FDL Runtime Server
//!
//! Main entry point for the FDL runtime service.

use axum::{routing::get, Json, Router};
use fdl_runtime::{routes, state::{AppState, ServerConfig}, ws};
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
    // Load .env file if it exists (ignores errors if file doesn't exist)
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "fdl_server=info,fdl_runtime=debug,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration
    let config = ServerConfig::from_env();
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));

    tracing::info!("Configuration loaded:");
    tracing::info!("  Host: {}", config.host);
    tracing::info!("  Port: {}", config.port);
    tracing::info!("  Dev mode: {}", config.dev_mode);
    tracing::info!("  Database enabled: {}", config.database.enabled);
    if config.database.enabled {
        tracing::info!("  Database URL: {}", config.database.url.as_ref().map(|u| {
            // Mask password in URL for logging
            if let Some(at_pos) = u.find('@') {
                if let Some(colon_pos) = u[..at_pos].rfind(':') {
                    return format!("{}:***@{}", &u[..colon_pos], &u[at_pos+1..]);
                }
            }
            u.clone()
        }).unwrap_or_else(|| "not set".to_string()));
        tracing::info!("  Pool size: {}", config.database.pool_size);
    }

    // Create application state
    let state = Arc::new(AppState::with_config(config).await);

    // Build router
    let app = Router::new()
        // Root endpoint
        .route("/", get(root))
        // Swagger UI (also provides /openapi.json endpoint)
        .merge(SwaggerUi::new("/swagger-ui").url("/openapi.json", ApiDoc::openapi()))
        // API routes
        .nest("/api", routes::api_routes(state.clone()))
        // WebSocket endpoint
        .route("/ws", get(ws::ws_handler))
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
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

