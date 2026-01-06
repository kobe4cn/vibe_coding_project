//! 托管工具注册表
//!
//! 基于配置存储动态解析和执行工具调用。
//! 支持 API 服务、数据源和 UDF 的动态配置。

use crate::config::{
    ApiServiceConfig, AuthType, ConfigStore, DatasourceConfig, UdfConfig, UdfType,
};
use crate::error::{ToolError, ToolResult};
use crate::{ToolContext, ToolOutput};
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;
use std::time::{Duration, Instant};

/// 托管工具注册表
///
/// 通过配置存储动态解析工具调用，支持：
/// - `api://service-name/endpoint` - REST API 调用
/// - `db://datasource-name/udf-name` - 数据库操作
pub struct ManagedToolRegistry {
    config_store: Arc<dyn ConfigStore>,
    http_client: Client,
}

impl ManagedToolRegistry {
    /// 创建新的托管注册表
    pub fn new(config_store: Arc<dyn ConfigStore>) -> Self {
        Self {
            config_store,
            http_client: Client::new(),
        }
    }

    /// 解析工具 URI
    ///
    /// 支持格式：
    /// - `api://service-name/endpoint`
    /// - `db://datasource-name/operation`
    pub fn parse_uri(uri: &str) -> ToolResult<ParsedUri> {
        let parts: Vec<&str> = uri.splitn(2, "://").collect();
        if parts.len() != 2 {
            return Err(ToolError::InvalidUri(format!(
                "Invalid URI format: {}",
                uri
            )));
        }

        let tool_type = parts[0].to_string();
        let remaining = parts[1];

        // 分离路径和查询参数
        let (path_part, _query) = if let Some(idx) = remaining.find('?') {
            (&remaining[..idx], Some(&remaining[idx + 1..]))
        } else {
            (remaining, None)
        };

        // 分离 service/datasource 名称和 endpoint/operation
        let path_parts: Vec<&str> = path_part.splitn(2, '/').collect();
        let service_name = path_parts[0].to_string();
        let endpoint = if path_parts.len() > 1 {
            Some(path_parts[1].to_string())
        } else {
            None
        };

        Ok(ParsedUri {
            tool_type,
            service_name,
            endpoint,
        })
    }

    /// 执行工具调用
    pub async fn execute(
        &self,
        uri: &str,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let parsed = Self::parse_uri(uri)?;

        match parsed.tool_type.as_str() {
            "api" => self.execute_api(&parsed, args, context).await,
            "db" => self.execute_db(&parsed, args, context).await,
            _ => Err(ToolError::ToolNotFound(format!(
                "Unknown tool type: {}",
                parsed.tool_type
            ))),
        }
    }

    /// 执行 API 调用
    async fn execute_api(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        // 获取 API 服务配置
        let service_config = self
            .config_store
            .get_api_service(&context.tenant_id, &parsed.service_name)
            .await?
            .ok_or_else(|| {
                ToolError::ToolNotFound(format!("API service not found: {}", parsed.service_name))
            })?;

        if !service_config.enabled {
            return Err(ToolError::ExecutionError(format!(
                "API service is disabled: {}",
                parsed.service_name
            )));
        }

        // 构建完整 URL
        let endpoint = parsed.endpoint.as_deref().unwrap_or("");
        let url = format!("{}/{}", service_config.base_url.trim_end_matches('/'), endpoint);

        // 构建请求
        let timeout = Duration::from_millis(service_config.timeout_ms.min(context.timeout_ms));
        let mut request = self.http_client.post(&url).timeout(timeout);

        // 添加默认请求头
        for (key, value) in &service_config.default_headers {
            request = request.header(key, value);
        }

        // 添加认证
        request = self.apply_auth(request, &service_config)?;

        // 添加上下文头
        request = request
            .header("Content-Type", "application/json")
            .header("X-Tenant-Id", &context.tenant_id)
            .header("X-Bu-Code", &context.bu_code);

        // 添加自定义头
        for (key, value) in &context.metadata {
            request = request.header(key, value);
        }

        // 发送请求
        let response = request
            .json(&args)
            .send()
            .await
            .map_err(|e| ToolError::ConnectionError(e.to_string()))?;

        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            return Err(ToolError::HttpError {
                status: status.as_u16(),
                message,
            });
        }

