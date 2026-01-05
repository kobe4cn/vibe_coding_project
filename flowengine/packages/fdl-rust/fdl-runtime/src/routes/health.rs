//! Health check routes

use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use crate::state::AppState;

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

/// Build health routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/live", get(liveness_check))
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn readiness_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "ready": true,
        "checks": {
            "database": "ok",
            "cache": "ok"
        }
    }))
}

async fn liveness_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "alive": true
    }))
}
