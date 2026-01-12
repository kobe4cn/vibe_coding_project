//! 应用状态管理
//!
//! 管理应用的全局状态，包括：
//! - JWT 认证服务
//! - 流程存储（内存或数据库）
//! - 执行器管理
//! - 执行状态跟踪
//!
//! 使用 DashMap 实现线程安全的并发访问。

use chrono::{DateTime, Utc};
use dashmap::DashMap;
use fdl_auth::{JwtConfig, JwtService};
use fdl_executor::Executor;
use fdl_tools::{
    ConfigStore, InMemoryConfigStore, InMemoryToolServiceStore, PostgresConfigStore,
    PostgresToolServiceStore, ToolServiceStore,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::storage::{
    Storage, StorageError,
    traits::{
        ApiKeyRecord, CreateApiKeyRequest as StorageCreateApiKey,
        CreateFlowRequest as StorageCreateFlow, CreateVersionRequest as StorageCreateVersion,
        FlowRecord, ListOptions, UpdateFlowRequest as StorageUpdateFlow, VersionRecord,
    },
};

/// Database configuration
#[derive(Debug, Clone)]
pub struct DatabaseConfig {
    /// PostgreSQL connection URL
    pub url: Option<String>,
    /// Enable database storage (vs in-memory)
    pub enabled: bool,
    /// Connection pool size
    pub pool_size: u32,
    /// Connection timeout in seconds
    pub timeout_secs: u64,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: None,
            enabled: false,
            pool_size: 10,
            timeout_secs: 30,
        }
    }
}

impl DatabaseConfig {
    pub fn from_env() -> Self {
        Self {
            url: std::env::var("DATABASE_URL").ok(),
            enabled: std::env::var("FDL_USE_DATABASE")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
            pool_size: std::env::var("FDL_DB_POOL_SIZE")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(10),
            timeout_secs: std::env::var("FDL_DB_TIMEOUT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(30),
        }
    }
}

/// Server configuration
#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub dev_mode: bool,
    pub jwt_secret: String,
    pub database: DatabaseConfig,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 3001,
            dev_mode: true,
            jwt_secret: "dev-secret-key-change-in-production".to_string(),
            database: DatabaseConfig::default(),
        }
    }
}

impl ServerConfig {
    pub fn from_env() -> Self {
        Self {
            host: std::env::var("FDL_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: std::env::var("FDL_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            dev_mode: std::env::var("FDL_DEV_MODE")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(true),
            jwt_secret: std::env::var("FDL_JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-key-change-in-production".to_string()),
            database: DatabaseConfig::from_env(),
        }
    }
}

/// Execution state
#[derive(Debug, Clone, Serialize)]
pub struct ExecutionState {
    pub execution_id: String,
    pub flow_id: String,
    pub tenant_id: String,
    pub status: ExecutionStatus,
    pub progress: f32,
    pub current_node: Option<String>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Storage mode for the application
pub enum StorageMode {
    /// In-memory storage using DashMap
    Memory,
    /// PostgreSQL database storage
    Database,
}

/// 存储初始化结果类型
/// 包含存储模式、数据库连接池、存储实例、配置存储和工具服务存储
type StorageInitResult = (
    StorageMode,
    Option<sqlx::PgPool>,
    Storage,
    Arc<dyn ConfigStore>,
    Arc<dyn ToolServiceStore>,
);

/// 应用状态：在所有处理器之间共享
///
/// 使用 Arc 实现共享所有权，DashMap 实现线程安全的并发访问。
/// 支持内存和数据库两种存储模式，根据配置自动选择。
pub struct AppState {
    /// JWT 认证服务（用于 token 生成和验证）
    pub jwt_service: Arc<JwtService>,
    /// 活跃的执行器（按执行 ID 索引）
    /// 用于管理长时间运行的流程执行
    pub executors: DashMap<String, Arc<Executor>>,
    /// 执行状态（按执行 ID 索引）
    /// 用于跟踪执行进度和结果
    pub executions: DashMap<String, ExecutionState>,
    /// 服务器配置
    pub config: ServerConfig,
    /// 当前存储模式（内存或数据库）
    pub storage_mode: StorageMode,
    /// 数据库连接池（可选，仅在数据库模式下使用）
    pub db_pool: Option<sqlx::PgPool>,
    /// 存储后端（内存或 PostgreSQL）
    /// 通过 trait 抽象，支持运行时切换
    pub storage: Storage,
    /// 工具配置存储（API 服务、数据源、UDF 配置）
    config_store: Arc<dyn ConfigStore>,
    /// 工具服务存储（OSS、MQ、Mail、SMS、Svc 等 ToolSpec 规范服务）
    tool_service_store: Arc<dyn ToolServiceStore>,
}

impl AppState {
    /// Create a new application state with in-memory storage
    pub fn new() -> Self {
        let jwt_config = JwtConfig::default();
        let jwt_service = Arc::new(JwtService::new(jwt_config));
        let config_store = Arc::new(InMemoryConfigStore::new());
        let tool_service_store = Arc::new(InMemoryToolServiceStore::new());

        Self {
            jwt_service,
            executors: DashMap::new(),
            executions: DashMap::new(),
            config: ServerConfig::default(),
            storage_mode: StorageMode::Memory,
            db_pool: None,
            storage: Storage::memory(),
            config_store,
            tool_service_store,
        }
    }

