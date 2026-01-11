//! Tool error types

use thiserror::Error;

/// Tool error type
#[derive(Debug, Error)]
pub enum ToolError {
    #[error("Invalid URI: {0}")]
    InvalidUri(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("HTTP error: {status} - {message}")]
    HttpError { status: u16, message: String },

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Network error: {0}")]
    NetworkError(String),
}

/// Tool result type
pub type ToolResult<T> = Result<T, ToolError>;
