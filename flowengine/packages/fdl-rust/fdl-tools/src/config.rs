//! 工具配置管理
//!
//! 定义 API 服务、数据源和 UDF 的配置结构，
//! 支持动态注册和配置管理。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// API 服务配置
///
/// 定义一个 REST API 服务的连接信息，用于 `api://service-name/endpoint` 格式的调用。
/// 例如：`api://crm-service/customer` 会查找名为 `crm-service` 的配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiServiceConfig {
    /// 服务唯一标识（如 "crm-service"）
    pub name: String,
    /// 服务显示名称
    pub display_name: String,
    /// 服务描述
    #[serde(default)]
    pub description: Option<String>,
    /// API 基础 URL（如 "https://api.example.com/v1"）
    pub base_url: String,
    /// 认证类型
    #[serde(default)]
    pub auth_type: AuthType,
    /// 认证配置（根据 auth_type 不同而不同）
    #[serde(default)]
    pub auth_config: HashMap<String, String>,
    /// 默认请求头
    #[serde(default)]
    pub default_headers: HashMap<String, String>,
    /// 请求超时（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 重试次数
    #[serde(default)]
    pub retry_count: u32,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 创建时间
    #[serde(default)]
    pub created_at: Option<String>,
    /// 更新时间
    #[serde(default)]
    pub updated_at: Option<String>,
}

fn default_timeout() -> u64 {
    30000
}

fn default_enabled() -> bool {
    true
}

/// 认证类型
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AuthType {
    /// 无认证
    #[default]
    None,
    /// API Key 认证（header 或 query 参数）
    ApiKey,
    /// Basic 认证
    Basic,
    /// Bearer Token 认证
    Bearer,
    /// OAuth2 认证
    OAuth2,
    /// 自定义认证
    Custom,
}

/// 数据源配置
///
/// 定义一个数据库连接的信息，用于 `db://datasource-name/operation` 格式的调用。
/// 例如：`db://ec.mysql.order/count` 会查找名为 `ec.mysql.order` 的配置。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasourceConfig {
    /// 数据源唯一标识（如 "ec.mysql.order"）
    pub name: String,
    /// 数据源显示名称
    pub display_name: String,
    /// 数据源描述
    #[serde(default)]
    pub description: Option<String>,
    /// 数据库类型
    pub db_type: DatabaseType,
    /// 连接字符串（如 "postgres://user:pass@host:5432/db"）
    pub connection_string: String,
    /// 默认 schema（可选）
    #[serde(default)]
    pub schema: Option<String>,
    /// 默认表名（可选）
    #[serde(default)]
    pub table: Option<String>,
    /// 连接池大小
    #[serde(default = "default_pool_size")]
    pub pool_size: u32,
    /// 连接超时（毫秒）
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 是否只读
    #[serde(default)]
    pub read_only: bool,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 创建时间
    #[serde(default)]
    pub created_at: Option<String>,
    /// 更新时间
    #[serde(default)]
    pub updated_at: Option<String>,
}

fn default_pool_size() -> u32 {
    10
}

/// 数据库类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseType {
    /// MySQL/MariaDB
    MySQL,
    /// PostgreSQL
    PostgreSQL,
    /// SQLite
    SQLite,
    /// MongoDB
    MongoDB,
    /// Redis
    Redis,
    /// Elasticsearch
    Elasticsearch,
    /// ClickHouse
    ClickHouse,
}

/// UDF（用户定义函数）配置
///
/// 定义可用于数据库操作的函数，如 count、list、page 等。
/// 这些函数在 `db://datasource/operation` 中的 operation 部分使用。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdfConfig {
    /// UDF 唯一标识（如 "count"）
    pub name: String,
    /// UDF 显示名称
    pub display_name: String,
    /// UDF 描述
    #[serde(default)]
    pub description: Option<String>,
    /// UDF 类型
    pub udf_type: UdfType,
    /// 处理器标识（内置函数名或外部模块路径）
    pub handler: String,
    /// 输入参数 schema（JSON Schema 格式）
    #[serde(default)]
    pub input_schema: Option<serde_json::Value>,
    /// 输出结果 schema（JSON Schema 格式）
    #[serde(default)]
    pub output_schema: Option<serde_json::Value>,
    /// 适用的数据库类型（空表示全部适用）
    #[serde(default)]
    pub applicable_db_types: Vec<DatabaseType>,
    /// 是否为系统内置
    #[serde(default)]
    pub is_builtin: bool,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    /// 创建时间
    #[serde(default)]
    pub created_at: Option<String>,
    /// 更新时间
    #[serde(default)]
    pub updated_at: Option<String>,
}

