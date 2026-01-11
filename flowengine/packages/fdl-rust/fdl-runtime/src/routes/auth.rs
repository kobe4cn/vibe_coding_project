//! 认证路由
//!
//! 提供用户认证和 token 刷新功能。
//! 注意：当前实现为占位符，生产环境需要验证用户名密码。

use crate::state::AppState;
use axum::{Json, Router, extract::State, routing::post};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// 登录请求
#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
    pub tenant_id: Option<String>,
}

/// Login response
#[derive(Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

/// Token refresh request
#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Build auth routes
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/login", post(login))
        .route("/refresh", post(refresh_token))
}

async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Json<serde_json::Value> {
    // 注意：这是占位符实现，生产环境需要验证用户名密码
    // 应该查询数据库验证用户凭据，并根据用户信息设置角色
    let tenant_id = req.tenant_id.unwrap_or_else(|| "default".to_string());

    match state.jwt_service.generate_access_token(
        &req.username,
        &tenant_id,
        "BU001",                    // 默认业务单元，应从用户信息中获取
        vec!["editor".to_string()], // 默认角色，应从用户信息中获取
    ) {
        Ok(access_token) => {
            let refresh_token = state
                .jwt_service
                .generate_refresh_token(&req.username, &tenant_id)
                .unwrap_or_default();

            Json(serde_json::json!({
                "access_token": access_token,
                "refresh_token": refresh_token,
                "expires_in": 3600,
                "token_type": "Bearer"
            }))
        }
        Err(e) => Json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}

async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RefreshRequest>,
) -> Json<serde_json::Value> {
    match state.jwt_service.validate_token(&req.refresh_token) {
        Ok(claims) => {
            if claims.roles.contains(&"refresh".to_string()) {
                match state.jwt_service.generate_access_token(
                    &claims.sub,
                    &claims.tenant_id,
                    "BU001",
                    vec!["editor".to_string()],
                ) {
                    Ok(access_token) => Json(serde_json::json!({
                        "access_token": access_token,
                        "expires_in": 3600,
                        "token_type": "Bearer"
                    })),
                    Err(e) => Json(serde_json::json!({
                        "error": e.to_string()
                    })),
                }
            } else {
                Json(serde_json::json!({
                    "error": "Invalid refresh token"
                }))
            }
        }
        Err(e) => Json(serde_json::json!({
            "error": e.to_string()
        })),
    }
}
