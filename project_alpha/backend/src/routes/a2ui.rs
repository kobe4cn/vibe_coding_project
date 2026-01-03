//! A2UI Routes
//!
//! SSE and action endpoints for A2UI surfaces.

use axum::{
    routing::{get, post},
    Router,
};

use crate::handlers::a2ui;
use crate::routes::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Tickets list
        .route("/a2ui/tickets/stream", get(a2ui::tickets_stream))
        .route("/a2ui/tickets/action", post(a2ui::tickets_action))
        // Ticket create form (must be before {id} routes)
        .route("/a2ui/tickets/create/stream", get(a2ui::ticket_create_stream))
        .route("/a2ui/tickets/create/action", post(a2ui::ticket_create_action))
        // Ticket edit form
        .route("/a2ui/tickets/{id}/edit/stream", get(a2ui::ticket_edit_stream))
        .route("/a2ui/tickets/{id}/edit/action", post(a2ui::ticket_edit_action))
        // Ticket detail
        .route("/a2ui/tickets/{id}/stream", get(a2ui::ticket_detail_stream))
        .route("/a2ui/tickets/{id}/action", post(a2ui::ticket_detail_action))
        // Tags
        .route("/a2ui/tags/stream", get(a2ui::tags_stream))
        .route("/a2ui/tags/action", post(a2ui::tags_action))
}