/// UDF 类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UdfType {
    /// 内置函数（Rust 实现）
    Builtin,
    /// SQL 脚本
    Sql,
    /// 外部 WASM 模块
    Wasm,
    /// 外部 HTTP 服务
    Http,
}

/// 工具配置存储 trait
#[async_trait::async_trait]
pub trait ConfigStore: Send + Sync {
    /// 获取所有 API 服务配置
    async fn list_api_services(&self, tenant_id: &str) -> crate::ToolResult<Vec<ApiServiceConfig>>;

    /// 获取单个 API 服务配置
    async fn get_api_service(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> crate::ToolResult<Option<ApiServiceConfig>>;

    /// 保存 API 服务配置
    async fn save_api_service(
        &self,
        tenant_id: &str,
        config: ApiServiceConfig,
    ) -> crate::ToolResult<()>;

    /// 删除 API 服务配置
    async fn delete_api_service(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()>;

    /// 获取所有数据源配置
    async fn list_datasources(&self, tenant_id: &str) -> crate::ToolResult<Vec<DatasourceConfig>>;

    /// 获取单个数据源配置
    async fn get_datasource(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> crate::ToolResult<Option<DatasourceConfig>>;

    /// 保存数据源配置
    async fn save_datasource(
        &self,
        tenant_id: &str,
        config: DatasourceConfig,
    ) -> crate::ToolResult<()>;

    /// 删除数据源配置
    async fn delete_datasource(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()>;

    /// 获取所有 UDF 配置
    async fn list_udfs(&self, tenant_id: &str) -> crate::ToolResult<Vec<UdfConfig>>;

    /// 获取单个 UDF 配置
    async fn get_udf(&self, tenant_id: &str, name: &str) -> crate::ToolResult<Option<UdfConfig>>;

    /// 保存 UDF 配置
    async fn save_udf(&self, tenant_id: &str, config: UdfConfig) -> crate::ToolResult<()>;

    /// 删除 UDF 配置
    async fn delete_udf(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()>;
}

/// 内存配置存储（用于开发和测试）
#[derive(Default)]
pub struct InMemoryConfigStore {
    api_services: std::sync::RwLock<HashMap<String, HashMap<String, ApiServiceConfig>>>,
    datasources: std::sync::RwLock<HashMap<String, HashMap<String, DatasourceConfig>>>,
    udfs: std::sync::RwLock<HashMap<String, HashMap<String, UdfConfig>>>,
}

impl InMemoryConfigStore {
    pub fn new() -> Self {
        let store = Self::default();
        // 注册内置 UDF
        store.register_builtin_udfs();
        store
    }

    fn register_builtin_udfs(&self) {
        let builtin_udfs = vec![
            UdfConfig {
                name: "take".to_string(),
                display_name: "获取单条记录".to_string(),
                description: Some("根据条件获取单条记录".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::take".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" },
                        "fields": { "type": "array", "items": { "type": "string" } }
                    }
                })),
                output_schema: Some(serde_json::json!({ "type": "object" })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "list".to_string(),
                display_name: "获取列表".to_string(),
                description: Some("根据条件获取记录列表".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::list".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" },
                        "fields": { "type": "array", "items": { "type": "string" } },
                        "limit": { "type": "integer" },
                        "offset": { "type": "integer" },
                        "order_by": { "type": "string" }
                    }
                })),
                output_schema: Some(serde_json::json!({ "type": "array" })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "count".to_string(),
                display_name: "统计数量".to_string(),
                description: Some("根据条件统计记录数量".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::count".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" }
                    }
                })),
                output_schema: Some(serde_json::json!({ "type": "integer" })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "page".to_string(),
                display_name: "分页查询".to_string(),
                description: Some("分页获取记录列表".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::page".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" },
                        "fields": { "type": "array", "items": { "type": "string" } },
                        "page": { "type": "integer", "default": 1 },
                        "page_size": { "type": "integer", "default": 20 },
                        "order_by": { "type": "string" }
                    }
                })),
                output_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "items": { "type": "array" },
                        "total": { "type": "integer" },
                        "page": { "type": "integer" },
                        "page_size": { "type": "integer" },
                        "total_pages": { "type": "integer" }
                    }
                })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "create".to_string(),
                display_name: "创建记录".to_string(),
                description: Some("创建新记录".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::create".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "data": { "type": "object" }
                    },
                    "required": ["data"]
                })),
                output_schema: Some(serde_json::json!({ "type": "object" })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "modify".to_string(),
                display_name: "修改记录".to_string(),
                description: Some("根据条件修改记录".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::modify".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" },
                        "data": { "type": "object" }
                    },
                    "required": ["filter", "data"]
                })),
                output_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "affected_rows": { "type": "integer" }
                    }
                })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "delete".to_string(),
                display_name: "删除记录".to_string(),
                description: Some("根据条件删除记录".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::delete".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "filter": { "type": "object" }
                    },
                    "required": ["filter"]
                })),
                output_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "affected_rows": { "type": "integer" }
                    }
                })),
                applicable_db_types: vec![],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
            UdfConfig {
                name: "native".to_string(),
                display_name: "原生查询".to_string(),
                description: Some("执行原生 SQL 查询".to_string()),
                udf_type: UdfType::Builtin,
                handler: "builtin::native".to_string(),
                input_schema: Some(serde_json::json!({
                    "type": "object",
                    "properties": {
                        "sql": { "type": "string" },
                        "params": { "type": "array" }
                    },
                    "required": ["sql"]
                })),
                output_schema: Some(serde_json::json!({ "type": "array" })),
                applicable_db_types: vec![
                    DatabaseType::MySQL,
                    DatabaseType::PostgreSQL,
                    DatabaseType::SQLite,
                ],
                is_builtin: true,
                enabled: true,
                created_at: None,
                updated_at: None,
            },
        ];

        let mut udfs = self.udfs.write().unwrap();
        let global_udfs = udfs.entry("__global__".to_string()).or_default();
        for udf in builtin_udfs {
            global_udfs.insert(udf.name.clone(), udf);
        }
    }
}

