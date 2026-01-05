//! PostgreSQL storage implementation

use async_trait::async_trait;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::db::Database;
use super::traits::{
    CreateFlowRequest, CreateVersionRequest, ExecutionRecord, FlowRecord, FlowStorage,
    ListOptions, ListResult, StorageError, UpdateFlowRequest, VersionRecord,
};

/// PostgreSQL storage implementation
pub struct PostgresStorage {
    db: Arc<Database>,
}

impl PostgresStorage {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }
}

#[async_trait]
impl FlowStorage for PostgresStorage {
    async fn create_flow(&self, req: CreateFlowRequest) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            INSERT INTO flows (tenant_id, name, description)
            VALUES ($1, $2, $3)
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at
            "#,
        )
        .bind(req.tenant_id)
        .bind(&req.name)
        .bind(&req.description)
        .fetch_one(self.db.pool())
        .await?;

        Ok(FlowRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            name: row.get("name"),
            description: row.get("description"),
            thumbnail: row.get("thumbnail"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn get_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, tenant_id, name, description, thumbnail, created_at, updated_at
            FROM flows
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        Ok(FlowRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            name: row.get("name"),
            description: row.get("description"),
            thumbnail: row.get("thumbnail"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn list_flows(
        &self,
        tenant_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<FlowRecord>, StorageError> {
        // Get total count
        let count_row = sqlx::query("SELECT COUNT(*) as count FROM flows WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(self.db.pool())
            .await?;
        let total: i64 = count_row.get("count");

        // Get paginated results
        let rows = sqlx::query(
            r#"
            SELECT id, tenant_id, name, description, thumbnail, created_at, updated_at
            FROM flows
            WHERE tenant_id = $1
            ORDER BY updated_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(tenant_id)
        .bind(opts.limit as i64)
        .bind(opts.offset as i64)
        .fetch_all(self.db.pool())
        .await?;

        let items = rows
            .into_iter()
            .map(|row| FlowRecord {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                name: row.get("name"),
                description: row.get("description"),
                thumbnail: row.get("thumbnail"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(ListResult {
            items,
            total: total as usize,
        })
    }

    async fn update_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        req: UpdateFlowRequest,
    ) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            UPDATE flows
            SET name = COALESCE($3, name),
                description = COALESCE($4, description),
                thumbnail = COALESCE($5, thumbnail),
                updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.thumbnail)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        Ok(FlowRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            name: row.get("name"),
            description: row.get("description"),
            thumbnail: row.get("thumbnail"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn delete_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<(), StorageError> {
        let result = sqlx::query("DELETE FROM flows WHERE id = $1 AND tenant_id = $2")
            .bind(flow_id)
            .bind(tenant_id)
            .execute(self.db.pool())
            .await?;

        if result.rows_affected() == 0 {
            return Err(StorageError::NotFound(format!("Flow {} not found", flow_id)));
        }

        Ok(())
    }

    async fn create_version(&self, req: CreateVersionRequest) -> Result<VersionRecord, StorageError> {
        // Get next version number
        let version_row = sqlx::query(
            "SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM flow_versions WHERE flow_id = $1"
        )
        .bind(req.flow_id)
        .fetch_one(self.db.pool())
        .await?;
        let next_version: i32 = version_row.get("next_version");

        let row = sqlx::query(
            r#"
            INSERT INTO flow_versions (flow_id, tenant_id, version_number, label, data)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, flow_id, tenant_id, version_number, label, data, created_at
            "#,
        )
        .bind(req.flow_id)
        .bind(req.tenant_id)
        .bind(next_version)
        .bind(&req.label)
        .bind(&req.data)
        .fetch_one(self.db.pool())
        .await?;

        Ok(VersionRecord {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            tenant_id: row.get("tenant_id"),
            version_number: row.get("version_number"),
            label: row.get("label"),
            data: row.get("data"),
            created_at: row.get("created_at"),
        })
    }

    async fn get_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<VersionRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, flow_id, tenant_id, version_number, label, data, created_at
            FROM flow_versions
            WHERE id = $1 AND flow_id = $2 AND tenant_id = $3
            "#,
        )
        .bind(version_id)
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Version {} not found", version_id)))?;

        Ok(VersionRecord {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            tenant_id: row.get("tenant_id"),
            version_number: row.get("version_number"),
            label: row.get("label"),
            data: row.get("data"),
            created_at: row.get("created_at"),
        })
    }

    async fn list_versions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Vec<VersionRecord>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT id, flow_id, tenant_id, version_number, label, data, created_at
            FROM flow_versions
            WHERE flow_id = $1 AND tenant_id = $2
            ORDER BY version_number DESC
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_all(self.db.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| VersionRecord {
                id: row.get("id"),
                flow_id: row.get("flow_id"),
                tenant_id: row.get("tenant_id"),
                version_number: row.get("version_number"),
                label: row.get("label"),
                data: row.get("data"),
                created_at: row.get("created_at"),
            })
            .collect())
    }

    async fn delete_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<(), StorageError> {
        let result = sqlx::query(
            "DELETE FROM flow_versions WHERE id = $1 AND flow_id = $2 AND tenant_id = $3",
        )
        .bind(version_id)
        .bind(flow_id)
        .bind(tenant_id)
        .execute(self.db.pool())
        .await?;

        if result.rows_affected() == 0 {
            return Err(StorageError::NotFound(format!("Version {} not found", version_id)));
        }

        Ok(())
    }

    async fn get_latest_version(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Option<VersionRecord>, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, flow_id, tenant_id, version_number, label, data, created_at
            FROM flow_versions
            WHERE flow_id = $1 AND tenant_id = $2
            ORDER BY version_number DESC
            LIMIT 1
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?;

        Ok(row.map(|row| VersionRecord {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            tenant_id: row.get("tenant_id"),
            version_number: row.get("version_number"),
            label: row.get("label"),
            data: row.get("data"),
            created_at: row.get("created_at"),
        }))
    }

    async fn create_execution(
        &self,
        flow_id: Uuid,
        version_id: Option<Uuid>,
        tenant_id: Uuid,
        inputs: Option<serde_json::Value>,
    ) -> Result<ExecutionRecord, StorageError> {
        let row = sqlx::query(
            r#"
            INSERT INTO execution_snapshots (flow_id, version_id, tenant_id, status, inputs)
            VALUES ($1, $2, $3, 'pending', $4)
            RETURNING id, flow_id, version_id, tenant_id, status::TEXT, inputs, outputs, error_message, started_at, completed_at
            "#,
        )
        .bind(flow_id)
        .bind(version_id)
        .bind(tenant_id)
        .bind(&inputs)
        .fetch_one(self.db.pool())
        .await?;

        Ok(ExecutionRecord {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            version_id: row.get("version_id"),
            tenant_id: row.get("tenant_id"),
            status: row.get("status"),
            inputs: row.get("inputs"),
            outputs: row.get("outputs"),
            error: row.get("error_message"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
        })
    }

    async fn get_execution(
        &self,
        tenant_id: Uuid,
        execution_id: Uuid,
    ) -> Result<ExecutionRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, flow_id, version_id, tenant_id, status::TEXT, inputs, outputs, error_message, started_at, completed_at
            FROM execution_snapshots
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(execution_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Execution {} not found", execution_id)))?;

        Ok(ExecutionRecord {
            id: row.get("id"),
            flow_id: row.get("flow_id"),
            version_id: row.get("version_id"),
            tenant_id: row.get("tenant_id"),
            status: row.get("status"),
            inputs: row.get("inputs"),
            outputs: row.get("outputs"),
            error: row.get("error_message"),
            started_at: row.get("started_at"),
            completed_at: row.get("completed_at"),
        })
    }

    async fn update_execution_status(
        &self,
        execution_id: Uuid,
        status: &str,
        outputs: Option<serde_json::Value>,
        error: Option<String>,
    ) -> Result<(), StorageError> {
        let completed_at = if status == "completed" || status == "failed" || status == "cancelled" {
            Some(chrono::Utc::now())
        } else {
            None
        };

        let result = sqlx::query(
            r#"
            UPDATE execution_snapshots
            SET status = $2::execution_status,
                outputs = COALESCE($3, outputs),
                error_message = COALESCE($4, error_message),
                completed_at = COALESCE($5, completed_at)
            WHERE id = $1
            "#,
        )
        .bind(execution_id)
        .bind(status)
        .bind(&outputs)
        .bind(&error)
        .bind(completed_at)
        .execute(self.db.pool())
        .await?;

        if result.rows_affected() == 0 {
            return Err(StorageError::NotFound(format!(
                "Execution {} not found",
                execution_id
            )));
        }

        Ok(())
    }

    async fn list_executions(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<ExecutionRecord>, StorageError> {
        // Get total count
        let count_row = sqlx::query(
            "SELECT COUNT(*) as count FROM execution_snapshots WHERE tenant_id = $1 AND flow_id = $2",
        )
        .bind(tenant_id)
        .bind(flow_id)
        .fetch_one(self.db.pool())
        .await?;
        let total: i64 = count_row.get("count");

        // Get paginated results
        let rows = sqlx::query(
            r#"
            SELECT id, flow_id, version_id, tenant_id, status::TEXT, inputs, outputs, error_message, started_at, completed_at
            FROM execution_snapshots
            WHERE tenant_id = $1 AND flow_id = $2
            ORDER BY started_at DESC
            LIMIT $3 OFFSET $4
            "#,
        )
        .bind(tenant_id)
        .bind(flow_id)
        .bind(opts.limit as i64)
        .bind(opts.offset as i64)
        .fetch_all(self.db.pool())
        .await?;

        let items = rows
            .into_iter()
            .map(|row| ExecutionRecord {
                id: row.get("id"),
                flow_id: row.get("flow_id"),
                version_id: row.get("version_id"),
                tenant_id: row.get("tenant_id"),
                status: row.get("status"),
                inputs: row.get("inputs"),
                outputs: row.get("outputs"),
                error: row.get("error_message"),
                started_at: row.get("started_at"),
                completed_at: row.get("completed_at"),
            })
            .collect();

        Ok(ListResult {
            items,
            total: total as usize,
        })
    }

    async fn is_healthy(&self) -> bool {
        self.db.is_healthy().await
    }
}
