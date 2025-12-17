use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

use super::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/health/ready", get(readiness_check))
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