        let value: Value = response
            .json()
            .await
            .map_err(|e| ToolError::ExecutionError(format!("Failed to parse response: {}", e)))?;

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ToolOutput {
            value,
            duration_ms,
            messages: vec![],
        })
    }

    /// 应用认证配置
    fn apply_auth(
        &self,
        mut request: reqwest::RequestBuilder,
        config: &ApiServiceConfig,
    ) -> ToolResult<reqwest::RequestBuilder> {
        match config.auth_type {
            AuthType::None => Ok(request),
            AuthType::ApiKey => {
                let key = config
                    .auth_config
                    .get("api_key")
                    .ok_or_else(|| ToolError::AuthError("Missing api_key in auth_config".into()))?;
                let header_name = config
                    .auth_config
                    .get("header_name")
                    .map(|s| s.as_str())
                    .unwrap_or("X-API-Key");
                request = request.header(header_name, key);
                Ok(request)
            }
            AuthType::Basic => {
                let username = config
                    .auth_config
                    .get("username")
                    .ok_or_else(|| ToolError::AuthError("Missing username in auth_config".into()))?;
                let password = config
                    .auth_config
                    .get("password")
                    .ok_or_else(|| ToolError::AuthError("Missing password in auth_config".into()))?;
                request = request.basic_auth(username, Some(password));
                Ok(request)
            }
            AuthType::Bearer => {
                let token = config
                    .auth_config
                    .get("token")
                    .ok_or_else(|| ToolError::AuthError("Missing token in auth_config".into()))?;
                request = request.bearer_auth(token);
                Ok(request)
            }
            AuthType::OAuth2 => {
                // OAuth2 需要更复杂的处理，这里简化为使用 access_token
                let token = config
                    .auth_config
                    .get("access_token")
                    .ok_or_else(|| {
                        ToolError::AuthError("Missing access_token in auth_config".into())
                    })?;
                request = request.bearer_auth(token);
                Ok(request)
            }
            AuthType::Custom => {
                // 自定义认证：从 auth_config 读取 header 键值对
                for (key, value) in &config.auth_config {
                    if key.starts_with("header_") {
                        let header_name = key.strip_prefix("header_").unwrap();
                        request = request.header(header_name, value);
                    }
                }
                Ok(request)
            }
        }
    }

    /// 执行数据库操作
    async fn execute_db(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        // 获取数据源配置
        let datasource_config = self
            .config_store
            .get_datasource(&context.tenant_id, &parsed.service_name)
            .await?
            .ok_or_else(|| {
                ToolError::ToolNotFound(format!("Datasource not found: {}", parsed.service_name))
            })?;

        if !datasource_config.enabled {
            return Err(ToolError::ExecutionError(format!(
                "Datasource is disabled: {}",
                parsed.service_name
            )));
        }

        // 获取 UDF 配置
        let udf_name = parsed.endpoint.as_deref().unwrap_or("list");
        let udf_config = self
            .config_store
            .get_udf(&context.tenant_id, udf_name)
            .await?
            .ok_or_else(|| ToolError::ToolNotFound(format!("UDF not found: {}", udf_name)))?;

        if !udf_config.enabled {
            return Err(ToolError::ExecutionError(format!(
                "UDF is disabled: {}",
                udf_name
            )));
        }

        // 检查 UDF 是否适用于此数据库类型
        if !udf_config.applicable_db_types.is_empty()
            && !udf_config
                .applicable_db_types
                .contains(&datasource_config.db_type)
        {
            return Err(ToolError::ExecutionError(format!(
                "UDF '{}' is not applicable for database type {:?}",
                udf_name, datasource_config.db_type
            )));
        }

        // 执行 UDF
        let result = self
            .execute_udf(&datasource_config, &udf_config, args, context)
            .await?;

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![],
        })
    }

    /// 执行 UDF
    async fn execute_udf(
        &self,
        datasource: &DatasourceConfig,
        udf: &UdfConfig,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<Value> {
        match udf.udf_type {
            UdfType::Builtin => self.execute_builtin_udf(datasource, udf, args).await,
            UdfType::Sql => {
                // SQL UDF：执行预定义的 SQL 模板
                Err(ToolError::ExecutionError("SQL UDF not yet implemented".into()))
            }
            UdfType::Wasm => {
                // WASM UDF：加载并执行 WASM 模块
                Err(ToolError::ExecutionError("WASM UDF not yet implemented".into()))
            }
            UdfType::Http => {
                // HTTP UDF：调用外部 HTTP 服务
                Err(ToolError::ExecutionError("HTTP UDF not yet implemented".into()))
            }
        }
    }

    /// 执行内置 UDF
    async fn execute_builtin_udf(
        &self,
        datasource: &DatasourceConfig,
        udf: &UdfConfig,
        args: Value,
    ) -> ToolResult<Value> {
        // 这里是占位实现，实际需要连接数据库执行
        // 在生产环境中，这里应该使用 sqlx 或其他数据库驱动

        tracing::info!(
            "Executing builtin UDF '{}' on datasource '{}' (type: {:?})",
            udf.name,
            datasource.name,
            datasource.db_type
        );

        // 返回模拟结果
        match udf.handler.as_str() {
            "builtin::count" => Ok(serde_json::json!({
                "count": 42,
                "_datasource": datasource.name,
                "_udf": udf.name,
                "_args": args,
            })),
            "builtin::list" => Ok(serde_json::json!({
                "items": [],
                "_datasource": datasource.name,
                "_udf": udf.name,
                "_args": args,
            })),
            "builtin::take" => Ok(serde_json::json!({
                "item": null,
                "_datasource": datasource.name,
                "_udf": udf.name,
                "_args": args,
            })),
            "builtin::page" => Ok(serde_json::json!({
                "items": [],
                "total": 0,
                "page": 1,
                "page_size": 20,
                "total_pages": 0,
                "_datasource": datasource.name,
                "_udf": udf.name,
                "_args": args,
            })),
            "builtin::create" => Ok(serde_json::json!({
                "id": "new-id",
                "created": true,
                "_datasource": datasource.name,
                "_udf": udf.name,
            })),
            "builtin::modify" => Ok(serde_json::json!({
                "affected_rows": 1,
                "_datasource": datasource.name,
                "_udf": udf.name,
            })),
            "builtin::delete" => Ok(serde_json::json!({
                "affected_rows": 1,
                "_datasource": datasource.name,
                "_udf": udf.name,
            })),
            "builtin::native" => Ok(serde_json::json!({
                "rows": [],
                "_datasource": datasource.name,
                "_udf": udf.name,
                "_args": args,
            })),
            _ => Err(ToolError::ExecutionError(format!(
                "Unknown builtin handler: {}",
                udf.handler
            ))),
        }
    }
}

