//! API routes

pub mod auth;
pub mod execute;
pub mod flows;
pub mod health;

use crate::state::AppState;
use axum::Router;
use std::sync::Arc;

/// Build the API router
pub fn api_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .nest("/health", health::routes())
        .nest("/auth", auth::routes())
        .nest("/flows", flows::routes())
        .nest("/execute", execute::routes())
        .with_state(state)
}
