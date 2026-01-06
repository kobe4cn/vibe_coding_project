//! PostgreSQL 配置存储实现
//!
//! 持久化存储 API 服务、数据源和 UDF 配置到 PostgreSQL 数据库。

use crate::config::{
    ApiServiceConfig, AuthType, ConfigStore, DatabaseType, DatasourceConfig, UdfConfig, UdfType,
};
use crate::error::{ToolError, ToolResult};
use sqlx::PgPool;
use uuid::Uuid;

/// PostgreSQL 配置存储
///
/// 将工具配置持久化到 PostgreSQL 数据库，支持：
/// - API 服务配置 (`tool_api_services` 表)
/// - 数据源配置 (`tool_datasources` 表)
/// - UDF 配置 (`tool_udfs` 表)
pub struct PostgresConfigStore {
    pool: PgPool,
}

impl PostgresConfigStore {
    /// 创建新的 PostgreSQL 配置存储
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

    /// 解析认证类型
    fn parse_auth_type(s: &str) -> AuthType {
        match s.to_lowercase().as_str() {
            "apikey" => AuthType::ApiKey,
            "basic" => AuthType::Basic,
            "bearer" => AuthType::Bearer,
            "oauth2" => AuthType::OAuth2,
            "custom" => AuthType::Custom,
            _ => AuthType::None,
        }
    }

    /// 认证类型转字符串
    fn auth_type_to_string(auth_type: &AuthType) -> &'static str {
        match auth_type {
            AuthType::None => "none",
            AuthType::ApiKey => "apikey",
            AuthType::Basic => "basic",
            AuthType::Bearer => "bearer",
            AuthType::OAuth2 => "oauth2",
            AuthType::Custom => "custom",
        }
    }

    /// 解析数据库类型
    fn parse_db_type(s: &str) -> DatabaseType {
        match s.to_lowercase().as_str() {
            "mysql" => DatabaseType::MySQL,
            "postgresql" | "postgres" => DatabaseType::PostgreSQL,
            "sqlite" => DatabaseType::SQLite,
            "mongodb" => DatabaseType::MongoDB,
            "redis" => DatabaseType::Redis,
            "elasticsearch" => DatabaseType::Elasticsearch,
            "clickhouse" => DatabaseType::ClickHouse,
            _ => DatabaseType::PostgreSQL,
        }
    }

    /// 数据库类型转字符串
    fn db_type_to_string(db_type: &DatabaseType) -> &'static str {
        match db_type {
            DatabaseType::MySQL => "mysql",
            DatabaseType::PostgreSQL => "postgresql",
            DatabaseType::SQLite => "sqlite",
            DatabaseType::MongoDB => "mongodb",
            DatabaseType::Redis => "redis",
            DatabaseType::Elasticsearch => "elasticsearch",
            DatabaseType::ClickHouse => "clickhouse",
        }
    }

    /// 解析 UDF 类型
    fn parse_udf_type(s: &str) -> UdfType {
        match s.to_lowercase().as_str() {
            "builtin" => UdfType::Builtin,
            "sql" => UdfType::Sql,
            "wasm" => UdfType::Wasm,
            "http" => UdfType::Http,
            _ => UdfType::Builtin,
        }
    }

    /// UDF 类型转字符串
    fn udf_type_to_string(udf_type: &UdfType) -> &'static str {
        match udf_type {
            UdfType::Builtin => "builtin",
            UdfType::Sql => "sql",
            UdfType::Wasm => "wasm",
            UdfType::Http => "http",
        }
    }
}

