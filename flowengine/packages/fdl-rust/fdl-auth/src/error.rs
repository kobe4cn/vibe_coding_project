//! Authentication error types

use thiserror::Error;

/// Authentication error type
#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Missing authorization header")]
    MissingAuthHeader,

    #[error("Invalid authorization header format")]
    InvalidAuthHeader,

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Insufficient permissions")]
    InsufficientPermissions,

    #[error("Tenant not found: {0}")]
    TenantNotFound(String),

    #[error("Tenant disabled")]
    TenantDisabled,

    #[error("Quota exceeded: {0}")]
    QuotaExceeded(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl AuthError {
    pub fn status_code(&self) -> u16 {
        match self {
            AuthError::MissingAuthHeader
            | AuthError::InvalidAuthHeader
            | AuthError::InvalidToken(_)
            | AuthError::TokenExpired => 401,
            AuthError::InsufficientPermissions => 403,
            AuthError::TenantNotFound(_) | AuthError::TenantDisabled => 403,
            AuthError::QuotaExceeded(_) => 429,
            AuthError::ValidationError(_) => 400,
            AuthError::Internal(_) => 500,
        }
    }
}

/// Authentication result type
pub type AuthResult<T> = Result<T, AuthError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_status_codes() {
        assert_eq!(AuthError::MissingAuthHeader.status_code(), 401);
        assert_eq!(AuthError::InvalidAuthHeader.status_code(), 401);
        assert_eq!(AuthError::InvalidToken("test".to_string()).status_code(), 401);
        assert_eq!(AuthError::TokenExpired.status_code(), 401);
        assert_eq!(AuthError::InsufficientPermissions.status_code(), 403);
        assert_eq!(AuthError::TenantNotFound("t1".to_string()).status_code(), 403);
        assert_eq!(AuthError::TenantDisabled.status_code(), 403);
        assert_eq!(AuthError::QuotaExceeded("limit".to_string()).status_code(), 429);
        assert_eq!(AuthError::Internal("error".to_string()).status_code(), 500);
    }

    #[test]
    fn test_error_display() {
        assert_eq!(
            format!("{}", AuthError::MissingAuthHeader),
            "Missing authorization header"
        );
        assert_eq!(
            format!("{}", AuthError::TokenExpired),
            "Token expired"
        );
        assert_eq!(
            format!("{}", AuthError::QuotaExceeded("daily limit".to_string())),
            "Quota exceeded: daily limit"
        );
    }
}
