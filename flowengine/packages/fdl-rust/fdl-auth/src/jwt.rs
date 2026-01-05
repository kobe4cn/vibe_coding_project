//! JWT token handling

use crate::error::{AuthError, AuthResult};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT configuration
#[derive(Debug, Clone)]
pub struct JwtConfig {
    pub secret: String,
    pub issuer: String,
    pub access_token_ttl: Duration,
    pub refresh_token_ttl: Duration,
}

impl Default for JwtConfig {
    fn default() -> Self {
        Self {
            secret: "default-secret-change-in-production".to_string(),
            issuer: "fdl-runtime".to_string(),
            access_token_ttl: Duration::hours(1),
            refresh_token_ttl: Duration::days(7),
        }
    }
}

/// JWT claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (user ID)
    pub sub: String,
    /// Tenant ID
    pub tenant_id: String,
    /// Business unit code
    pub bu_code: String,
    /// User roles
    pub roles: Vec<String>,
    /// Issued at
    pub iat: i64,
    /// Expiration
    pub exp: i64,
    /// Issuer
    pub iss: String,
}

impl Claims {
    /// Check if the claims have a specific role
    pub fn has_role(&self, role: &str) -> bool {
        self.roles.iter().any(|r| r == role)
    }
}

/// JWT service for token operations
pub struct JwtService {
    config: JwtConfig,
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl JwtService {
    /// Create a new JWT service
    pub fn new(config: JwtConfig) -> Self {
        let encoding_key = EncodingKey::from_secret(config.secret.as_bytes());
        let decoding_key = DecodingKey::from_secret(config.secret.as_bytes());
        Self {
            config,
            encoding_key,
            decoding_key,
        }
    }

    /// Generate an access token
    pub fn generate_access_token(
        &self,
        user_id: &str,
        tenant_id: &str,
        bu_code: &str,
        roles: Vec<String>,
    ) -> AuthResult<String> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            tenant_id: tenant_id.to_string(),
            bu_code: bu_code.to_string(),
            roles,
            iat: now.timestamp(),
            exp: (now + self.config.access_token_ttl).timestamp(),
            iss: self.config.issuer.clone(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::Internal(e.to_string()))
    }

    /// Generate a refresh token
    pub fn generate_refresh_token(&self, user_id: &str, tenant_id: &str) -> AuthResult<String> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            tenant_id: tenant_id.to_string(),
            bu_code: String::new(),
            roles: vec!["refresh".to_string()],
            iat: now.timestamp(),
            exp: (now + self.config.refresh_token_ttl).timestamp(),
            iss: self.config.issuer.clone(),
        };

        encode(&Header::default(), &claims, &self.encoding_key)
            .map_err(|e| AuthError::Internal(e.to_string()))
    }

    /// Validate and decode a token
    pub fn validate_token(&self, token: &str) -> AuthResult<Claims> {
        let mut validation = Validation::default();
        validation.set_issuer(&[&self.config.issuer]);

        decode::<Claims>(token, &self.decoding_key, &validation)
            .map(|data| data.claims)
            .map_err(|e| match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
                _ => AuthError::InvalidToken(e.to_string()),
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_config_default() {
        let config = JwtConfig::default();
        assert_eq!(config.issuer, "fdl-runtime");
        assert_eq!(config.access_token_ttl, Duration::hours(1));
        assert_eq!(config.refresh_token_ttl, Duration::days(7));
    }

    #[test]
    fn test_jwt_roundtrip() {
        let service = JwtService::new(JwtConfig::default());

        let token = service
            .generate_access_token("user-1", "tenant-1", "BU001", vec!["admin".to_string()])
            .unwrap();

        let claims = service.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.tenant_id, "tenant-1");
        assert!(claims.has_role("admin"));
    }

    #[test]
    fn test_refresh_token() {
        let service = JwtService::new(JwtConfig::default());

        let token = service.generate_refresh_token("user-1", "tenant-1").unwrap();

        let claims = service.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.tenant_id, "tenant-1");
        assert!(claims.has_role("refresh"));
        assert!(claims.bu_code.is_empty());
    }

    #[test]
    fn test_claims_has_role() {
        let claims = Claims {
            sub: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            roles: vec!["admin".to_string(), "editor".to_string()],
            iat: 0,
            exp: 0,
            iss: "test".to_string(),
        };

        assert!(claims.has_role("admin"));
        assert!(claims.has_role("editor"));
        assert!(!claims.has_role("viewer"));
    }

    #[test]
    fn test_invalid_token() {
        let service = JwtService::new(JwtConfig::default());

        let result = service.validate_token("invalid-token");
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_issuer_token() {
        let service1 = JwtService::new(JwtConfig {
            issuer: "issuer-1".to_string(),
            ..JwtConfig::default()
        });

        let service2 = JwtService::new(JwtConfig {
            issuer: "issuer-2".to_string(),
            ..JwtConfig::default()
        });

        let token = service1
            .generate_access_token("user-1", "tenant-1", "BU001", vec![])
            .unwrap();

        // Validating with different issuer should fail
        let result = service2.validate_token(&token);
        assert!(result.is_err());
    }
}
