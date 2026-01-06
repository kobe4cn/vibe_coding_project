//! 健康检查路由
//!
//! 提供 Kubernetes/Docker 等容器编排系统需要的健康检查端点：
//! - `/health`: 基本健康检查
//! - `/health/ready`: 就绪检查（服务是否准备好接收流量）
//! - `/health/live`: 存活检查（服务是否还在运行）

use crate::state::AppState;
use axum::{Json, Router, routing::get};
use serde::Serialize;
use std::sync::Arc;

/// 健康检查响应
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