/// 解析后的 URI
#[derive(Debug, Clone)]
pub struct ParsedUri {
    /// 工具类型（api, db, mcp, flow, agent）
    pub tool_type: String,
    /// 服务/数据源名称
    pub service_name: String,
    /// 端点/操作名称
    pub endpoint: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{DatabaseType, config::InMemoryConfigStore};

    #[test]
    fn test_parse_api_uri() {
        let parsed = ManagedToolRegistry::parse_uri("api://crm-service/customer").unwrap();
        assert_eq!(parsed.tool_type, "api");
        assert_eq!(parsed.service_name, "crm-service");
        assert_eq!(parsed.endpoint, Some("customer".to_string()));
    }

    #[test]
    fn test_parse_db_uri() {
        let parsed = ManagedToolRegistry::parse_uri("db://ec.mysql.order/count").unwrap();
        assert_eq!(parsed.tool_type, "db");
        assert_eq!(parsed.service_name, "ec.mysql.order");
        assert_eq!(parsed.endpoint, Some("count".to_string()));
    }

    #[test]
    fn test_parse_uri_without_endpoint() {
        let parsed = ManagedToolRegistry::parse_uri("api://service-name").unwrap();
        assert_eq!(parsed.tool_type, "api");
        assert_eq!(parsed.service_name, "service-name");
        assert!(parsed.endpoint.is_none());
    }

    #[tokio::test]
    async fn test_execute_db_with_builtin_udf() {
        let config_store = Arc::new(InMemoryConfigStore::new());

        // 添加数据源配置
        config_store
            .save_datasource(
                "test-tenant",
                DatasourceConfig {
                    name: "test.mysql.users".to_string(),
                    display_name: "Test Users".to_string(),
                    description: None,
                    db_type: DatabaseType::MySQL,
                    connection_string: "mysql://localhost/test".to_string(),
                    schema: None,
                    table: Some("users".to_string()),
                    pool_size: 5,
                    timeout_ms: 5000,
                    read_only: false,
                    enabled: true,
                    created_at: None,
                    updated_at: None,
                },
            )
            .await
            .unwrap();

        let registry = ManagedToolRegistry::new(config_store);
        let context = ToolContext {
            tenant_id: "test-tenant".to_string(),
            ..Default::default()
        };

        let result = registry
            .execute(
                "db://test.mysql.users/count",
                serde_json::json!({}),
                &context,
            )
            .await;

        assert!(result.is_ok());
        let output = result.unwrap();
        assert!(output.value.get("count").is_some());
    }
}
