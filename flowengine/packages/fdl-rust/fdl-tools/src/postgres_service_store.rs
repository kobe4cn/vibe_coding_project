//! PostgreSQL 工具服务存储实现
//!
//! 实现 ToolServiceStore trait，将 ToolService 和 Tool 持久化到 PostgreSQL。

use crate::error::{ToolError, ToolResult};
use crate::models::{
    Tool, ToolArgs, ToolService, ToolServiceConfig, ToolType,
};
use crate::service_store::ToolServiceStore;
use sqlx::PgPool;
use uuid::Uuid;

/// PostgreSQL 工具服务存储
pub struct PostgresToolServiceStore {
    pool: PgPool,
}

impl PostgresToolServiceStore {
    /// 创建新的 PostgreSQL 工具服务存储
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// 解析租户 ID 为 UUID
    fn parse_tenant_id(tenant_id: &str) -> Uuid {
        if tenant_id == "default" || tenant_id == "__global__" {
            Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
        } else {
            Uuid::parse_str(tenant_id).unwrap_or_else(|_| {
                use std::collections::hash_map::DefaultHasher;
                use std::hash::{Hash, Hasher};
                let mut hasher = DefaultHasher::new();
                tenant_id.hash(&mut hasher);
                let hash = hasher.finish();
                Uuid::from_u64_pair(hash, hash.wrapping_mul(31))
            })
        }
    }

    /// 解析 ID 为 UUID
    fn parse_id(id: &str) -> ToolResult<Uuid> {
        Uuid::parse_str(id)
            .map_err(|e| ToolError::InvalidUri(format!("Invalid UUID: {}", e)))
    }

    /// ToolType 转数据库字符串
    fn tool_type_to_string(tool_type: &ToolType) -> &'static str {
        match tool_type {
            ToolType::Api => "api",
            ToolType::Mcp => "mcp",
            ToolType::Db => "db",
            ToolType::Flow => "flow",
            ToolType::Agent => "agent",
            ToolType::Svc => "svc",
            ToolType::Oss => "oss",
            ToolType::Mq => "mq",
            ToolType::Mail => "mail",
            ToolType::Sms => "sms",
        }
    }

    /// 从数据库字符串解析 ToolType
    fn parse_tool_type(s: &str) -> Option<ToolType> {
        ToolType::from_str(s)
    }
}

/// 工具服务数据库行结构
#[derive(sqlx::FromRow)]
struct ToolServiceRow {
    id: Uuid,
    tenant_id: Uuid,
    tool_type: String,
    code: String,
    name: String,
    description: Option<String>,
    config: serde_json::Value,
    enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<ToolServiceRow> for ToolService {
    type Error = ToolError;

    fn try_from(row: ToolServiceRow) -> Result<Self, Self::Error> {
        let tool_type = PostgresToolServiceStore::parse_tool_type(&row.tool_type)
            .ok_or_else(|| ToolError::InvalidUri(format!("Unknown tool type: {}", row.tool_type)))?;

        let config: ToolServiceConfig = serde_json::from_value(row.config)
            .map_err(|e| ToolError::ExecutionError(format!("Failed to parse config: {}", e)))?;

        Ok(ToolService {
            id: row.id.to_string(),
            tool_type,
            code: row.code,
            name: row.name,
            description: row.description,
            config,
            tools: Vec::new(), // 工具列表需要单独加载
            tenant_id: row.tenant_id.to_string(),
            enabled: row.enabled,
            created_at: Some(row.created_at),
            updated_at: Some(row.updated_at),
        })
    }
}

/// 工具数据库行结构
#[derive(sqlx::FromRow)]
struct ToolRow {
    id: Uuid,
    service_id: Uuid,
    code: String,
    name: String,
    description: Option<String>,
    args: serde_json::Value,
    opts: Option<serde_json::Value>,
    enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl TryFrom<ToolRow> for Tool {
    type Error = ToolError;

    fn try_from(row: ToolRow) -> Result<Self, Self::Error> {
        let args: ToolArgs = serde_json::from_value(row.args)
            .map_err(|e| ToolError::ExecutionError(format!("Failed to parse args: {}", e)))?;

        let opts = row.opts
            .map(|v| serde_json::from_value(v))
            .transpose()
            .map_err(|e| ToolError::ExecutionError(format!("Failed to parse opts: {}", e)))?;

        Ok(Tool {
            id: row.id.to_string(),
            service_id: row.service_id.to_string(),
            code: row.code,
            name: row.name,
            description: row.description,
            args,
            opts,
            enabled: row.enabled,
            created_at: Some(row.created_at),
            updated_at: Some(row.updated_at),
        })
    }
}

#[async_trait::async_trait]
impl ToolServiceStore for PostgresToolServiceStore {
    // ==================== ToolService 操作 ====================

