//! API Key 认证模块
//!
//! 提供外部 API 调用的认证功能：
//! - 从请求头提取 API Key
//! - 验证 Key 的有效性和权限
//! - 注入租户和流程上下文

use axum::{
    body::Body,
    extract::{FromRequestParts, Request},
    http::{StatusCode, request::Parts},
    middleware::Next,
    response::{IntoResponse, Response},
};
use sha2::{Digest, Sha256};
use std::sync::Arc;

/// API Key 验证错误
#[derive(Debug, Clone)]
pub enum ApiKeyError {
    Missing,
    Invalid,
    Expired,
    Inactive,
    FlowNotPublished,
    RateLimitExceeded,
}

impl std::fmt::Display for ApiKeyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Missing => write!(f, "API key is required"),
            Self::Invalid => write!(f, "Invalid API key"),
            Self::Expired => write!(f, "API key has expired"),
            Self::Inactive => write!(f, "API key is inactive"),
            Self::FlowNotPublished => write!(f, "Flow is not published"),
            Self::RateLimitExceeded => write!(f, "Rate limit exceeded"),
        }
    }
}

impl IntoResponse for ApiKeyError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            Self::Missing => (StatusCode::UNAUTHORIZED, self.to_string()),
            Self::Invalid => (StatusCode::UNAUTHORIZED, self.to_string()),
            Self::Expired => (StatusCode::UNAUTHORIZED, self.to_string()),
            Self::Inactive => (StatusCode::FORBIDDEN, self.to_string()),
            Self::FlowNotPublished => (StatusCode::FORBIDDEN, self.to_string()),
            Self::RateLimitExceeded => (StatusCode::TOO_MANY_REQUESTS, self.to_string()),
        };

        let body = serde_json::json!({
            "error": message,
            "code": format!("{:?}", self).to_lowercase()
        });

        (status, axum::Json(body)).into_response()
    }
}

/// 从请求中提取的 API Key 上下文
///
/// 包含验证后的租户和流程信息，可直接注入到处理器中使用
#[derive(Debug, Clone)]
pub struct ApiKeyContext {
    pub key_id: uuid::Uuid,
    pub tenant_id: uuid::Uuid,
    pub flow_id: uuid::Uuid,
    pub rate_limit: i32,
}

/// 从请求头提取 API Key
///
/// 支持两种格式：
/// - `Authorization: Bearer <key>`
/// - `X-API-Key: <key>`
pub fn extract_api_key(headers: &axum::http::HeaderMap) -> Option<String> {
    // 优先检查 Authorization 头
    if let Some(auth_header) = headers.get("Authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if let Some(key) = auth_str.strip_prefix("Bearer ") {
                return Some(key.trim().to_string());
            }
        }
    }

    // 备选：X-API-Key 头
    if let Some(key_header) = headers.get("X-API-Key") {
        if let Ok(key_str) = key_header.to_str() {
            return Some(key_str.trim().to_string());
        }
    }

    None
}

/// 计算 API Key 的 SHA-256 哈希
///
/// 与存储时使用的哈希算法保持一致
pub fn hash_api_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// API Key 验证 trait
///
/// 由存储层实现，用于验证 Key 并返回上下文信息
#[async_trait::async_trait]
pub trait ApiKeyValidator: Send + Sync {
    /// 通过 Key 哈希验证并获取上下文
    async fn validate_key(&self, key_hash: &str) -> Result<ApiKeyContext, ApiKeyError>;

    /// 记录 Key 使用（更新 last_used_at 和 usage_count）
    async fn record_usage(&self, key_id: uuid::Uuid) -> Result<(), ApiKeyError>;

    /// 检查流程是否已发布
    async fn is_flow_published(&self, flow_id: uuid::Uuid) -> Result<bool, ApiKeyError>;
}

/// API Key 验证器包装
///
/// 用于在中间件中共享验证器实例
#[derive(Clone)]
pub struct ApiKeyValidatorWrapper(pub Arc<dyn ApiKeyValidator>);

/// API Key 认证中间件
///
/// 验证请求中的 API Key，并将上下文注入到请求扩展中
pub async fn api_key_auth_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, ApiKeyError> {
    // 从扩展中获取验证器
    let validator = request
        .extensions()
        .get::<ApiKeyValidatorWrapper>()
        .ok_or(ApiKeyError::Invalid)?
        .clone();

    // 提取 API Key
    let key = extract_api_key(request.headers()).ok_or(ApiKeyError::Missing)?;
    let key_hash = hash_api_key(&key);

    // 验证 Key
    let context = validator.0.validate_key(&key_hash).await?;

    // 检查流程是否发布
    if !validator.0.is_flow_published(context.flow_id).await? {
        return Err(ApiKeyError::FlowNotPublished);
    }

    // 记录使用
    validator.0.record_usage(context.key_id).await?;

    // 将上下文注入到请求扩展
    let mut request = request;
    request.extensions_mut().insert(context);

    Ok(next.run(request).await)
}

/// API Key 上下文提取器
///
/// 允许在处理器中直接通过参数注入 ApiKeyContext
impl<S> FromRequestParts<S> for ApiKeyContext
where
    S: Send + Sync,
{
    type Rejection = ApiKeyError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<ApiKeyContext>()
            .cloned()
            .ok_or(ApiKeyError::Invalid)
    }
}