    /// Create with configuration (async for database initialization)
    pub async fn with_config(config: ServerConfig) -> Self {
        let jwt_config = JwtConfig {
            secret: config.jwt_secret.clone(),
            issuer: "fdl-runtime".to_string(),
            access_token_ttl: chrono::Duration::hours(24),
            refresh_token_ttl: chrono::Duration::days(7),
        };
        let jwt_service = Arc::new(JwtService::new(jwt_config));

        // 初始化存储后端
        // 根据配置选择内存或数据库存储，失败时回退到内存模式
        let (storage_mode, db_pool, storage, config_store, tool_service_store): StorageInitResult =
            match Storage::new(&config.database).await {
                Ok(s) => {
                    let is_db = s.is_database();
                    if is_db {
                        tracing::info!("Database storage initialized successfully");
                        // 获取数据库连接池
                        match Self::init_database(&config.database).await {
                            Ok(pool) => {
                                // 使用 PostgreSQL 配置存储
                                let pg_config_store =
                                    Arc::new(PostgresConfigStore::new(pool.clone()));
                                // 使用 PostgreSQL 工具服务存储
                                let pg_tool_service_store =
                                    Arc::new(PostgresToolServiceStore::new(pool.clone()));
                                tracing::info!(
                                    "Using PostgreSQL config store and tool service store"
                                );
                                (
                                    StorageMode::Database,
                                    Some(pool),
                                    s,
                                    pg_config_store,
                                    pg_tool_service_store,
                                )
                            }
                            Err(e) => {
                                tracing::warn!(
                                    "Failed to init database pool for config store: {}, using in-memory",
                                    e
                                );
                                let memory_config_store = Arc::new(InMemoryConfigStore::new());
                                let memory_tool_store = Arc::new(InMemoryToolServiceStore::new());
                                (
                                    StorageMode::Database,
                                    None,
                                    s,
                                    memory_config_store,
                                    memory_tool_store,
                                )
                            }
                        }
                    } else {
                        tracing::info!("Using in-memory storage");
                        let memory_config_store = Arc::new(InMemoryConfigStore::new());
                        let memory_tool_store = Arc::new(InMemoryToolServiceStore::new());
                        (
                            StorageMode::Memory,
                            None,
                            s,
                            memory_config_store,
                            memory_tool_store,
                        )
                    }
                }
                Err(e) => {
                    // 存储初始化失败时回退到内存模式，确保服务可以启动
                    tracing::error!(
                        "Failed to initialize storage: {}, falling back to memory",
                        e
                    );
                    let memory_config_store = Arc::new(InMemoryConfigStore::new());
                    let memory_tool_store = Arc::new(InMemoryToolServiceStore::new());
                    (
                        StorageMode::Memory,
                        None,
                        Storage::memory(),
                        memory_config_store,
                        memory_tool_store,
                    )
                }
            };

        Self {
            jwt_service,
            executors: DashMap::new(),
            executions: DashMap::new(),
            config,
            storage_mode,
            db_pool,
            storage,
            config_store,
            tool_service_store,
        }
    }

