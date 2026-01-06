//! API 路由模块
//!
//! 组织所有 API 端点，包括：
//! - 健康检查
//! - 认证
//! - 流程管理
//! - 流程执行
//! - 工具管理（API 服务、数据源、UDF）

pub mod api_keys;
pub mod auth;
pub mod execute;
pub mod external;
pub mod flows;
pub mod health;
pub mod tools;

use crate::state::AppState;
use axum::Router;
use std::sync::Arc;

/// 构建 API 路由器
///
/// 将所有子路由模块组合成统一的 API 路由树。
pub fn api_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .nest("/health", health::routes())
        .nest("/auth", auth::routes())
        .nest("/flows", flows::routes())
        .nest("/execute", execute::routes())
        .nest("/tools", tools::routes())
        // 外部 API v1 端点（使用 API Key 认证）
        .nest("/v1", external::routes())
        .with_state(state)
}
