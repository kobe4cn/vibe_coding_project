//! 内存存储实现
//!
//! 使用 DashMap 实现线程安全的并发访问。
//! 适用于开发和测试，数据在服务重启后丢失。
//! 
//! 特点：
//! - 快速：无 I/O 操作
//! - 简单：无需数据库配置
//! - 临时：数据不持久化

use async_trait::async_trait;
use chrono::Utc;
use dashmap::DashMap;
use uuid::Uuid;

use super::traits::{
    CreateFlowRequest, CreateVersionRequest, ExecutionRecord, FlowRecord, FlowStorage, ListOptions,
    ListResult, StorageError, UpdateFlowRequest, VersionRecord,
};

/// 内存存储实现
/// 
/// 使用 DashMap 存储流程、版本和执行记录。
/// DashMap 提供线程安全的并发访问，适合多线程环境。
pub struct MemoryStorage {
    flows: DashMap<Uuid, FlowRecord>,
    versions: DashMap<Uuid, VersionRecord>,
    executions: DashMap<Uuid, ExecutionRecord>,
}

impl MemoryStorage {
    pub fn new() -> Self {
        Self {
            flows: DashMap::new(),
            versions: DashMap::new(),
            executions: DashMap::new(),
        }
    }
}

impl Default for MemoryStorage {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl FlowStorage for MemoryStorage {
    async fn create_flow(&self, req: CreateFlowRequest) -> Result<FlowRecord, StorageError> {
        let now = Utc::now();
        let flow = FlowRecord {
            id: Uuid::new_v4(),
            tenant_id: req.tenant_id,
            name: req.name,
            description: req.description,
            thumbnail: None,
            created_at: now,
            updated_at: now,
        };
        self.flows.insert(flow.id, flow.clone());
        Ok(flow)
    }