    /// Initialize database connection pool
    async fn init_database(config: &DatabaseConfig) -> Result<sqlx::PgPool, sqlx::Error> {
        let url = config
            .url
            .as_ref()
            .ok_or_else(|| sqlx::Error::Configuration("DATABASE_URL not set".into()))?;

        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(config.pool_size)
            .acquire_timeout(std::time::Duration::from_secs(config.timeout_secs))
            .connect(url)
            .await?;

        // Test the connection
        sqlx::query("SELECT 1").execute(&pool).await?;

        Ok(pool)
    }

    /// Create with custom JWT config (sync, in-memory only)
    pub fn with_jwt_config(jwt_config: JwtConfig) -> Self {
        let jwt_service = Arc::new(JwtService::new(jwt_config));
        let config_store = Arc::new(InMemoryConfigStore::new());
        let tool_service_store = Arc::new(InMemoryToolServiceStore::new());

        Self {
            jwt_service,
            executors: DashMap::new(),
            executions: DashMap::new(),
            config: ServerConfig::default(),
            storage_mode: StorageMode::Memory,
            db_pool: None,
            storage: Storage::memory(),
            config_store,
            tool_service_store,
        }
    }

    /// Get config store reference
    pub fn config_store(&self) -> &dyn ConfigStore {
        self.config_store.as_ref()
    }

    /// Get config store Arc for sharing
    pub fn config_store_arc(&self) -> Arc<dyn ConfigStore> {
        self.config_store.clone()
    }

    /// Get tool service store reference
    pub fn tool_service_store(&self) -> &dyn ToolServiceStore {
        self.tool_service_store.as_ref()
    }

    /// Get tool service store Arc for sharing
    pub fn tool_service_store_arc(&self) -> Arc<dyn ToolServiceStore> {
        self.tool_service_store.clone()
    }

    /// Check if using database storage
    pub fn is_database_mode(&self) -> bool {
        matches!(self.storage_mode, StorageMode::Database)
    }

    /// Get database pool reference (if available)
    pub fn database(&self) -> Option<&sqlx::PgPool> {
        self.db_pool.as_ref()
    }

    // Executor management

    /// Register an executor
    pub fn register_executor(&self, id: &str, executor: Arc<Executor>) {
        self.executors.insert(id.to_string(), executor);
    }

    /// Get an executor by ID
    pub fn get_executor(&self, id: &str) -> Option<Arc<Executor>> {
        self.executors.get(id).map(|e| e.clone())
    }

    /// Remove an executor
    pub fn remove_executor(&self, id: &str) {
        self.executors.remove(id);
    }

    // Flow management (async, using Storage abstraction)

    /// Create a new flow
    pub async fn create_flow(
        &self,
        tenant_id: &str,
        name: &str,
        description: Option<String>,
    ) -> Result<FlowRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        self.storage
            .as_flow_storage()
            .create_flow(StorageCreateFlow {
                tenant_id: tenant_uuid,
                name: name.to_string(),
                description,
            })
            .await
    }

    /// Get flow by ID
    pub async fn get_flow(
        &self,
        tenant_id: &str,
        flow_id: &str,
    ) -> Result<FlowRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .get_flow(tenant_uuid, flow_uuid)
            .await
    }