    async fn list_services(&self, tenant_id: &str) -> ToolResult<Vec<ToolService>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        let rows: Vec<ToolServiceRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, tool_type, code, name, description,
                   config, enabled, created_at, updated_at
            FROM tool_services
            WHERE tenant_id = $1
            ORDER BY tool_type, code
            "#,
        )
        .bind(tenant_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        rows.into_iter()
            .map(ToolService::try_from)
            .collect()
    }

    async fn list_services_by_type(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
    ) -> ToolResult<Vec<ToolService>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let tool_type_str = Self::tool_type_to_string(&tool_type);

        let rows: Vec<ToolServiceRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, tool_type, code, name, description,
                   config, enabled, created_at, updated_at
            FROM tool_services
            WHERE tenant_id = $1 AND tool_type = $2
            ORDER BY code
            "#,
        )
        .bind(tenant_uuid)
        .bind(tool_type_str)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        rows.into_iter()
            .map(ToolService::try_from)
            .collect()
    }

    async fn get_service(&self, tenant_id: &str, id: &str) -> ToolResult<Option<ToolService>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let service_uuid = Self::parse_id(id)?;

        let row: Option<ToolServiceRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, tool_type, code, name, description,
                   config, enabled, created_at, updated_at
            FROM tool_services
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_uuid)
        .bind(service_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        row.map(ToolService::try_from).transpose()
    }

    async fn get_service_by_code(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
        code: &str,
    ) -> ToolResult<Option<ToolService>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let tool_type_str = Self::tool_type_to_string(&tool_type);

        let row: Option<ToolServiceRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, tool_type, code, name, description,
                   config, enabled, created_at, updated_at
            FROM tool_services
            WHERE tenant_id = $1 AND tool_type = $2 AND code = $3
            "#,
        )
        .bind(tenant_uuid)
        .bind(tool_type_str)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        row.map(ToolService::try_from).transpose()
    }

    async fn save_service(&self, tenant_id: &str, service: ToolService) -> ToolResult<ToolService> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let service_uuid = Uuid::parse_str(&service.id)
            .unwrap_or_else(|_| Uuid::new_v4());
        let tool_type_str = Self::tool_type_to_string(&service.tool_type);
        let config_json = serde_json::to_value(&service.config)
            .map_err(|e| ToolError::ExecutionError(format!("Failed to serialize config: {}", e)))?;

        let row: ToolServiceRow = sqlx::query_as(
            r#"
            INSERT INTO tool_services
                (id, tenant_id, tool_type, code, name, description, config, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (tenant_id, tool_type, code) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                config = EXCLUDED.config,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            RETURNING id, tenant_id, tool_type, code, name, description,
                      config, enabled, created_at, updated_at
            "#,
        )
        .bind(service_uuid)
        .bind(tenant_uuid)
        .bind(tool_type_str)
        .bind(&service.code)
        .bind(&service.name)
        .bind(&service.description)
        .bind(config_json)
        .bind(service.enabled)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        ToolService::try_from(row)
    }

    async fn delete_service(&self, tenant_id: &str, id: &str) -> ToolResult<bool> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let service_uuid = Self::parse_id(id)?;

        // 先删除服务下的所有工具
        sqlx::query("DELETE FROM tools WHERE service_id = $1")
            .bind(service_uuid)
            .execute(&self.pool)
            .await
            .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        // 再删除服务本身
        let result = sqlx::query(
            "DELETE FROM tool_services WHERE tenant_id = $1 AND id = $2"
        )
        .bind(tenant_uuid)
        .bind(service_uuid)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    async fn set_service_enabled(
        &self,
        tenant_id: &str,
        id: &str,
        enabled: bool,
    ) -> ToolResult<bool> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let service_uuid = Self::parse_id(id)?;

        let result = sqlx::query(
            r#"
            UPDATE tool_services
            SET enabled = $3, updated_at = NOW()
            WHERE tenant_id = $1 AND id = $2
            "#
        )
        .bind(tenant_uuid)
        .bind(service_uuid)
        .bind(enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    // ==================== Tool 操作 ====================

    async fn list_tools(&self, _tenant_id: &str, service_id: &str) -> ToolResult<Vec<Tool>> {
        let service_uuid = Self::parse_id(service_id)?;

        let rows: Vec<ToolRow> = sqlx::query_as(
            r#"
            SELECT id, service_id, code, name, description,
                   args, opts, enabled, created_at, updated_at
            FROM tools
            WHERE service_id = $1
            ORDER BY code
            "#,
        )
        .bind(service_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        rows.into_iter()
            .map(Tool::try_from)
            .collect()
    }

    async fn get_tool(&self, _tenant_id: &str, id: &str) -> ToolResult<Option<Tool>> {
        let tool_uuid = Self::parse_id(id)?;

        let row: Option<ToolRow> = sqlx::query_as(
            r#"
            SELECT id, service_id, code, name, description,
                   args, opts, enabled, created_at, updated_at
            FROM tools
            WHERE id = $1
            "#,
        )
        .bind(tool_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        row.map(Tool::try_from).transpose()
    }

    async fn get_tool_by_code(
        &self,
        _tenant_id: &str,
        service_id: &str,
        code: &str,
    ) -> ToolResult<Option<Tool>> {
        let service_uuid = Self::parse_id(service_id)?;

        let row: Option<ToolRow> = sqlx::query_as(
            r#"
            SELECT id, service_id, code, name, description,
                   args, opts, enabled, created_at, updated_at
            FROM tools
            WHERE service_id = $1 AND code = $2
            "#,
        )
        .bind(service_uuid)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        row.map(Tool::try_from).transpose()
    }

    async fn save_tool(&self, _tenant_id: &str, tool: Tool) -> ToolResult<Tool> {
        let tool_uuid = Uuid::parse_str(&tool.id)
            .unwrap_or_else(|_| Uuid::new_v4());
        let service_uuid = Self::parse_id(&tool.service_id)?;
        let args_json = serde_json::to_value(&tool.args)
            .map_err(|e| ToolError::ExecutionError(format!("Failed to serialize args: {}", e)))?;
        let opts_json = tool.opts.as_ref()
            .map(|o| serde_json::to_value(o))
            .transpose()
            .map_err(|e| ToolError::ExecutionError(format!("Failed to serialize opts: {}", e)))?;

        let row: ToolRow = sqlx::query_as(
            r#"
            INSERT INTO tools
                (id, service_id, code, name, description, args, opts, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (service_id, code) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                args = EXCLUDED.args,
                opts = EXCLUDED.opts,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            RETURNING id, service_id, code, name, description,
                      args, opts, enabled, created_at, updated_at
            "#,
        )
        .bind(tool_uuid)
        .bind(service_uuid)
        .bind(&tool.code)
        .bind(&tool.name)
        .bind(&tool.description)
        .bind(args_json)
        .bind(opts_json)
        .bind(tool.enabled)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Tool::try_from(row)
    }

    async fn delete_tool(&self, _tenant_id: &str, id: &str) -> ToolResult<bool> {
        let tool_uuid = Self::parse_id(id)?;

        let result = sqlx::query("DELETE FROM tools WHERE id = $1")
            .bind(tool_uuid)
            .execute(&self.pool)
            .await
            .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    async fn set_tool_enabled(
        &self,
        _tenant_id: &str,
        id: &str,
        enabled: bool,
    ) -> ToolResult<bool> {
        let tool_uuid = Self::parse_id(id)?;

        let result = sqlx::query(
            "UPDATE tools SET enabled = $2, updated_at = NOW() WHERE id = $1"
        )
        .bind(tool_uuid)
        .bind(enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(result.rows_affected() > 0)
    }

    // ==================== 组合查询 ====================

    async fn get_by_uri(
        &self,
        tenant_id: &str,
        uri: &str,
    ) -> ToolResult<Option<(ToolService, Tool)>> {
        // 解析 URI: tool-type://service-code/tool-code
        let parsed = crate::parse_tool_uri(uri)?;

        let tool_type = ToolType::from_str(&parsed.tool_type)
            .ok_or_else(|| ToolError::InvalidUri(format!(
                "Unknown tool type: {}",
                parsed.tool_type
            )))?;

        let path_parts: Vec<&str> = parsed.path.split('/').collect();
        if path_parts.len() < 2 {
            return Err(ToolError::InvalidUri(format!(
                "Invalid URI path: {}",
                parsed.path
            )));
        }

        let service_code = path_parts[0];
        let tool_code = path_parts[1];

        // 查找服务
        let service = self
            .get_service_by_code(tenant_id, tool_type, service_code)
            .await?;

        if let Some(service) = service {
            // 查找工具
            let tool = self
                .get_tool_by_code(tenant_id, &service.id, tool_code)
                .await?;

            if let Some(tool) = tool {
                return Ok(Some((service, tool)));
            }
        }

        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tenant_id() {
        let default_uuid = PostgresToolServiceStore::parse_tenant_id("default");
        assert_eq!(
            default_uuid,
            Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
        );

        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let parsed = PostgresToolServiceStore::parse_tenant_id(uuid_str);
        assert_eq!(parsed.to_string(), uuid_str);

        // 确定性哈希
        let custom1 = PostgresToolServiceStore::parse_tenant_id("my-tenant");
        let custom2 = PostgresToolServiceStore::parse_tenant_id("my-tenant");
        assert_eq!(custom1, custom2);
    }

    #[test]
    fn test_tool_type_conversion() {
        assert_eq!(PostgresToolServiceStore::tool_type_to_string(&ToolType::Api), "api");
        assert_eq!(PostgresToolServiceStore::tool_type_to_string(&ToolType::Mcp), "mcp");
        assert_eq!(PostgresToolServiceStore::tool_type_to_string(&ToolType::Db), "db");

        assert_eq!(PostgresToolServiceStore::parse_tool_type("api"), Some(ToolType::Api));
        assert_eq!(PostgresToolServiceStore::parse_tool_type("mcp"), Some(ToolType::Mcp));
        assert_eq!(PostgresToolServiceStore::parse_tool_type("unknown"), None);
    }
}
