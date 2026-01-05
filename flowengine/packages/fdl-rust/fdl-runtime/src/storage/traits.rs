//! Storage traits

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// Storage error types
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

/// Flow storage trait
#[async_trait]
pub trait FlowStorage: Send + Sync {
    // Flow operations
    async fn create_flow(&self, req: CreateFlowRequest) -> Result<FlowRecord, StorageError>;
    async fn get_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<FlowRecord, StorageError>;
    async fn list_flows(&self, tenant_id: Uuid, opts: ListOptions) -> Result<ListResult<FlowRecord>, StorageError>;
    async fn update_flow(&self, tenant_id: Uuid, flow_id: Uuid, req: UpdateFlowRequest) -> Result<FlowRecord, StorageError>;
    async fn delete_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<(), StorageError>;

    // Version operations
    async fn create_version(&self, req: CreateVersionRequest) -> Result<VersionRecord, StorageError>;
    async fn get_version(&self, tenant_id: Uuid, flow_id: Uuid, version_id: Uuid) -> Result<VersionRecord, StorageError>;
    async fn list_versions(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<Vec<VersionRecord>, StorageError>;
    async fn delete_version(&self, tenant_id: Uuid, flow_id: Uuid, version_id: Uuid) -> Result<(), StorageError>;
    async fn get_latest_version(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<Option<VersionRecord>, StorageError>;

    // Execution operations
    async fn create_execution(&self, flow_id: Uuid, version_id: Option<Uuid>, tenant_id: Uuid, inputs: Option<serde_json::Value>) -> Result<ExecutionRecord, StorageError>;
    async fn get_execution(&self, tenant_id: Uuid, execution_id: Uuid) -> Result<ExecutionRecord, StorageError>;
    async fn update_execution_status(&self, execution_id: Uuid, status: &str, outputs: Option<serde_json::Value>, error: Option<String>) -> Result<(), StorageError>;
    async fn list_executions(&self, tenant_id: Uuid, flow_id: Uuid, opts: ListOptions) -> Result<ListResult<ExecutionRecord>, StorageError>;

    // Health check
    async fn is_healthy(&self) -> bool;
}
