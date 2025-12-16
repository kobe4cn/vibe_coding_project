use axum::Router;
use sqlx::PgPool;

use crate::config::Config;

pub mod health;
pub mod tickets;
pub mod tags;
pub mod attachments;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
}

pub fn api_router() -> Router<AppState> {
    Router::new()
        .merge(tickets::router())
        .merge(tags::router())
        .merge(attachments::router())
}