// API 服务数据库行结构
#[derive(sqlx::FromRow)]
struct ApiServiceRow {
    name: String,
    display_name: String,
    description: Option<String>,
    base_url: String,
    auth_type: String,
    auth_config: serde_json::Value,
    default_headers: serde_json::Value,
    timeout_ms: i32,
    retry_count: i32,
    enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<ApiServiceRow> for ApiServiceConfig {
    fn from(row: ApiServiceRow) -> Self {
        Self {
            name: row.name,
            display_name: row.display_name,
            description: row.description,
            base_url: row.base_url,
            auth_type: PostgresConfigStore::parse_auth_type(&row.auth_type),
            auth_config: serde_json::from_value(row.auth_config).unwrap_or_default(),
            default_headers: serde_json::from_value(row.default_headers).unwrap_or_default(),
            timeout_ms: row.timeout_ms as u64,
            retry_count: row.retry_count as u32,
            enabled: row.enabled,
            created_at: Some(row.created_at.to_rfc3339()),
            updated_at: Some(row.updated_at.to_rfc3339()),
        }
    }
}

// 数据源数据库行结构
#[derive(sqlx::FromRow)]
struct DatasourceRow {
    name: String,
    display_name: String,
    description: Option<String>,
    db_type: String,
    connection_string: String,
    schema_name: Option<String>,
    default_table: Option<String>,
    pool_size: i32,
    timeout_ms: i32,
    read_only: bool,
    enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<DatasourceRow> for DatasourceConfig {
    fn from(row: DatasourceRow) -> Self {
        Self {
            name: row.name,
            display_name: row.display_name,
            description: row.description,
            db_type: PostgresConfigStore::parse_db_type(&row.db_type),
            connection_string: row.connection_string,
            schema: row.schema_name,
            table: row.default_table,
            pool_size: row.pool_size as u32,
            timeout_ms: row.timeout_ms as u64,
            read_only: row.read_only,
            enabled: row.enabled,
            created_at: Some(row.created_at.to_rfc3339()),
            updated_at: Some(row.updated_at.to_rfc3339()),
        }
    }
}

// UDF 数据库行结构
#[derive(sqlx::FromRow)]
struct UdfRow {
    name: String,
    display_name: String,
    description: Option<String>,
    udf_type: String,
    handler: String,
    input_schema: Option<serde_json::Value>,
    output_schema: Option<serde_json::Value>,
    applicable_db_types: Vec<String>,
    is_builtin: bool,
    enabled: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<UdfRow> for UdfConfig {
    fn from(row: UdfRow) -> Self {
        Self {
            name: row.name,
            display_name: row.display_name,
            description: row.description,
            udf_type: PostgresConfigStore::parse_udf_type(&row.udf_type),
            handler: row.handler,
            input_schema: row.input_schema,
            output_schema: row.output_schema,
            applicable_db_types: row
                .applicable_db_types
                .iter()
                .map(|s| PostgresConfigStore::parse_db_type(s))
                .collect(),
            is_builtin: row.is_builtin,
            enabled: row.enabled,
            created_at: Some(row.created_at.to_rfc3339()),
            updated_at: Some(row.updated_at.to_rfc3339()),
        }
    }
}

#[async_trait::async_trait]
impl ConfigStore for PostgresConfigStore {
    // ==================== API Services ====================

    async fn list_api_services(&self, tenant_id: &str) -> ToolResult<Vec<ApiServiceConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        let rows: Vec<ApiServiceRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, base_url, auth_type,
                   auth_config, default_headers, timeout_ms, retry_count,
                   enabled, created_at, updated_at
            FROM tool_api_services
            WHERE tenant_id = $1
            ORDER BY name
            "#,
        )
        .bind(tenant_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(ApiServiceConfig::from).collect())
    }

    async fn get_api_service(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> ToolResult<Option<ApiServiceConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        let row: Option<ApiServiceRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, base_url, auth_type,
                   auth_config, default_headers, timeout_ms, retry_count,
                   enabled, created_at, updated_at
            FROM tool_api_services
            WHERE tenant_id = $1 AND name = $2
            "#,
        )
        .bind(tenant_uuid)
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(row.map(ApiServiceConfig::from))
    }

    async fn save_api_service(&self, tenant_id: &str, config: ApiServiceConfig) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let auth_config = serde_json::to_value(&config.auth_config).unwrap_or_default();
        let default_headers = serde_json::to_value(&config.default_headers).unwrap_or_default();

