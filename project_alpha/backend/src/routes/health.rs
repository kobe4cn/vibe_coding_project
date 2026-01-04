use axum::{Json, Router, routing::get};
use serde_json::{Value, json};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use super::AppState;

// Global start time for uptime calculation (thread-safe)
static START_TIME: OnceLock<u64> = OnceLock::new();

pub fn router() -> Router<AppState> {
    // Initialize start time (thread-safe, only runs once)
    START_TIME.get_or_init(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("System time before UNIX epoch")
            .as_secs()
    });

    Router::new()
        .route("/health", get(health_check))
        .route("/health/ready", get(readiness_check))
        .route("/health/uptime", get(uptime_check))
}

async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

async fn readiness_check(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Json<Value> {
    let db_check = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();

    let status = if db_check { "ok" } else { "degraded" };

    Json(json!({
        "status": status,
        "checks": {
            "database": if db_check { "ok" } else { "error" }
        }
    }))
}

async fn uptime_check() -> Json<Value> {
    let current_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("System time before UNIX epoch")
        .as_secs();

    let start_time = START_TIME.get().copied().unwrap_or(current_time);
    let uptime_secs = current_time - start_time;

    let hours = uptime_secs / 3600;
    let minutes = (uptime_secs % 3600) / 60;
    let seconds = uptime_secs % 60;

    Json(json!({
        "status": "ok",
        "uptime_seconds": uptime_secs,
        "uptime_formatted": format!("{}h {}m {}s", hours, minutes, seconds)
    }))
}
