//! Axum 认证中间件
//!
//! 提供 HTTP 请求的认证拦截和 claims 注入功能，支持：
//! - Bearer token 验证
//! - 开发模式（可选认证）
//! - Claims 注入到请求扩展中

use crate::error::AuthError;
use crate::jwt::{Claims, JwtService};
use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use chrono::Utc;
use std::sync::Arc;

/// Axum 认证层
/// 
/// 配置认证中间件的行为，包括是否必需认证、开发模式等。
#[derive(Clone)]
pub struct AuthLayer {
    jwt_service: Arc<JwtService>,
    optional: bool,
    dev_mode: bool,
    dev_claims: Option<Claims>,
}

impl AuthLayer {
    /// Create a new authentication layer
    pub fn new(jwt_service: Arc<JwtService>) -> Self {
        Self {
            jwt_service,
            optional: false,
            dev_mode: false,
            dev_claims: None,
        }
    }

    /// Create an optional authentication layer (for development)
    /// When no token is provided, requests proceed without claims
    pub fn optional(jwt_service: Arc<JwtService>) -> Self {
        Self {
            jwt_service,
            optional: true,
            dev_mode: false,
            dev_claims: None,
        }
    }

    /// Create a development mode authentication layer
    /// When no token is provided, default dev claims are used
    pub fn dev_mode(jwt_service: Arc<JwtService>) -> Self {
        let now = Utc::now();
        Self {
            jwt_service,
            optional: true,
            dev_mode: true,
            dev_claims: Some(Claims {
                sub: "dev-user".to_string(),
                tenant_id: "dev-tenant".to_string(),
                bu_code: "DEV".to_string(),
                roles: vec!["admin".to_string()],
                iat: now.timestamp(),
                exp: (now + chrono::Duration::days(365)).timestamp(),
                iss: "fdl-dev".to_string(),
            }),
        }
    }

    /// Create a development mode layer with custom claims
    pub fn dev_mode_with_claims(jwt_service: Arc<JwtService>, claims: Claims) -> Self {
        Self {
            jwt_service,
            optional: true,
            dev_mode: true,
            dev_claims: Some(claims),
        }
    }

    /// Check if running in development mode
    pub fn is_dev_mode(&self) -> bool {
        self.dev_mode
    }

    /// Check if authentication is optional
    pub fn is_optional(&self) -> bool {
        self.optional
    }
}

/// 认证中间件函数
/// 
/// 从请求头中提取 Bearer token，验证后注入 claims 到请求扩展中。
/// 支持可选认证和开发模式，方便开发和测试。
pub async fn auth_middleware(layer: AuthLayer, mut request: Request<Body>, next: Next) -> Response {
    // 提取 Authorization 头
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok());

    let claims = match auth_header {
        Some(header) => {
            // 解析 Bearer token
            if !header.starts_with("Bearer ") {
                if layer.optional {
                    // 可选认证模式：开发模式下使用默认 claims
                    if layer.dev_mode {
                        layer.dev_claims.clone()
                    } else {
                        None
                    }
                } else {
                    return AuthError::InvalidAuthHeader.into_response();
                }
            } else {
                let token = &header[7..]; // 跳过 "Bearer " 前缀
                match layer.jwt_service.validate_token(token) {
                    Ok(claims) => Some(claims),
                    Err(e) => {
                        if layer.optional {
                            // 可选认证模式：验证失败时，开发模式使用默认 claims
                            if layer.dev_mode {
                                layer.dev_claims.clone()
                            } else {
                                None
                            }
                        } else {
                            return e.into_response();
                        }
                    }
                }
            }
        }
        None => {
            if layer.optional {
                // 没有 token：可选认证模式下，开发模式使用默认 claims
                if layer.dev_mode {
                    layer.dev_claims.clone()
                } else {
                    None
                }
            } else {
                return AuthError::MissingAuthHeader.into_response();
            }
        }
    };

    // 将 claims 注入到请求扩展中，供后续处理器使用
    if let Some(claims) = claims {
        request.extensions_mut().insert(claims);
    }

    next.run(request).await
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.status_code()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        let body = serde_json::json!({
            "error": self.to_string(),
            "code": self.status_code(),
        });
        (status, axum::Json(body)).into_response()
    }
}

/// Extract claims from request
pub fn extract_claims(request: &Request<Body>) -> Option<&Claims> {
    request.extensions().get::<Claims>()
}

/// Extract bearer token from Authorization header
pub fn extract_bearer_token(request: &Request<Body>) -> Option<String> {
    request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .filter(|h| h.starts_with("Bearer "))
        .map(|h| h[7..].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jwt::JwtConfig;

    fn create_test_jwt_service() -> Arc<JwtService> {
        Arc::new(JwtService::new(JwtConfig::default()))
    }

    #[test]
    fn test_auth_layer_new() {
        let jwt_service = create_test_jwt_service();
        let layer = AuthLayer::new(jwt_service);
        assert!(!layer.is_optional());
        assert!(!layer.is_dev_mode());
    }

    #[test]
    fn test_auth_layer_optional() {
        let jwt_service = create_test_jwt_service();
        let layer = AuthLayer::optional(jwt_service);
        assert!(layer.is_optional());
        assert!(!layer.is_dev_mode());
    }

    #[test]
    fn test_auth_layer_dev_mode() {
        let jwt_service = create_test_jwt_service();
        let layer = AuthLayer::dev_mode(jwt_service);
        assert!(layer.is_optional());
        assert!(layer.is_dev_mode());
        assert!(layer.dev_claims.is_some());

        let claims = layer.dev_claims.unwrap();
        assert_eq!(claims.sub, "dev-user");
        assert_eq!(claims.tenant_id, "dev-tenant");
        assert_eq!(claims.bu_code, "DEV");
        assert!(claims.roles.contains(&"admin".to_string()));
    }

    #[test]
    fn test_auth_layer_dev_mode_with_custom_claims() {
        let jwt_service = create_test_jwt_service();
        let custom_claims = Claims {
            sub: "custom-user".to_string(),
            tenant_id: "custom-tenant".to_string(),
            bu_code: "CUSTOM".to_string(),
            roles: vec!["viewer".to_string()],
            iat: 0,
            exp: 0,
            iss: "custom".to_string(),
        };

        let layer = AuthLayer::dev_mode_with_claims(jwt_service, custom_claims.clone());
        assert!(layer.is_dev_mode());

        let claims = layer.dev_claims.unwrap();
        assert_eq!(claims.sub, "custom-user");
        assert_eq!(claims.tenant_id, "custom-tenant");
    }

    #[test]
    fn test_extract_bearer_token() {
        use axum::http::Request;

        // Test with valid bearer token
        let request = Request::builder()
            .header("Authorization", "Bearer test-token-123")
            .body(Body::empty())
            .unwrap();
        let token = extract_bearer_token(&request);
        assert_eq!(token, Some("test-token-123".to_string()));

        // Test with no header
        let request = Request::builder().body(Body::empty()).unwrap();
        let token = extract_bearer_token(&request);
        assert!(token.is_none());

        // Test with invalid format
        let request = Request::builder()
            .header("Authorization", "Basic credentials")
            .body(Body::empty())
            .unwrap();
        let token = extract_bearer_token(&request);
        assert!(token.is_none());
    }

    #[test]
    fn test_auth_error_into_response() {
        let error = AuthError::MissingAuthHeader;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let error = AuthError::InsufficientPermissions;
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);

        let error = AuthError::QuotaExceeded("limit".to_string());
        let response = error.into_response();
        assert_eq!(response.status(), StatusCode::TOO_MANY_REQUESTS);
    }
}