        sqlx::query(
            r#"
            INSERT INTO tool_api_services
                (tenant_id, name, display_name, description, base_url, auth_type,
                 auth_config, default_headers, timeout_ms, retry_count, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (tenant_id, name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                base_url = EXCLUDED.base_url,
                auth_type = EXCLUDED.auth_type,
                auth_config = EXCLUDED.auth_config,
                default_headers = EXCLUDED.default_headers,
                timeout_ms = EXCLUDED.timeout_ms,
                retry_count = EXCLUDED.retry_count,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            "#,
        )
        .bind(tenant_uuid)
        .bind(&config.name)
        .bind(&config.display_name)
        .bind(&config.description)
        .bind(&config.base_url)
        .bind(Self::auth_type_to_string(&config.auth_type))
        .bind(auth_config)
        .bind(default_headers)
        .bind(config.timeout_ms as i32)
        .bind(config.retry_count as i32)
        .bind(config.enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete_api_service(&self, tenant_id: &str, name: &str) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        sqlx::query("DELETE FROM tool_api_services WHERE tenant_id = $1 AND name = $2")
            .bind(tenant_uuid)
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    // ==================== Datasources ====================

    async fn list_datasources(&self, tenant_id: &str) -> ToolResult<Vec<DatasourceConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        let rows: Vec<DatasourceRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, db_type, connection_string,
                   schema_name, default_table, pool_size, timeout_ms,
                   read_only, enabled, created_at, updated_at
            FROM tool_datasources
            WHERE tenant_id = $1
            ORDER BY name
            "#,
        )
        .bind(tenant_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(DatasourceConfig::from).collect())
    }

    async fn get_datasource(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> ToolResult<Option<DatasourceConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        let row: Option<DatasourceRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, db_type, connection_string,
                   schema_name, default_table, pool_size, timeout_ms,
                   read_only, enabled, created_at, updated_at
            FROM tool_datasources
            WHERE tenant_id = $1 AND name = $2
            "#,
        )
        .bind(tenant_uuid)
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(row.map(DatasourceConfig::from))
    }

    async fn save_datasource(&self, tenant_id: &str, config: DatasourceConfig) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        sqlx::query(
            r#"
            INSERT INTO tool_datasources
                (tenant_id, name, display_name, description, db_type, connection_string,
                 schema_name, default_table, pool_size, timeout_ms, read_only, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (tenant_id, name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                db_type = EXCLUDED.db_type,
                connection_string = EXCLUDED.connection_string,
                schema_name = EXCLUDED.schema_name,
                default_table = EXCLUDED.default_table,
                pool_size = EXCLUDED.pool_size,
                timeout_ms = EXCLUDED.timeout_ms,
                read_only = EXCLUDED.read_only,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            "#,
        )
        .bind(tenant_uuid)
        .bind(&config.name)
        .bind(&config.display_name)
        .bind(&config.description)
        .bind(Self::db_type_to_string(&config.db_type))
        .bind(&config.connection_string)
        .bind(&config.schema)
        .bind(&config.table)
        .bind(config.pool_size as i32)
        .bind(config.timeout_ms as i32)
        .bind(config.read_only)
        .bind(config.enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete_datasource(&self, tenant_id: &str, name: &str) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        sqlx::query("DELETE FROM tool_datasources WHERE tenant_id = $1 AND name = $2")
            .bind(tenant_uuid)
            .bind(name)
            .execute(&self.pool)
            .await
            .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    // ==================== UDFs ====================

    async fn list_udfs(&self, tenant_id: &str) -> ToolResult<Vec<UdfConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        // 查询全局 UDF (tenant_id IS NULL) 和租户特定的 UDF
        let rows: Vec<UdfRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, udf_type, handler,
                   input_schema, output_schema, applicable_db_types,
                   is_builtin, enabled, created_at, updated_at
            FROM tool_udfs
            WHERE tenant_id IS NULL OR tenant_id = $1
            ORDER BY is_builtin DESC, name
            "#,
        )
        .bind(tenant_uuid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(UdfConfig::from).collect())
    }

    async fn get_udf(&self, tenant_id: &str, name: &str) -> ToolResult<Option<UdfConfig>> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        // 优先查询租户特定的 UDF，然后是全局 UDF
        let row: Option<UdfRow> = sqlx::query_as(
            r#"
            SELECT name, display_name, description, udf_type, handler,
                   input_schema, output_schema, applicable_db_types,
                   is_builtin, enabled, created_at, updated_at
            FROM tool_udfs
            WHERE name = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
            ORDER BY tenant_id NULLS LAST
            LIMIT 1
            "#,
        )
        .bind(name)
        .bind(tenant_uuid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(row.map(UdfConfig::from))
    }

    async fn save_udf(&self, tenant_id: &str, config: UdfConfig) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);
        let applicable_db_types: Vec<String> = config
            .applicable_db_types
            .iter()
            .map(|t| Self::db_type_to_string(t).to_string())
            .collect();

