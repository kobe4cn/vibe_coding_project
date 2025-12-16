use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Invalid status transition from '{from}' to '{to}'")]
    InvalidTransition {
        from: String,
        to: String,
        allowed: Vec<String>,
    },

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("File too large")]
    FileTooLarge,

    #[error("Unsupported media type: {0}")]
    UnsupportedMediaType(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type, message, extra) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "not_found", msg.clone(), None),
            AppError::BadRequest(msg) => {
                (StatusCode::BAD_REQUEST, "bad_request", msg.clone(), None)
            }
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "conflict", msg.clone(), None),
            AppError::Validation(msg) => {
                (StatusCode::UNPROCESSABLE_ENTITY, "validation_error", msg.clone(), None)
            }
            AppError::InvalidTransition { from, to, allowed } => (
                StatusCode::BAD_REQUEST,
                "invalid_transition",
                format!("Cannot transition from '{}' to '{}'", from, to),
                Some(json!({
                    "current_status": from,
                    "target_status": to,
                    "allowed_transitions": allowed
                })),
            ),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database_error",
                    "Database error".to_string(),
                    None,
                )
            }
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "Internal server error".to_string(),
                    None,
                )
            }
            AppError::FileTooLarge => (
                StatusCode::PAYLOAD_TOO_LARGE,
                "file_too_large",
                "File size exceeds maximum allowed".to_string(),
                None,
            ),
            AppError::UnsupportedMediaType(msg) => (
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "unsupported_media_type",
                msg.clone(),
                None,
            ),
        };

        let mut body = json!({
            "error": error_type,
            "message": message
        });

        if let Some(extra) = extra {
            if let serde_json::Value::Object(map) = extra {
                for (k, v) in map {
                    body[k] = v;
                }
            }
        }

        (status, Json(body)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