    /// List flows for a tenant
    pub async fn list_flows(
        &self,
        tenant_id: &str,
        limit: usize,
        offset: usize,
    ) -> Result<(Vec<FlowRecord>, usize), StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let result = self
            .storage
            .as_flow_storage()
            .list_flows(tenant_uuid, ListOptions { limit, offset })
            .await?;
        Ok((result.items, result.total))
    }

    /// Update flow
    pub async fn update_flow(
        &self,
        tenant_id: &str,
        flow_id: &str,
        name: Option<String>,
        description: Option<String>,
    ) -> Result<FlowRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .update_flow(
                tenant_uuid,
                flow_uuid,
                StorageUpdateFlow {
                    name,
                    description,
                    thumbnail: None,
                },
            )
            .await
    }

    /// Delete flow
    pub async fn delete_flow(&self, tenant_id: &str, flow_id: &str) -> Result<(), StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .delete_flow(tenant_uuid, flow_uuid)
            .await
    }

    // Version management (async, using Storage abstraction)

    /// Create a new version
    pub async fn create_version(
        &self,
        flow_id: &str,
        tenant_id: &str,
        data: serde_json::Value,
        label: Option<String>,
    ) -> Result<VersionRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .create_version(StorageCreateVersion {
                flow_id: flow_uuid,
                tenant_id: tenant_uuid,
                data,
                label,
            })
            .await
    }

    /// Get version by ID
    pub async fn get_version(
        &self,
        tenant_id: &str,
        flow_id: &str,
        version_id: &str,
    ) -> Result<VersionRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        let version_uuid = Uuid::parse_str(version_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid version ID: {}", version_id)))?;
        self.storage
            .as_flow_storage()
            .get_version(tenant_uuid, flow_uuid, version_uuid)
            .await
    }

    /// List versions for a flow
    pub async fn list_versions(
        &self,
        tenant_id: &str,
        flow_id: &str,
    ) -> Result<Vec<VersionRecord>, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .list_versions(tenant_uuid, flow_uuid)
            .await
    }

    /// Delete version
    pub async fn delete_version(
        &self,
        tenant_id: &str,
        flow_id: &str,
        version_id: &str,
    ) -> Result<(), StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        let version_uuid = Uuid::parse_str(version_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid version ID: {}", version_id)))?;
        self.storage
            .as_flow_storage()
            .delete_version(tenant_uuid, flow_uuid, version_uuid)
            .await
    }

    /// Get version count for a flow
    pub async fn version_count(&self, tenant_id: &str, flow_id: &str) -> usize {
        match self.list_versions(tenant_id, flow_id).await {
            Ok(versions) => versions.len(),
            Err(_) => 0,
        }
    }

    /// Get latest version for a flow
    pub async fn get_latest_version(
        &self,
        tenant_id: &str,
        flow_id: &str,
    ) -> Result<Option<VersionRecord>, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .get_latest_version(tenant_uuid, flow_uuid)
            .await
    }

    // Publish management

    /// Publish a flow with a specific version
    pub async fn publish_flow(
        &self,
        tenant_id: &str,
        flow_id: &str,
        version_id: &str,
    ) -> Result<FlowRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        let version_uuid = Uuid::parse_str(version_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid version ID: {}", version_id)))?;
        self.storage
            .as_flow_storage()
            .publish_flow(tenant_uuid, flow_uuid, version_uuid)
            .await
    }

    /// Unpublish a flow
    pub async fn unpublish_flow(
        &self,
        tenant_id: &str,
        flow_id: &str,
    ) -> Result<FlowRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .unpublish_flow(tenant_uuid, flow_uuid)
            .await
    }

    // API Key management

    /// List API keys for a flow
    pub async fn list_api_keys(
        &self,
        tenant_id: &str,
        flow_id: &str,
    ) -> Result<Vec<ApiKeyRecord>, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .list_api_keys(tenant_uuid, flow_uuid)
            .await
    }

    /// Create a new API key
    #[allow(clippy::too_many_arguments)]
    pub async fn create_api_key(
        &self,
        tenant_id: &str,
        flow_id: &str,
        name: &str,
        description: Option<String>,
        key_hash: &str,
        key_prefix: &str,
        rate_limit: Option<i32>,
        expires_at: Option<DateTime<Utc>>,
    ) -> Result<ApiKeyRecord, StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let flow_uuid = Uuid::parse_str(flow_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid flow ID: {}", flow_id)))?;
        self.storage
            .as_flow_storage()
            .create_api_key(StorageCreateApiKey {
                tenant_id: tenant_uuid,
                flow_id: flow_uuid,
                name: name.to_string(),
                description,
                key_hash: key_hash.to_string(),
                key_prefix: key_prefix.to_string(),
                rate_limit,
                expires_at,
            })
            .await
    }

    /// Delete an API key
    pub async fn delete_api_key(&self, tenant_id: &str, key_id: &str) -> Result<(), StorageError> {
        let tenant_uuid = parse_tenant_id(tenant_id);
        let key_uuid = Uuid::parse_str(key_id)
            .map_err(|_| StorageError::NotFound(format!("Invalid key ID: {}", key_id)))?;
        self.storage
            .as_flow_storage()
            .delete_api_key(tenant_uuid, key_uuid)
            .await
    }

    // Execution management

    /// Create a new execution
    pub fn create_execution(&self, flow_id: &str, tenant_id: &str) -> ExecutionState {
        let execution = ExecutionState {
            execution_id: Uuid::new_v4().to_string(),
            flow_id: flow_id.to_string(),
            tenant_id: tenant_id.to_string(),
            status: ExecutionStatus::Pending,
            progress: 0.0,
            current_node: None,
            error: None,
            started_at: Utc::now(),
            completed_at: None,
        };
        self.executions
            .insert(execution.execution_id.clone(), execution.clone());
        execution
    }

    /// Get execution state
    pub fn get_execution(&self, execution_id: &str) -> Option<ExecutionState> {
        self.executions.get(execution_id).map(|e| e.clone())
    }

    /// Update execution status
    pub fn update_execution(
        &self,
        execution_id: &str,
        status: ExecutionStatus,
        progress: f32,
        current_node: Option<String>,
    ) {
        if let Some(mut exec) = self.executions.get_mut(execution_id) {
            exec.status = status;
            exec.progress = progress;
            exec.current_node = current_node;
            if matches!(
                status,
                ExecutionStatus::Completed | ExecutionStatus::Failed | ExecutionStatus::Cancelled
            ) {
                exec.completed_at = Some(Utc::now());
            }
        }
    }

    /// Fail execution with error
    pub fn fail_execution(&self, execution_id: &str, error: &str) {
        if let Some(mut exec) = self.executions.get_mut(execution_id) {
            exec.status = ExecutionStatus::Failed;
            exec.error = Some(error.to_string());
            exec.completed_at = Some(Utc::now());
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// 解析租户 ID 字符串为 UUID
///
/// 处理三种情况：
/// 1. "default" 租户：使用固定的已知 UUID
/// 2. 有效的 UUID 字符串：直接解析
/// 3. 其他字符串：通过哈希生成确定性 UUID（确保相同字符串生成相同 UUID）
///
/// 这种设计允许使用字符串租户 ID（如 "tenant-1"），同时保持数据库中的 UUID 类型。
fn parse_tenant_id(tenant_id: &str) -> Uuid {
    if tenant_id == "default" {
        // "default" 租户使用固定的已知 UUID
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
    } else {
        Uuid::parse_str(tenant_id).unwrap_or_else(|_| {
            // 从字符串哈希生成确定性 UUID
            // 确保相同字符串总是生成相同的 UUID
            use std::collections::hash_map::DefaultHasher;
            use std::hash::{Hash, Hasher};
            let mut hasher = DefaultHasher::new();
            tenant_id.hash(&mut hasher);
            let hash = hasher.finish();
            Uuid::from_u64_pair(hash, hash.wrapping_mul(31))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_creation() {
        let state = AppState::new();
        assert!(state.executions.is_empty());
    }

    #[tokio::test]
    async fn test_flow_crud() {
        let state = AppState::new();
        let tenant_id = "tenant-1";

        // Create
        let flow = state
            .create_flow(tenant_id, "Test Flow", Some("Description".to_string()))
            .await
            .unwrap();
        assert_eq!(flow.name, "Test Flow");

        // Get
        let flow_id = flow.id.to_string();
        let retrieved = state.get_flow(tenant_id, &flow_id).await.unwrap();
        assert_eq!(retrieved.name, "Test Flow");

        // Update
        let updated = state
            .update_flow(tenant_id, &flow_id, Some("Updated".to_string()), None)
            .await
            .unwrap();
        assert_eq!(updated.name, "Updated");

        // List
        let (flows, total) = state.list_flows(tenant_id, 10, 0).await.unwrap();
        assert_eq!(total, 1);
        assert_eq!(flows.len(), 1);

        // Delete
        state.delete_flow(tenant_id, &flow_id).await.unwrap();
        assert!(state.get_flow(tenant_id, &flow_id).await.is_err());
    }

    #[tokio::test]
    async fn test_version_crud() {
        let state = AppState::new();
        let tenant_id = "tenant-1";

        let flow = state.create_flow(tenant_id, "Test", None).await.unwrap();
        let flow_id = flow.id.to_string();

        // Create versions
        let v1 = state
            .create_version(
                &flow_id,
                tenant_id,
                serde_json::json!({"v": 1}),
                Some("v1.0".to_string()),
            )
            .await
            .unwrap();
        let v2 = state
            .create_version(&flow_id, tenant_id, serde_json::json!({"v": 2}), None)
            .await
            .unwrap();

        assert_eq!(v1.version_number, 1);
        assert_eq!(v2.version_number, 2);

        // List
        let versions = state.list_versions(tenant_id, &flow_id).await.unwrap();
        assert_eq!(versions.len(), 2);

        // Get
        let v1_id = v1.id.to_string();
        let retrieved = state
            .get_version(tenant_id, &flow_id, &v1_id)
            .await
            .unwrap();
        assert_eq!(retrieved.version_number, 1);

        // Delete
        state
            .delete_version(tenant_id, &flow_id, &v1_id)
            .await
            .unwrap();
        assert_eq!(state.version_count(tenant_id, &flow_id).await, 1);
    }

    #[test]
    fn test_execution_lifecycle() {
        let state = AppState::new();

        let exec = state.create_execution("flow-1", "tenant-1");
        assert_eq!(exec.status, ExecutionStatus::Pending);

        state.update_execution(
            &exec.execution_id,
            ExecutionStatus::Running,
            0.5,
            Some("node-1".to_string()),
        );
        let running = state.get_execution(&exec.execution_id).unwrap();
        assert_eq!(running.status, ExecutionStatus::Running);
        assert_eq!(running.progress, 0.5);

        state.update_execution(&exec.execution_id, ExecutionStatus::Completed, 1.0, None);
        let completed = state.get_execution(&exec.execution_id).unwrap();
        assert_eq!(completed.status, ExecutionStatus::Completed);
        assert!(completed.completed_at.is_some());
    }

    #[test]
    fn test_server_config() {
        let config = ServerConfig::default();
        assert_eq!(config.port, 3001);
        assert!(config.dev_mode);
    }

    #[test]
    fn test_parse_tenant_id() {
        // Default tenant should produce consistent UUID
        let default1 = parse_tenant_id("default");
        let default2 = parse_tenant_id("default");
        assert_eq!(default1, default2);

        // Valid UUID should be parsed
        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let parsed = parse_tenant_id(uuid_str);
        assert_eq!(parsed.to_string(), uuid_str);

        // Invalid UUID should produce deterministic UUID
        let custom1 = parse_tenant_id("my-tenant");
        let custom2 = parse_tenant_id("my-tenant");
        assert_eq!(custom1, custom2);
    }
}
