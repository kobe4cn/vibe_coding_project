use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use uuid::Uuid;

use crate::{
    error::Result,
    handlers,
    models::{CreateTagRequest, Tag, UpdateTagRequest},
};

use super::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/tags", get(list_tags).post(create_tag))
        .route(
            "/tags/{id}",
            get(get_tag).put(update_tag).delete(delete_tag),
        )
}

async fn list_tags(State(state): State<AppState>) -> Result<Json<Vec<Tag>>> {
    let tags = handlers::tags::list_tags(&state.db).await?;
    Ok(Json(tags))
}

async fn create_tag(
    State(state): State<AppState>,
    Json(req): Json<CreateTagRequest>,
) -> Result<Json<Tag>> {
    let tag = handlers::tags::create_tag(&state.db, req).await?;
    Ok(Json(tag))
}

async fn get_tag(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Tag>> {
    let tag = handlers::tags::get_tag(&state.db, id).await?;
    Ok(Json(tag))
}

async fn update_tag(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTagRequest>,
) -> Result<Json<Tag>> {
    let tag = handlers::tags::update_tag(&state.db, id, req).await?;
    Ok(Json(tag))
}

async fn delete_tag(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<()> {
    handlers::tags::delete_tag(&state.db, id).await?;
    Ok(())
}
