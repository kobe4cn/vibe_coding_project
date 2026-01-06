//! Runtime error types

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;

/// Runtime error type
#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Execution error: {0}")]
    Execution(String),
}

impl RuntimeError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            RuntimeError::NotFound(_) => StatusCode::NOT_FOUND,
            RuntimeError::BadRequest(_) | RuntimeError::Validation(_) => StatusCode::BAD_REQUEST,
            RuntimeError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            RuntimeError::Forbidden(_) => StatusCode::FORBIDDEN,
            RuntimeError::Conflict(_) => StatusCode::CONFLICT,
            RuntimeError::Internal(_) | RuntimeError::Database(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
            RuntimeError::Execution(_) => StatusCode::UNPROCESSABLE_ENTITY,
        }
    }
}

impl IntoResponse for RuntimeError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = json!({
            "error": self.to_string(),
            "code": status.as_u16(),
        });
        (status, Json(body)).into_response()
    }
}

impl From<fdl_executor::ExecutorError> for RuntimeError {
    fn from(err: fdl_executor::ExecutorError) -> Self {
        RuntimeError::Execution(err.to_string())
    }
}

impl From<fdl_auth::AuthError> for RuntimeError {
    fn from(err: fdl_auth::AuthError) -> Self {
        match err {
            fdl_auth::AuthError::MissingAuthHeader
            | fdl_auth::AuthError::InvalidAuthHeader
            | fdl_auth::AuthError::InvalidToken(_)
            | fdl_auth::AuthError::TokenExpired => RuntimeError::Unauthorized(err.to_string()),
            fdl_auth::AuthError::InsufficientPermissions
            | fdl_auth::AuthError::TenantNotFound(_)
            | fdl_auth::AuthError::TenantDisabled => RuntimeError::Forbidden(err.to_string()),
            fdl_auth::AuthError::QuotaExceeded(_) => RuntimeError::Forbidden(err.to_string()),
            fdl_auth::AuthError::ValidationError(_) => RuntimeError::BadRequest(err.to_string()),
            fdl_auth::AuthError::Internal(_) => RuntimeError::Internal(err.to_string()),
        }
    }
}

impl From<sqlx::Error> for RuntimeError {
    fn from(err: sqlx::Error) -> Self {
        RuntimeError::Database(err.to_string())
    }
}

/// Runtime result type
pub type RuntimeResult<T> = Result<T, RuntimeError>;