    async fn get_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<FlowRecord, StorageError> {
        self.flows
            .get(&flow_id)
            .filter(|f| f.tenant_id == tenant_id)
            .map(|f| f.clone())
            .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))
    }

    async fn list_flows(
        &self,
        tenant_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<FlowRecord>, StorageError> {
        let mut flows: Vec<FlowRecord> = self
            .flows
            .iter()
            .filter(|f| f.tenant_id == tenant_id)
            .map(|f| f.clone())
            .collect();

        flows.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
        let total = flows.len();
        let items = flows
            .into_iter()
            .skip(opts.offset)
            .take(opts.limit)
            .collect();

        Ok(ListResult { items, total })
    }

    async fn update_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        req: UpdateFlowRequest,
    ) -> Result<FlowRecord, StorageError> {
        let mut entry = self
            .flows
            .get_mut(&flow_id)
            .filter(|f| f.tenant_id == tenant_id)
            .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        if let Some(name) = req.name {
            entry.name = name;
        }
        if let Some(desc) = req.description {
            entry.description = Some(desc);
        }
        if let Some(thumb) = req.thumbnail {
            entry.thumbnail = Some(thumb);
        }
        entry.updated_at = Utc::now();

        Ok(entry.clone())
    }

    async fn delete_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<(), StorageError> {
        // 检查租户所有权（确保多租户隔离）
        if !self
            .flows
            .get(&flow_id)
            .map(|f| f.tenant_id == tenant_id)
            .unwrap_or(false)
        {
            return Err(StorageError::NotFound(format!(
                "Flow {} not found",
                flow_id
            )));
        }

        // 级联删除：先删除所有版本
        let version_ids: Vec<Uuid> = self
            .versions
            .iter()
            .filter(|v| v.flow_id == flow_id)
            .map(|v| v.id)
            .collect();
        for vid in version_ids {
            self.versions.remove(&vid);
        }

        // 删除流程
        self.flows.remove(&flow_id);
        Ok(())
    }

    async fn create_version(
        &self,
        req: CreateVersionRequest,
    ) -> Result<VersionRecord, StorageError> {
        // 获取下一个版本号：查找该流程的最大版本号并加 1
        let version_number = self
            .versions
            .iter()
            .filter(|v| v.flow_id == req.flow_id)
            .map(|v| v.version_number)
            .max()
            .unwrap_or(0)
            + 1;

        let version = VersionRecord {
            id: Uuid::new_v4(),
            flow_id: req.flow_id,
            tenant_id: req.tenant_id,
            version_number,
            label: req.label,
            data: req.data,
            created_at: Utc::now(),
        };
        self.versions.insert(version.id, version.clone());

        // Update flow's updated_at
        if let Some(mut flow) = self.flows.get_mut(&req.flow_id) {
            flow.updated_at = Utc::now();
        }

        Ok(version)
    }

    async fn get_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<VersionRecord, StorageError> {
        self.versions
            .get(&version_id)
            .filter(|v| v.tenant_id == tenant_id && v.flow_id == flow_id)
            .map(|v| v.clone())
            .ok_or_else(|| StorageError::NotFound(format!("Version {} not found", version_id)))
    }

    async fn list_versions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Vec<VersionRecord>, StorageError> {
        let mut versions: Vec<VersionRecord> = self
            .versions
            .iter()
            .filter(|v| v.tenant_id == tenant_id && v.flow_id == flow_id)
            .map(|v| v.clone())
            .collect();

        versions.sort_by(|a, b| b.version_number.cmp(&a.version_number));
        Ok(versions)
    }

    async fn delete_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<(), StorageError> {
        let version = self
            .versions
            .get(&version_id)
            .filter(|v| v.tenant_id == tenant_id && v.flow_id == flow_id)
            .ok_or_else(|| StorageError::NotFound(format!("Version {} not found", version_id)))?;

        drop(version);
        self.versions.remove(&version_id);
        Ok(())
    }

    async fn get_latest_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Option<VersionRecord>, StorageError> {
        let latest = self
            .versions
            .iter()
            .filter(|v| v.tenant_id == tenant_id && v.flow_id == flow_id)
            .max_by_key(|v| v.version_number)
            .map(|v| v.clone());

        Ok(latest)
    }

    async fn create_execution(
        &self,
        flow_id: Uuid,
        version_id: Option<Uuid>,
        tenant_id: Uuid,
        inputs: Option<serde_json::Value>,
    ) -> Result<ExecutionRecord, StorageError> {
        let execution = ExecutionRecord {
            id: Uuid::new_v4(),
            flow_id,
            version_id,
            tenant_id,
            status: "pending".to_string(),
            inputs,
            outputs: None,
            error: None,
            started_at: Utc::now(),
            completed_at: None,
        };
        self.executions.insert(execution.id, execution.clone());
        Ok(execution)
    }

    async fn get_execution(
        &self,
        tenant_id: Uuid,
        execution_id: Uuid,
    ) -> Result<ExecutionRecord, StorageError> {
        self.executions
            .get(&execution_id)
            .filter(|e| e.tenant_id == tenant_id)
            .map(|e| e.clone())
            .ok_or_else(|| StorageError::NotFound(format!("Execution {} not found", execution_id)))
    }

    async fn update_execution_status(
        &self,
        execution_id: Uuid,
        status: &str,
        outputs: Option<serde_json::Value>,
        error: Option<String>,
    ) -> Result<(), StorageError> {
        let mut entry = self.executions.get_mut(&execution_id).ok_or_else(|| {
            StorageError::NotFound(format!("Execution {} not found", execution_id))
        })?;

        entry.status = status.to_string();
        if let Some(out) = outputs {
            entry.outputs = Some(out);
        }
        if let Some(err) = error {
            entry.error = Some(err);
        }
        if status == "completed" || status == "failed" || status == "cancelled" {
            entry.completed_at = Some(Utc::now());
        }

        Ok(())
    }

    async fn list_executions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<ExecutionRecord>, StorageError> {
        let mut executions: Vec<ExecutionRecord> = self
            .executions
            .iter()
            .filter(|e| e.tenant_id == tenant_id && e.flow_id == flow_id)
            .map(|e| e.clone())
            .collect();

        executions.sort_by(|a, b| b.started_at.cmp(&a.started_at));
        let total = executions.len();
        let items = executions
            .into_iter()
            .skip(opts.offset)
            .take(opts.limit)
            .collect();

        Ok(ListResult { items, total })
    }

    async fn is_healthy(&self) -> bool {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_flow_crud() {
        let storage = MemoryStorage::new();
        let tenant_id = Uuid::new_v4();

        // Create
        let flow = storage
            .create_flow(CreateFlowRequest {
                tenant_id,
                name: "Test Flow".to_string(),
                description: Some("Description".to_string()),
            })
            .await
            .unwrap();

        assert_eq!(flow.name, "Test Flow");

        // Get
        let retrieved = storage.get_flow(tenant_id, flow.id).await.unwrap();
        assert_eq!(retrieved.id, flow.id);

        // Update
        let updated = storage
            .update_flow(
                tenant_id,
                flow.id,
                UpdateFlowRequest {
                    name: Some("Updated".to_string()),
                    description: None,
                    thumbnail: None,
                },
            )
            .await
            .unwrap();
        assert_eq!(updated.name, "Updated");

        // List
        let result = storage
            .list_flows(
                tenant_id,
                ListOptions {
                    limit: 10,
                    offset: 0,
                },
            )
            .await
            .unwrap();
        assert_eq!(result.total, 1);

        // Delete
        storage.delete_flow(tenant_id, flow.id).await.unwrap();
        assert!(storage.get_flow(tenant_id, flow.id).await.is_err());
    }

    #[tokio::test]
    async fn test_version_crud() {
        let storage = MemoryStorage::new();
        let tenant_id = Uuid::new_v4();

        let flow = storage
            .create_flow(CreateFlowRequest {
                tenant_id,
                name: "Test".to_string(),
                description: None,
            })
            .await
            .unwrap();

        // Create versions
        let v1 = storage
            .create_version(CreateVersionRequest {
                flow_id: flow.id,
                tenant_id,
                data: serde_json::json!({"v": 1}),
                label: None,
            })
            .await
            .unwrap();

        let v2 = storage
            .create_version(CreateVersionRequest {
                flow_id: flow.id,
                tenant_id,
                data: serde_json::json!({"v": 2}),
                label: Some("Release".to_string()),
            })
            .await
            .unwrap();

        assert_eq!(v1.version_number, 1);
        assert_eq!(v2.version_number, 2);

        // List
        let versions = storage.list_versions(tenant_id, flow.id).await.unwrap();
        assert_eq!(versions.len(), 2);

        // Get latest
        let latest = storage
            .get_latest_version(tenant_id, flow.id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(latest.version_number, 2);

        // Delete
        storage
            .delete_version(tenant_id, flow.id, v1.id)
            .await
            .unwrap();
        let versions = storage.list_versions(tenant_id, flow.id).await.unwrap();
        assert_eq!(versions.len(), 1);
    }

    #[tokio::test]
    async fn test_tenant_isolation() {
        let storage = MemoryStorage::new();
        let tenant1 = Uuid::new_v4();
        let tenant2 = Uuid::new_v4();

        let flow = storage
            .create_flow(CreateFlowRequest {
                tenant_id: tenant1,
                name: "Tenant1 Flow".to_string(),
                description: None,
            })
            .await
            .unwrap();

        // Tenant2 should not see Tenant1's flow
        assert!(storage.get_flow(tenant2, flow.id).await.is_err());

        // Tenant2's list should be empty
        let result = storage
            .list_flows(
                tenant2,
                ListOptions {
                    limit: 10,
                    offset: 0,
                },
            )
            .await
            .unwrap();
        assert_eq!(result.total, 0);
    }
}