#[async_trait::async_trait]
impl ConfigStore for InMemoryConfigStore {
    async fn list_api_services(&self, tenant_id: &str) -> crate::ToolResult<Vec<ApiServiceConfig>> {
        let services = self.api_services.read().unwrap();
        Ok(services
            .get(tenant_id)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default())
    }

    async fn get_api_service(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> crate::ToolResult<Option<ApiServiceConfig>> {
        let services = self.api_services.read().unwrap();
        Ok(services.get(tenant_id).and_then(|m| m.get(name).cloned()))
    }

    async fn save_api_service(
        &self,
        tenant_id: &str,
        config: ApiServiceConfig,
    ) -> crate::ToolResult<()> {
        let mut services = self.api_services.write().unwrap();
        let tenant_services = services.entry(tenant_id.to_string()).or_default();
        tenant_services.insert(config.name.clone(), config);
        Ok(())
    }

    async fn delete_api_service(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()> {
        let mut services = self.api_services.write().unwrap();
        if let Some(tenant_services) = services.get_mut(tenant_id) {
            tenant_services.remove(name);
        }
        Ok(())
    }

    async fn list_datasources(&self, tenant_id: &str) -> crate::ToolResult<Vec<DatasourceConfig>> {
        let datasources = self.datasources.read().unwrap();
        Ok(datasources
            .get(tenant_id)
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default())
    }

    async fn get_datasource(
        &self,
        tenant_id: &str,
        name: &str,
    ) -> crate::ToolResult<Option<DatasourceConfig>> {
        let datasources = self.datasources.read().unwrap();
        Ok(datasources
            .get(tenant_id)
            .and_then(|m| m.get(name).cloned()))
    }

    async fn save_datasource(
        &self,
        tenant_id: &str,
        config: DatasourceConfig,
    ) -> crate::ToolResult<()> {
        let mut datasources = self.datasources.write().unwrap();
        let tenant_datasources = datasources.entry(tenant_id.to_string()).or_default();
        tenant_datasources.insert(config.name.clone(), config);
        Ok(())
    }

    async fn delete_datasource(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()> {
        let mut datasources = self.datasources.write().unwrap();
        if let Some(tenant_datasources) = datasources.get_mut(tenant_id) {
            tenant_datasources.remove(name);
        }
        Ok(())
    }

    async fn list_udfs(&self, tenant_id: &str) -> crate::ToolResult<Vec<UdfConfig>> {
        let udfs = self.udfs.read().unwrap();
        let mut result: Vec<UdfConfig> = Vec::new();

        // 先添加全局（内置）UDF
        if let Some(global_udfs) = udfs.get("__global__") {
            result.extend(global_udfs.values().cloned());
        }

        // 再添加租户自定义 UDF
        if let Some(tenant_udfs) = udfs.get(tenant_id) {
            result.extend(tenant_udfs.values().cloned());
        }

        Ok(result)
    }

    async fn get_udf(&self, tenant_id: &str, name: &str) -> crate::ToolResult<Option<UdfConfig>> {
        let udfs = self.udfs.read().unwrap();

        // 先从租户配置查找
        if let Some(tenant_udfs) = udfs.get(tenant_id)
            && let Some(udf) = tenant_udfs.get(name)
        {
            return Ok(Some(udf.clone()));
        }

        // 再从全局配置查找
        if let Some(global_udfs) = udfs.get("__global__")
            && let Some(udf) = global_udfs.get(name)
        {
            return Ok(Some(udf.clone()));
        }

        Ok(None)
    }

    async fn save_udf(&self, tenant_id: &str, config: UdfConfig) -> crate::ToolResult<()> {
        let mut udfs = self.udfs.write().unwrap();
        let tenant_udfs = udfs.entry(tenant_id.to_string()).or_default();
        tenant_udfs.insert(config.name.clone(), config);
        Ok(())
    }

    async fn delete_udf(&self, tenant_id: &str, name: &str) -> crate::ToolResult<()> {
        let mut udfs = self.udfs.write().unwrap();
        if let Some(tenant_udfs) = udfs.get_mut(tenant_id) {
            tenant_udfs.remove(name);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_inmemory_store_api_services() {
        let store = InMemoryConfigStore::new();

        let config = ApiServiceConfig {
            name: "test-service".to_string(),
            display_name: "Test Service".to_string(),
            description: None,
            base_url: "https://api.test.com".to_string(),
            auth_type: AuthType::ApiKey,
            auth_config: HashMap::new(),
            default_headers: HashMap::new(),
            timeout_ms: 5000,
            retry_count: 3,
            enabled: true,
            created_at: None,
            updated_at: None,
        };

        store
            .save_api_service("tenant1", config.clone())
            .await
            .unwrap();

        let result = store
            .get_api_service("tenant1", "test-service")
            .await
            .unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().base_url, "https://api.test.com");

        let list = store.list_api_services("tenant1").await.unwrap();
        assert_eq!(list.len(), 1);

        store
            .delete_api_service("tenant1", "test-service")
            .await
            .unwrap();
        let result = store
            .get_api_service("tenant1", "test-service")
            .await
            .unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_builtin_udfs() {
        let store = InMemoryConfigStore::new();

        let udfs = store.list_udfs("any-tenant").await.unwrap();
        assert!(!udfs.is_empty());

        // 验证内置 UDF 存在
        let count_udf = store.get_udf("any-tenant", "count").await.unwrap();
        assert!(count_udf.is_some());
        assert!(count_udf.unwrap().is_builtin);

        let list_udf = store.get_udf("any-tenant", "list").await.unwrap();
        assert!(list_udf.is_some());
    }
}
