//! State persistence for flow execution
//!
//! Provides snapshot-based persistence for long-running flow executions.
//! Supports saving execution state and recovering from failures.

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use chrono::{DateTime, Utc};
use fdl_gml::Value;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Execution status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum ExecutionStatus {
    /// Execution is pending (not started)
    Pending,
    /// Execution is running
    Running,
    /// Execution completed successfully
    Completed,
    /// Execution failed
    Failed,
    /// Execution was cancelled
    Cancelled,
    /// Execution is paused (can be resumed)
    Paused,
}

/// Node execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecutionRecord {
    /// Node ID
    pub node_id: String,
    /// Start time
    pub started_at: DateTime<Utc>,
    /// End time (if completed)
    pub ended_at: Option<DateTime<Utc>>,
    /// Node status
    pub status: NodeStatus,
    /// Node output
    pub output: Option<Value>,
    /// Error message if failed
    pub error: Option<String>,
    /// Retry count
    pub retry_count: u32,
}

/// Node execution status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum NodeStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Execution snapshot for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionSnapshot {
    /// Unique execution ID
    pub execution_id: Uuid,
    /// Tenant ID for multi-tenancy
    pub tenant_id: String,
    /// Flow ID
    pub flow_id: String,
    /// Flow version
    pub flow_version: Option<String>,
    /// Current execution status
    pub status: ExecutionStatus,
    /// Input parameters
    pub inputs: Value,
    /// Current variables state
    pub variables: HashMap<String, Value>,
    /// List of completed node IDs
    pub completed_nodes: Vec<String>,
    /// List of failed node IDs
    pub failed_nodes: Vec<String>,
    /// Nodes currently in progress
    pub current_nodes: Vec<String>,
    /// Execution history
    pub history: Vec<NodeExecutionRecord>,
    /// Snapshot creation time
    pub created_at: DateTime<Utc>,
    /// Last update time
    pub updated_at: DateTime<Utc>,
    /// Metadata for additional info
    pub metadata: HashMap<String, String>,
}

impl ExecutionSnapshot {
    /// Create a new snapshot from execution context
    pub fn from_context(
        execution_id: Uuid,
        tenant_id: &str,
        flow_id: &str,
        context: &ExecutionContext,
        status: ExecutionStatus,
    ) -> Self {
        let now = Utc::now();
        Self {
            execution_id,
            tenant_id: tenant_id.to_string(),
            flow_id: flow_id.to_string(),
            flow_version: None,
            status,
            inputs: context.inputs().clone(),
            variables: context.variables().clone(),
            completed_nodes: context.completed().to_vec(),
            failed_nodes: context.failed().to_vec(),
            current_nodes: Vec::new(),
            history: Vec::new(),
            created_at: now,
            updated_at: now,
            metadata: HashMap::new(),
        }
    }

    /// Add a node execution record
    pub fn add_history(&mut self, record: NodeExecutionRecord) {
        self.updated_at = Utc::now();
        self.history.push(record);
    }

    /// Update status
    pub fn set_status(&mut self, status: ExecutionStatus) {
        self.updated_at = Utc::now();
        self.status = status;
    }

    /// Mark a node as completed
    pub fn mark_node_completed(&mut self, node_id: &str, output: Value) {
        self.updated_at = Utc::now();
        self.current_nodes.retain(|n| n != node_id);
        if !self.completed_nodes.contains(&node_id.to_string()) {
            self.completed_nodes.push(node_id.to_string());
        }
        self.variables.insert(node_id.to_string(), output);
    }

    /// Mark a node as failed
    pub fn mark_node_failed(&mut self, node_id: &str, error: &str) {
        self.updated_at = Utc::now();
        self.current_nodes.retain(|n| n != node_id);
        if !self.failed_nodes.contains(&node_id.to_string()) {
            self.failed_nodes.push(node_id.to_string());
        }

        // Add to history
        self.history.push(NodeExecutionRecord {
            node_id: node_id.to_string(),
            started_at: self.updated_at,
            ended_at: Some(self.updated_at),
            status: NodeStatus::Failed,
            output: None,
            error: Some(error.to_string()),
            retry_count: 0,
        });
    }
}