        sqlx::query(
            r#"
            INSERT INTO tool_udfs
                (tenant_id, name, display_name, description, udf_type, handler,
                 input_schema, output_schema, applicable_db_types, is_builtin, enabled)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (tenant_id, name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                udf_type = EXCLUDED.udf_type,
                handler = EXCLUDED.handler,
                input_schema = EXCLUDED.input_schema,
                output_schema = EXCLUDED.output_schema,
                applicable_db_types = EXCLUDED.applicable_db_types,
                is_builtin = EXCLUDED.is_builtin,
                enabled = EXCLUDED.enabled,
                updated_at = NOW()
            "#,
        )
        .bind(tenant_uuid)
        .bind(&config.name)
        .bind(&config.display_name)
        .bind(&config.description)
        .bind(Self::udf_type_to_string(&config.udf_type))
        .bind(&config.handler)
        .bind(&config.input_schema)
        .bind(&config.output_schema)
        .bind(&applicable_db_types)
        .bind(config.is_builtin)
        .bind(config.enabled)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn delete_udf(&self, tenant_id: &str, name: &str) -> ToolResult<()> {
        let tenant_uuid = Self::parse_tenant_id(tenant_id);

        // 不允许删除内置 UDF
        sqlx::query(
            "DELETE FROM tool_udfs WHERE tenant_id = $1 AND name = $2 AND is_builtin = false",
        )
        .bind(tenant_uuid)
        .bind(name)
        .execute(&self.pool)
        .await
        .map_err(|e| ToolError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tenant_id() {
        let default_uuid = PostgresConfigStore::parse_tenant_id("default");
        assert_eq!(
            default_uuid,
            Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
        );

        let uuid_str = "550e8400-e29b-41d4-a716-446655440000";
        let parsed = PostgresConfigStore::parse_tenant_id(uuid_str);
        assert_eq!(parsed.to_string(), uuid_str);

        // 确定性哈希
        let custom1 = PostgresConfigStore::parse_tenant_id("my-tenant");
        let custom2 = PostgresConfigStore::parse_tenant_id("my-tenant");
        assert_eq!(custom1, custom2);
    }

    #[test]
    fn test_auth_type_conversion() {
        assert_eq!(
            PostgresConfigStore::parse_auth_type("apikey"),
            AuthType::ApiKey
        );
        assert_eq!(
            PostgresConfigStore::parse_auth_type("basic"),
            AuthType::Basic
        );
        assert_eq!(
            PostgresConfigStore::parse_auth_type("unknown"),
            AuthType::None
        );
    }

    #[test]
    fn test_db_type_conversion() {
        assert_eq!(
            PostgresConfigStore::parse_db_type("mysql"),
            DatabaseType::MySQL
        );
        assert_eq!(
            PostgresConfigStore::parse_db_type("postgresql"),
            DatabaseType::PostgreSQL
        );
        assert_eq!(
            PostgresConfigStore::parse_db_type("postgres"),
            DatabaseType::PostgreSQL
        );
    }
}
