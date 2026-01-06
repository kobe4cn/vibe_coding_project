//! 存储 trait 定义
//!
//! 定义存储后端的统一接口，包括：
//! - FlowStorage trait：所有存储后端必须实现的接口
//! - 数据记录类型：FlowRecord、VersionRecord、ExecutionRecord
//! - 错误类型：StorageError

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// 存储错误类型
/// 
/// 涵盖所有存储操作可能出现的错误。
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Connection error: {0}")]
    Connection(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Tenant access denied")]
    TenantAccessDenied,
}

/// Flow record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Publish status
    #[serde(default)]
    pub published: bool,
    pub published_at: Option<DateTime<Utc>>,
    pub published_version_id: Option<Uuid>,
}

/// Version record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionRecord {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub tenant_id: Uuid,
    pub version_number: i32,
    pub label: Option<String>,
    pub data: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub id: Uuid,
    pub flow_id: Uuid,
    pub version_id: Option<Uuid>,
    pub tenant_id: Uuid,
    pub status: String,
    pub inputs: Option<serde_json::Value>,
    pub outputs: Option<serde_json::Value>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

/// API Key record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyRecord {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub flow_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub key_hash: String,
    pub key_prefix: String,
    pub rate_limit: i32,
    pub is_active: bool,
    pub last_used_at: Option<DateTime<Utc>>,
    pub usage_count: i32,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Create API key request
#[derive(Debug, Clone)]
pub struct CreateApiKeyRequest {
    pub tenant_id: Uuid,
    pub flow_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub key_hash: String,
    pub key_prefix: String,
    pub rate_limit: Option<i32>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// Publish flow request
#[derive(Debug, Clone)]
pub struct PublishFlowRequest {
    pub version_id: Uuid,
}

/// Create flow request
#[derive(Debug, Clone)]
pub struct CreateFlowRequest {
    pub tenant_id: Uuid,
    pub name: String,
    pub description: Option<String>,
}

/// Update flow request
#[derive(Debug, Clone)]
pub struct UpdateFlowRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub thumbnail: Option<String>,
}

/// Create version request
#[derive(Debug, Clone)]
pub struct CreateVersionRequest {
    pub flow_id: Uuid,
    pub tenant_id: Uuid,
    pub data: serde_json::Value,
    pub label: Option<String>,
}

/// List options
#[derive(Debug, Clone, Default)]
pub struct ListOptions {
    pub limit: usize,
    pub offset: usize,
}

/// List result with pagination info
#[derive(Debug, Clone)]
pub struct ListResult<T> {
    pub items: Vec<T>,
    pub total: usize,
}

/// 流程存储 trait
/// 
/// 定义所有存储后端必须实现的统一接口。
/// 所有操作都包含 tenant_id 参数，确保多租户数据隔离。
#[async_trait]
pub trait FlowStorage: Send + Sync {
    // 流程操作
    async fn create_flow(&self, req: CreateFlowRequest) -> Result<FlowRecord, StorageError>;
    async fn get_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<FlowRecord, StorageError>;
    async fn list_flows(
        &self,
        tenant_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<FlowRecord>, StorageError>;
    async fn update_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        req: UpdateFlowRequest,
    ) -> Result<FlowRecord, StorageError>;
    async fn delete_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<(), StorageError>;

    // Version operations
    async fn create_version(
        &self,
        req: CreateVersionRequest,
    ) -> Result<VersionRecord, StorageError>;
    async fn get_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<VersionRecord, StorageError>;
    async fn list_versions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Vec<VersionRecord>, StorageError>;
    async fn delete_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<(), StorageError>;
    async fn get_latest_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Option<VersionRecord>, StorageError>;

    // Execution operations
    async fn create_execution(
        &self,
        flow_id: Uuid,
        version_id: Option<Uuid>,
        tenant_id: Uuid,
        inputs: Option<serde_json::Value>,
    ) -> Result<ExecutionRecord, StorageError>;
    async fn get_execution(
        &self,
        tenant_id: Uuid,
        execution_id: Uuid,
    ) -> Result<ExecutionRecord, StorageError>;
    async fn update_execution_status(
        &self,
        execution_id: Uuid,
        status: &str,
        outputs: Option<serde_json::Value>,
        error: Option<String>,
    ) -> Result<(), StorageError>;
    async fn list_executions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<ExecutionRecord>, StorageError>;

    // Publish operations
    async fn publish_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<FlowRecord, StorageError>;
    async fn unpublish_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<FlowRecord, StorageError>;
    async fn get_published_flow(&self, flow_id: Uuid) -> Result<FlowRecord, StorageError>;

    // API Key operations
    async fn create_api_key(
        &self,
        req: CreateApiKeyRequest,
    ) -> Result<ApiKeyRecord, StorageError>;
    async fn get_api_key(
        &self,
        tenant_id: Uuid,
        key_id: Uuid,
    ) -> Result<ApiKeyRecord, StorageError>;
    async fn get_api_key_by_hash(&self, key_hash: &str) -> Result<ApiKeyRecord, StorageError>;
    async fn list_api_keys(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Vec<ApiKeyRecord>, StorageError>;
    async fn delete_api_key(
        &self,
        tenant_id: Uuid,
        key_id: Uuid,
    ) -> Result<(), StorageError>;
    async fn update_api_key_usage(&self, key_id: Uuid) -> Result<(), StorageError>;

    // Health check
    async fn is_healthy(&self) -> bool;
}