/// Persistence configuration
#[derive(Debug, Clone)]
pub struct PersistenceConfig {
    /// Interval between automatic snapshots (in completed nodes)
    pub snapshot_interval: u32,
    /// Maximum history records to keep
    pub max_history_size: usize,
    /// Whether to persist on every node completion
    pub persist_on_node_complete: bool,
    /// Async write mode (non-blocking)
    pub async_write: bool,
}

impl Default for PersistenceConfig {
    fn default() -> Self {
        Self {
            snapshot_interval: 5,
            max_history_size: 1000,
            persist_on_node_complete: true,
            async_write: true,
        }
    }
}

/// Persistence backend trait
#[async_trait::async_trait]
pub trait PersistenceBackend: Send + Sync {
    /// Save a snapshot
    async fn save_snapshot(&self, snapshot: &ExecutionSnapshot) -> ExecutorResult<()>;

    /// Load a snapshot by execution ID
    async fn load_snapshot(&self, execution_id: Uuid) -> ExecutorResult<Option<ExecutionSnapshot>>;

    /// List snapshots for a flow
    async fn list_snapshots(
        &self,
        tenant_id: &str,
        flow_id: &str,
        limit: usize,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>>;

    /// Delete a snapshot
    async fn delete_snapshot(&self, execution_id: Uuid) -> ExecutorResult<()>;

    /// List incomplete executions (for recovery)
    async fn list_incomplete_executions(
        &self,
        tenant_id: &str,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>>;
}

/// In-memory persistence backend (for testing and development)
#[derive(Default)]
pub struct InMemoryPersistence {
    snapshots: Arc<RwLock<HashMap<Uuid, ExecutionSnapshot>>>,
}

impl InMemoryPersistence {
    pub fn new() -> Self {
        Self {
            snapshots: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait::async_trait]
impl PersistenceBackend for InMemoryPersistence {
    async fn save_snapshot(&self, snapshot: &ExecutionSnapshot) -> ExecutorResult<()> {
        let mut snapshots = self.snapshots.write().await;
        snapshots.insert(snapshot.execution_id, snapshot.clone());
        Ok(())
    }

    async fn load_snapshot(&self, execution_id: Uuid) -> ExecutorResult<Option<ExecutionSnapshot>> {
        let snapshots = self.snapshots.read().await;
        Ok(snapshots.get(&execution_id).cloned())
    }

    async fn list_snapshots(
        &self,
        tenant_id: &str,
        flow_id: &str,
        limit: usize,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>> {
        let snapshots = self.snapshots.read().await;
        let mut result: Vec<_> = snapshots
            .values()
            .filter(|s| s.tenant_id == tenant_id && s.flow_id == flow_id)
            .cloned()
            .collect();

        // Sort by created_at descending
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        result.truncate(limit);

        Ok(result)
    }

    async fn delete_snapshot(&self, execution_id: Uuid) -> ExecutorResult<()> {
        let mut snapshots = self.snapshots.write().await;
        snapshots.remove(&execution_id);
        Ok(())
    }

    async fn list_incomplete_executions(
        &self,
        tenant_id: &str,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>> {
        let snapshots = self.snapshots.read().await;
        let result: Vec<_> = snapshots
            .values()
            .filter(|s| {
                s.tenant_id == tenant_id
                    && matches!(s.status, ExecutionStatus::Running | ExecutionStatus::Paused)
            })
            .cloned()
            .collect();
        Ok(result)
    }
}

/// Persistence manager for handling execution snapshots
pub struct PersistenceManager {
    backend: Arc<dyn PersistenceBackend>,
    config: PersistenceConfig,
}

impl PersistenceManager {
    /// Create a new persistence manager
    pub fn new(backend: Arc<dyn PersistenceBackend>, config: PersistenceConfig) -> Self {
        Self { backend, config }
    }

    /// Create with in-memory backend
    pub fn in_memory() -> Self {
        Self {
            backend: Arc::new(InMemoryPersistence::new()),
            config: PersistenceConfig::default(),
        }
    }

    /// Save execution snapshot
    pub async fn save(&self, snapshot: &ExecutionSnapshot) -> ExecutorResult<()> {
        self.backend.save_snapshot(snapshot).await
    }

    /// Load execution snapshot
    pub async fn load(&self, execution_id: Uuid) -> ExecutorResult<Option<ExecutionSnapshot>> {
        self.backend.load_snapshot(execution_id).await
    }

    /// List snapshots for a flow
    pub async fn list(
        &self,
        tenant_id: &str,
        flow_id: &str,
        limit: usize,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>> {
        self.backend.list_snapshots(tenant_id, flow_id, limit).await
    }

    /// Delete a snapshot
    pub async fn delete(&self, execution_id: Uuid) -> ExecutorResult<()> {
        self.backend.delete_snapshot(execution_id).await
    }

    /// Get incomplete executions for recovery
    pub async fn get_incomplete(&self, tenant_id: &str) -> ExecutorResult<Vec<ExecutionSnapshot>> {
        self.backend.list_incomplete_executions(tenant_id).await
    }

    /// Check if snapshot should be saved based on config
    pub fn should_snapshot(&self, completed_count: u32) -> bool {
        self.config.persist_on_node_complete
            || (completed_count > 0
                && completed_count.is_multiple_of(self.config.snapshot_interval))
    }

    /// Get config
    pub fn config(&self) -> &PersistenceConfig {
        &self.config
    }
}

/// Recovery service for resuming failed executions
pub struct RecoveryService {
    persistence: Arc<PersistenceManager>,
}

impl RecoveryService {
    pub fn new(persistence: Arc<PersistenceManager>) -> Self {
        Self { persistence }
    }

    /// Recover execution context from snapshot
    pub async fn recover(&self, execution_id: Uuid) -> ExecutorResult<ExecutionContext> {
        let snapshot = self.persistence.load(execution_id).await?.ok_or_else(|| {
            ExecutorError::RecoveryError(format!(
                "Snapshot not found for execution {}",
                execution_id
            ))
        })?;

        // Rebuild context from snapshot
        let mut context = ExecutionContext::new();
        context.set_inputs(snapshot.inputs);

        for (key, value) in snapshot.variables {
            context.set_variable(&key, value);
        }

        for node_id in &snapshot.completed_nodes {
            context.mark_completed(node_id);
        }

        for node_id in &snapshot.failed_nodes {
            context.mark_failed(node_id);
        }

        Ok(context)
    }

    /// List recoverable executions for a tenant
    pub async fn list_recoverable(
        &self,
        tenant_id: &str,
    ) -> ExecutorResult<Vec<ExecutionSnapshot>> {
        self.persistence.get_incomplete(tenant_id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_persistence() {
        let persistence = InMemoryPersistence::new();

        let snapshot = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec!["node-1".to_string()],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        // Save
        persistence.save_snapshot(&snapshot).await.unwrap();

        // Load
        let loaded = persistence
            .load_snapshot(snapshot.execution_id)
            .await
            .unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.execution_id, snapshot.execution_id);
        assert_eq!(loaded.tenant_id, "tenant-1");
    }

    #[tokio::test]
    async fn test_list_snapshots() {
        let persistence = InMemoryPersistence::new();

        // Create multiple snapshots
        for i in 0..5 {
            let snapshot = ExecutionSnapshot {
                execution_id: Uuid::new_v4(),
                tenant_id: "tenant-1".to_string(),
                flow_id: "flow-1".to_string(),
                flow_version: None,
                status: ExecutionStatus::Completed,
                inputs: Value::Null,
                variables: HashMap::new(),
                completed_nodes: vec![format!("node-{}", i)],
                failed_nodes: vec![],
                current_nodes: vec![],
                history: vec![],
                created_at: Utc::now(),
                updated_at: Utc::now(),
                metadata: HashMap::new(),
            };
            persistence.save_snapshot(&snapshot).await.unwrap();
        }

        // List
        let snapshots = persistence
            .list_snapshots("tenant-1", "flow-1", 10)
            .await
            .unwrap();
        assert_eq!(snapshots.len(), 5);

        // List with limit
        let snapshots = persistence
            .list_snapshots("tenant-1", "flow-1", 3)
            .await
            .unwrap();
        assert_eq!(snapshots.len(), 3);
    }

    #[tokio::test]
    async fn test_delete_snapshot() {
        let persistence = InMemoryPersistence::new();

        let execution_id = Uuid::new_v4();
        let snapshot = ExecutionSnapshot {
            execution_id,
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Completed,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec![],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        persistence.save_snapshot(&snapshot).await.unwrap();
        assert!(
            persistence
                .load_snapshot(execution_id)
                .await
                .unwrap()
                .is_some()
        );

        persistence.delete_snapshot(execution_id).await.unwrap();
        assert!(
            persistence
                .load_snapshot(execution_id)
                .await
                .unwrap()
                .is_none()
        );
    }

    #[tokio::test]
    async fn test_list_incomplete_executions() {
        let persistence = InMemoryPersistence::new();

        // Create completed and running snapshots
        let completed = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Completed,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec![],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        let running = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-2".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec!["node-1".to_string()],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        persistence.save_snapshot(&completed).await.unwrap();
        persistence.save_snapshot(&running).await.unwrap();

        // List incomplete
        let incomplete = persistence
            .list_incomplete_executions("tenant-1")
            .await
            .unwrap();
        assert_eq!(incomplete.len(), 1);
        assert_eq!(incomplete[0].status, ExecutionStatus::Running);
    }

    #[tokio::test]
    async fn test_persistence_manager() {
        let manager = PersistenceManager::in_memory();

        let snapshot = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec![],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        manager.save(&snapshot).await.unwrap();
        let loaded = manager.load(snapshot.execution_id).await.unwrap();
        assert!(loaded.is_some());
    }

    #[test]
    fn test_should_snapshot() {
        let manager = PersistenceManager::in_memory();

        // Default config: persist_on_node_complete = true
        assert!(manager.should_snapshot(0));
        assert!(manager.should_snapshot(1));
        assert!(manager.should_snapshot(5));
    }

    #[tokio::test]
    async fn test_recovery_service() {
        let persistence = Arc::new(PersistenceManager::in_memory());
        let recovery = RecoveryService::new(persistence.clone());

        // Create a snapshot with some state
        let execution_id = Uuid::new_v4();
        let mut variables = HashMap::new();
        variables.insert("node1".to_string(), Value::Int(42));

        let snapshot = ExecutionSnapshot {
            execution_id,
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::object([("input", Value::string("test"))]),
            variables,
            completed_nodes: vec!["node1".to_string()],
            failed_nodes: vec![],
            current_nodes: vec!["node2".to_string()],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        persistence.save(&snapshot).await.unwrap();

        // Recover
        let context = recovery.recover(execution_id).await.unwrap();
        assert!(context.is_completed("node1"));
        assert_eq!(context.variables().get("node1"), Some(&Value::Int(42)));
    }

    #[test]
    fn test_execution_snapshot_from_context() {
        let mut context = ExecutionContext::new();
        context.set_inputs(Value::object([("key", Value::string("value"))]));
        context.set_variable("node1", Value::Int(1));
        context.mark_completed("node1");

        let snapshot = ExecutionSnapshot::from_context(
            Uuid::new_v4(),
            "tenant-1",
            "flow-1",
            &context,
            ExecutionStatus::Running,
        );

        assert_eq!(snapshot.tenant_id, "tenant-1");
        assert_eq!(snapshot.flow_id, "flow-1");
        assert_eq!(snapshot.status, ExecutionStatus::Running);
        assert!(snapshot.completed_nodes.contains(&"node1".to_string()));
    }

    #[test]
    fn test_snapshot_mark_node_completed() {
        let mut snapshot = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec!["node1".to_string()],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        snapshot.mark_node_completed("node1", Value::Int(100));

        assert!(snapshot.completed_nodes.contains(&"node1".to_string()));
        assert!(!snapshot.current_nodes.contains(&"node1".to_string()));
        assert_eq!(snapshot.variables.get("node1"), Some(&Value::Int(100)));
    }

    #[test]
    fn test_snapshot_mark_node_failed() {
        let mut snapshot = ExecutionSnapshot {
            execution_id: Uuid::new_v4(),
            tenant_id: "tenant-1".to_string(),
            flow_id: "flow-1".to_string(),
            flow_version: None,
            status: ExecutionStatus::Running,
            inputs: Value::Null,
            variables: HashMap::new(),
            completed_nodes: vec![],
            failed_nodes: vec![],
            current_nodes: vec!["node1".to_string()],
            history: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            metadata: HashMap::new(),
        };

        snapshot.mark_node_failed("node1", "Test error");

        assert!(snapshot.failed_nodes.contains(&"node1".to_string()));
        assert!(!snapshot.current_nodes.contains(&"node1".to_string()));
        assert_eq!(snapshot.history.len(), 1);
        assert_eq!(snapshot.history[0].error, Some("Test error".to_string()));
    }
}
