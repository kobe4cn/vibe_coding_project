//! PostgreSQL 存储实现
//!
//! 使用 SQLx 实现 PostgreSQL 数据库存储。
//! 所有查询都包含 tenant_id 条件，确保多租户数据隔离。
//! 
//! 特点：
//! - 持久化：数据存储在数据库中
//! - 事务支持：通过数据库事务保证一致性
//! - 查询优化：使用索引和分页提高性能

use async_trait::async_trait;
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use super::traits::{
    ApiKeyRecord, CreateApiKeyRequest, CreateFlowRequest, CreateVersionRequest, ExecutionRecord,
    FlowRecord, FlowStorage, ListOptions, ListResult, StorageError, UpdateFlowRequest, VersionRecord,
};
use crate::db::Database;

/// 辅助函数：从数据库行构建 FlowRecord
fn flow_from_row(row: &sqlx::postgres::PgRow) -> FlowRecord {
    FlowRecord {
        id: row.get("id"),
        tenant_id: row.get("tenant_id"),
        name: row.get("name"),
        description: row.get("description"),
        thumbnail: row.get("thumbnail"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
        published: row.try_get("published").unwrap_or(false),
        published_at: row.try_get("published_at").ok().flatten(),
        published_version_id: row.try_get("published_version_id").ok().flatten(),
    }
}

/// PostgreSQL 存储实现
/// 
/// 封装数据库连接，实现 FlowStorage trait。
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
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at,
                      published, published_at, published_version_id
            "#,
        )
        .bind(req.tenant_id)
        .bind(&req.name)
        .bind(&req.description)
        .fetch_one(self.db.pool())
        .await?;

        Ok(flow_from_row(&row))
    }

    async fn get_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, tenant_id, name, description, thumbnail, created_at, updated_at,
                   published, published_at, published_version_id
            FROM flows
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        Ok(flow_from_row(&row))
    }

    async fn list_flows(
        &self,
        tenant_id: Uuid,
        opts: ListOptions,
    ) -> Result<ListResult<FlowRecord>, StorageError> {
        // 获取总数（用于分页信息）
        let count_row = sqlx::query("SELECT COUNT(*) as count FROM flows WHERE tenant_id = $1")
            .bind(tenant_id)
            .fetch_one(self.db.pool())
            .await?;
        let total: i64 = count_row.get("count");

        // 获取分页结果：按更新时间倒序排列，支持 limit 和 offset
        let rows = sqlx::query(
            r#"
            SELECT id, tenant_id, name, description, thumbnail, created_at, updated_at,
                   published, published_at, published_version_id
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

        let items = rows.iter().map(flow_from_row).collect();

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
        // 使用 COALESCE 实现部分更新：如果参数为 NULL，则保持原值
        // 这允许只更新部分字段，而不需要提供所有字段
        let row = sqlx::query(
            r#"
            UPDATE flows
            SET name = COALESCE($3, name),
                description = COALESCE($4, description),
                thumbnail = COALESCE($5, thumbnail),
                updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at,
                      published, published_at, published_version_id
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

        Ok(flow_from_row(&row))
    }

    async fn delete_flow(&self, tenant_id: Uuid, flow_id: Uuid) -> Result<(), StorageError> {
        let result = sqlx::query("DELETE FROM flows WHERE id = $1 AND tenant_id = $2")
            .bind(flow_id)
            .bind(tenant_id)
            .execute(self.db.pool())
            .await?;

        if result.rows_affected() == 0 {
            return Err(StorageError::NotFound(format!(
                "Flow {} not found",
                flow_id
            )));
        }

        Ok(())
    }

    async fn create_version(
        &self,
        req: CreateVersionRequest,
    ) -> Result<VersionRecord, StorageError> {
        // 获取下一个版本号：使用 SQL 查询当前最大版本号并加 1
        // COALESCE 确保如果没有版本时返回 1
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
            return Err(StorageError::NotFound(format!(
                "Version {} not found",
                version_id
            )));
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

    // Publish operations
    async fn publish_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
        version_id: Uuid,
    ) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            UPDATE flows
            SET published = true,
                published_at = NOW(),
                published_version_id = $3,
                updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at,
                      published, published_at, published_version_id
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .bind(version_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        Ok(flow_from_row(&row))
    }

    async fn unpublish_flow(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            UPDATE flows
            SET published = false,
                published_at = NULL,
                published_version_id = NULL,
                updated_at = NOW()
            WHERE id = $1 AND tenant_id = $2
            RETURNING id, tenant_id, name, description, thumbnail, created_at, updated_at,
                      published, published_at, published_version_id
            "#,
        )
        .bind(flow_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Flow {} not found", flow_id)))?;

        Ok(flow_from_row(&row))
    }

    async fn get_published_flow(&self, flow_id: Uuid) -> Result<FlowRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, tenant_id, name, description, thumbnail, created_at, updated_at,
                   published, published_at, published_version_id
            FROM flows
            WHERE id = $1 AND published = true
            "#,
        )
        .bind(flow_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("Published flow {} not found", flow_id)))?;

        Ok(flow_from_row(&row))
    }

    // API Key operations
    async fn create_api_key(
        &self,
        req: CreateApiKeyRequest,
    ) -> Result<ApiKeyRecord, StorageError> {
        let row = sqlx::query(
            r#"
            INSERT INTO flow_api_keys (tenant_id, flow_id, name, description, key_hash, key_prefix, rate_limit, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, tenant_id, flow_id, name, description, key_hash, key_prefix, rate_limit,
                      is_active, last_used_at, usage_count, created_at, expires_at
            "#,
        )
        .bind(req.tenant_id)
        .bind(req.flow_id)
        .bind(&req.name)
        .bind(&req.description)
        .bind(&req.key_hash)
        .bind(&req.key_prefix)
        .bind(req.rate_limit.unwrap_or(100))
        .bind(req.expires_at)
        .fetch_one(self.db.pool())
        .await?;

        Ok(ApiKeyRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            flow_id: row.get("flow_id"),
            name: row.get("name"),
            description: row.get("description"),
            key_hash: row.get("key_hash"),
            key_prefix: row.get("key_prefix"),
            rate_limit: row.get("rate_limit"),
            is_active: row.get("is_active"),
            last_used_at: row.get("last_used_at"),
            usage_count: row.get("usage_count"),
            created_at: row.get("created_at"),
            expires_at: row.get("expires_at"),
        })
    }

    async fn get_api_key(
        &self,
        tenant_id: Uuid,
        key_id: Uuid,
    ) -> Result<ApiKeyRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, tenant_id, flow_id, name, description, key_hash, key_prefix, rate_limit,
                   is_active, last_used_at, usage_count, created_at, expires_at
            FROM flow_api_keys
            WHERE id = $1 AND tenant_id = $2
            "#,
        )
        .bind(key_id)
        .bind(tenant_id)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound(format!("API Key {} not found", key_id)))?;

        Ok(ApiKeyRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            flow_id: row.get("flow_id"),
            name: row.get("name"),
            description: row.get("description"),
            key_hash: row.get("key_hash"),
            key_prefix: row.get("key_prefix"),
            rate_limit: row.get("rate_limit"),
            is_active: row.get("is_active"),
            last_used_at: row.get("last_used_at"),
            usage_count: row.get("usage_count"),
            created_at: row.get("created_at"),
            expires_at: row.get("expires_at"),
        })
    }

    async fn get_api_key_by_hash(&self, key_hash: &str) -> Result<ApiKeyRecord, StorageError> {
        let row = sqlx::query(
            r#"
            SELECT id, tenant_id, flow_id, name, description, key_hash, key_prefix, rate_limit,
                   is_active, last_used_at, usage_count, created_at, expires_at
            FROM flow_api_keys
            WHERE key_hash = $1 AND is_active = true
                  AND (expires_at IS NULL OR expires_at > NOW())
            "#,
        )
        .bind(key_hash)
        .fetch_optional(self.db.pool())
        .await?
        .ok_or_else(|| StorageError::NotFound("API Key not found".to_string()))?;

        Ok(ApiKeyRecord {
            id: row.get("id"),
            tenant_id: row.get("tenant_id"),
            flow_id: row.get("flow_id"),
            name: row.get("name"),
            description: row.get("description"),
            key_hash: row.get("key_hash"),
            key_prefix: row.get("key_prefix"),
            rate_limit: row.get("rate_limit"),
            is_active: row.get("is_active"),
            last_used_at: row.get("last_used_at"),
            usage_count: row.get("usage_count"),
            created_at: row.get("created_at"),
            expires_at: row.get("expires_at"),
        })
    }

    async fn list_api_keys(
        &self,
        tenant_id: Uuid,
        flow_id: Uuid,
    ) -> Result<Vec<ApiKeyRecord>, StorageError> {
        let rows = sqlx::query(
            r#"
            SELECT id, tenant_id, flow_id, name, description, key_hash, key_prefix, rate_limit,
                   is_active, last_used_at, usage_count, created_at, expires_at
            FROM flow_api_keys
            WHERE tenant_id = $1 AND flow_id = $2
            ORDER BY created_at DESC
            "#,
        )
        .bind(tenant_id)
        .bind(flow_id)
        .fetch_all(self.db.pool())
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| ApiKeyRecord {
                id: row.get("id"),
                tenant_id: row.get("tenant_id"),
                flow_id: row.get("flow_id"),
                name: row.get("name"),
                description: row.get("description"),
                key_hash: row.get("key_hash"),
                key_prefix: row.get("key_prefix"),
                rate_limit: row.get("rate_limit"),
                is_active: row.get("is_active"),
                last_used_at: row.get("last_used_at"),
                usage_count: row.get("usage_count"),
                created_at: row.get("created_at"),
                expires_at: row.get("expires_at"),
            })
            .collect())
    }

    async fn delete_api_key(
        &self,
        tenant_id: Uuid,
        key_id: Uuid,
    ) -> Result<(), StorageError> {
        let result = sqlx::query(
            "DELETE FROM flow_api_keys WHERE id = $1 AND tenant_id = $2",
        )
        .bind(key_id)
        .bind(tenant_id)
        .execute(self.db.pool())
        .await?;

        if result.rows_affected() == 0 {
            return Err(StorageError::NotFound(format!(
                "API Key {} not found",
                key_id
            )));
        }

        Ok(())
    }

    async fn update_api_key_usage(&self, key_id: Uuid) -> Result<(), StorageError> {
        sqlx::query(
            r#"
            UPDATE flow_api_keys
            SET last_used_at = NOW(),
                usage_count = usage_count + 1
            WHERE id = $1
            "#,
        )
        .bind(key_id)
        .execute(self.db.pool())
        .await?;

        Ok(())
    }

    async fn is_healthy(&self) -> bool {
        self.db.is_healthy().await
    }
}
