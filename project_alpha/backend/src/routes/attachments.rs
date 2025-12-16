use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::header,
    response::Response,
    routing::{delete, get},
    Json, Router,
};
use uuid::Uuid;

use crate::{error::Result, handlers, models::AttachmentResponse};

use super::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/tickets/{id}/attachments",
            get(list_attachments).post(upload_attachment),
        )
        .route("/attachments/{id}", delete(delete_attachment))
        .route("/attachments/{id}/download", get(download_attachment))
}

async fn list_attachments(
    State(state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
) -> Result<Json<Vec<AttachmentResponse>>> {
    let attachments = handlers::attachments::list_attachments(&state.db, ticket_id).await?;
    Ok(Json(attachments))
}

async fn upload_attachment(
    State(state): State<AppState>,
    Path(ticket_id): Path<Uuid>,
    multipart: Multipart,
) -> Result<Json<AttachmentResponse>> {
    let attachment =
        handlers::attachments::upload_attachment(&state.db, &state.config, ticket_id, multipart)
            .await?;
    Ok(Json(attachment))
}

async fn delete_attachment(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<()> {
    handlers::attachments::delete_attachment(&state.db, &state.config, id).await?;
    Ok(())
}

async fn download_attachment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Response<Body>> {
    let (attachment, file_bytes) =
        handlers::attachments::get_attachment_file(&state.db, &state.config, id).await?;

    let response = Response::builder()
        .header(header::CONTENT_TYPE, &attachment.content_type)
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", attachment.filename),
        )
        .body(Body::from(file_bytes))
        .unwrap();

    Ok(response)
}
