use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, patch, post},
};
use uuid::Uuid;

use crate::{
    error::Result,
    handlers,
    models::{
        AddTagRequest, CreateTicketRequest, HistoryQuery, HistoryResponse, PaginatedResponse,
        TicketQuery, TicketWithTags, UpdateStatusRequest, UpdateTicketRequest,
    },
};

use super::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/tickets", get(list_tickets).post(create_ticket))
        .route(
            "/tickets/{id}",
            get(get_ticket).put(update_ticket).delete(delete_ticket),
        )
        .route("/tickets/{id}/status", patch(update_status))
        .route("/tickets/{id}/history", get(get_history))
        .route("/tickets/{id}/tags", post(add_tag))
        .route("/tickets/{id}/tags/{tag_id}", delete(remove_tag))
}

async fn list_tickets(
    State(state): State<AppState>,
    Query(query): Query<TicketQuery>,
) -> Result<Json<PaginatedResponse<TicketWithTags>>> {
    let result = handlers::tickets::list_tickets(&state.db, query).await?;
    Ok(Json(result))
}

async fn create_ticket(
    State(state): State<AppState>,
    Json(req): Json<CreateTicketRequest>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::create_ticket(&state.db, req).await?;
    Ok(Json(ticket))
}

async fn get_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::get_ticket(&state.db, id).await?;
    Ok(Json(ticket))
}

async fn update_ticket(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTicketRequest>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::update_ticket(&state.db, id, req).await?;
    Ok(Json(ticket))
}

async fn delete_ticket(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<()> {
    handlers::tickets::delete_ticket(&state.db, id).await?;
    Ok(())
}

async fn update_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateStatusRequest>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::update_status(&state.db, id, req).await?;
    Ok(Json(ticket))
}

async fn add_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<AddTagRequest>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::add_tag(&state.db, id, req.tag_id).await?;
    Ok(Json(ticket))
}

async fn remove_tag(
    State(state): State<AppState>,
    Path((id, tag_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<TicketWithTags>> {
    let ticket = handlers::tickets::remove_tag(&state.db, id, tag_id).await?;
    Ok(Json(ticket))
}

async fn get_history(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<HistoryResponse>> {
    let history = handlers::ticket_history::list_history(&state.db, id, query).await?;
    Ok(Json(history))
}
