//! 托管工具注册表
//!
//! 基于配置存储动态解析和执行工具调用。
//! 支持 API 服务、数据源和 UDF 的动态配置。

use crate::config::{
    ApiServiceConfig, AuthType, ConfigStore, DatabaseType, DatasourceConfig, UdfConfig, UdfType,
};
use crate::error::{ToolError, ToolResult};
use crate::{ToolContext, ToolOutput};
use reqwest::Client;
use serde_json::Value;
use sqlx::{Column, PgPool, Row, postgres::PgRow};
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
    /// - `api://service-name/endpoint` - 默认 POST
    /// - `api://service-name/endpoint?method=GET` - 指定 HTTP 方法
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
        let (path_part, query) = if let Some(idx) = remaining.find('?') {
            (&remaining[..idx], Some(&remaining[idx + 1..]))
        } else {
            (remaining, None)
        };

        // 解析查询参数中的 method
        let method = query.and_then(|q| {
            q.split('&')
                .find_map(|pair| {
                    let kv: Vec<&str> = pair.splitn(2, '=').collect();
                    if kv.len() == 2 && kv[0] == "method" {
                        Some(kv[1].to_uppercase())
                    } else {
                        None
                    }
                })
        });

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
            method,
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
    ///
    /// 支持通过 URI 查询参数或 args._method 指定 HTTP 方法：
    /// - `api://service/endpoint?method=GET`
    /// - `args: { "_method": "GET", ... }`
    async fn execute_api(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        tracing::debug!(
            "execute_api: parsed={:?}, service={}, endpoint={:?}, method={:?}",
            parsed,
            parsed.service_name,
            parsed.endpoint,
            parsed.method
        );

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

        // 构建完整 URL，支持路径参数替换
        // 格式：api://service/user/{userId} 会用 args.userId 的值替换 {userId}
        let endpoint = parsed.endpoint.as_deref().unwrap_or("");
        let endpoint = Self::replace_path_params(endpoint, &args);
        let url = format!("{}/{}", service_config.base_url.trim_end_matches('/'), endpoint);

        // 确定 HTTP 方法：优先使用 URI 中的 method，其次使用 args._method，默认 POST
        let method = parsed.method.as_deref()
            .or_else(|| args.get("_method").and_then(|v| v.as_str()))
            .unwrap_or("POST")
            .to_uppercase();

        tracing::info!(
            "API Request: {} {} (service: {}, base_url: {})",
            method,
            url,
            parsed.service_name,
            service_config.base_url
        );

        // 从 args 中移除 _method 字段（不发送给 API）
        let mut clean_args = args.clone();
        if let Some(obj) = clean_args.as_object_mut() {
            obj.remove("_method");
        }

        // 构建请求
        let timeout = Duration::from_millis(service_config.timeout_ms.min(context.timeout_ms));
        let mut request = match method.as_str() {
            "GET" => self.http_client.get(&url),
            "PUT" => self.http_client.put(&url),
            "PATCH" => self.http_client.patch(&url),
            "DELETE" => self.http_client.delete(&url),
            _ => self.http_client.post(&url), // POST 作为默认
        }.timeout(timeout);

        // 添加默认请求头
        for (key, value) in &service_config.default_headers {
            request = request.header(key, value);
        }

        // 添加认证
        request = self.apply_auth(request, &service_config)?;

        // 添加上下文头
        request = request
            .header("X-Tenant-Id", &context.tenant_id)
            .header("X-Bu-Code", &context.bu_code);

        // 添加自定义头
        for (key, value) in &context.metadata {
            request = request.header(key, value);
        }

        // GET 和 DELETE 请求使用 query 参数，其他使用 JSON body
        let response = if method == "GET" || method == "DELETE" {
            // 将 args 转换为查询参数
            if let Some(obj) = clean_args.as_object() {
                let query_params: Vec<(String, String)> = obj.iter()
                    .filter_map(|(k, v)| {
                        match v {
                            Value::String(s) => Some((k.clone(), s.clone())),
                            Value::Number(n) => Some((k.clone(), n.to_string())),
                            Value::Bool(b) => Some((k.clone(), b.to_string())),
                            _ => None, // 跳过复杂类型
                        }
                    })
                    .collect();
                request = request.query(&query_params);
            }
            request.send().await
        } else {
            // POST/PUT/PATCH 使用 JSON body
            request
                .header("Content-Type", "application/json")
                .json(&clean_args)
                .send()
                .await
        }.map_err(|e| ToolError::ConnectionError(e.to_string()))?;

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

    /// 替换路径参数
    ///
    /// 支持两种占位符格式：
    /// - `{paramName}` - REST 风格
    /// - `${paramName}` - GML 模板风格
    ///
    /// 例如：
    /// - `user/{userId}/orders` + args.userId=5 → `user/5/orders`
    /// - `user/${userId}` + args.userId=5 → `user/5`
    fn replace_path_params(endpoint: &str, args: &Value) -> String {
        let mut result = endpoint.to_string();

        if let Some(obj) = args.as_object() {
            // 匹配两种格式：{paramName} 和 ${paramName}
            let re = regex::Regex::new(r"\$?\{(\w+)\}").unwrap();

            for cap in re.captures_iter(endpoint) {
                let placeholder = &cap[0]; // {paramName} 或 ${paramName}
                let param_name = &cap[1];  // paramName

                if let Some(value) = obj.get(param_name) {
                    let value_str = match value {
                        Value::String(s) => s.clone(),
                        Value::Number(n) => n.to_string(),
                        Value::Bool(b) => b.to_string(),
                        _ => continue,
                    };
                    result = result.replace(placeholder, &value_str);
                }
            }
        }

        result
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
    ///
    /// 支持的 args 参数：
    /// - `exps`: 查询条件表达式，格式如 `customerId = 5 && orderTime > '2025-09-01'`
    /// - `fields`: 查询字段列表，如 `["id", "name"]`
    /// - `limit`: 结果数量限制
    /// - `offset`: 结果偏移量
    /// - `order_by`: 排序字段
    async fn execute_builtin_udf(
        &self,
        datasource: &DatasourceConfig,
        udf: &UdfConfig,
        args: Value,
    ) -> ToolResult<Value> {
        // 解析查询条件表达式
        let where_clause = Self::parse_exps_to_where(&args);
        let table_name = datasource.table.as_deref().unwrap_or("unknown_table");

        tracing::info!(
            "Executing builtin UDF '{}' on datasource '{}' (type: {:?}, table: {}, where: {})",
            udf.name,
            datasource.name,
            datasource.db_type,
            table_name,
            where_clause.as_deref().unwrap_or("none")
        );

        // 生成 SQL
        let sql = Self::generate_sql(&udf.handler, table_name, &args, &where_clause);
        tracing::info!("Generated SQL: {}", sql);

        // 根据数据库类型执行查询
        match datasource.db_type {
            DatabaseType::PostgreSQL => {
                self.execute_postgres(datasource, &udf.handler, &sql, &args).await
            }
            _ => {
                // 其他数据库类型暂未实现，返回错误信息
                Err(ToolError::ExecutionError(format!(
                    "Database type {:?} not yet implemented. SQL: {}",
                    datasource.db_type, sql
                )))
            }
        }
    }

    /// 执行 PostgreSQL 查询
    async fn execute_postgres(
        &self,
        datasource: &DatasourceConfig,
        handler: &str,
        sql: &str,
        _args: &Value,
    ) -> ToolResult<Value> {
        // 创建数据库连接
        let pool = PgPool::connect(&datasource.connection_string)
            .await
            .map_err(|e| ToolError::ConnectionError(format!("PostgreSQL connection failed: {}", e)))?;

        tracing::debug!("Connected to PostgreSQL: {}", datasource.name);

        match handler {
            "builtin::count" => {
                // COUNT 查询返回对象格式 { "value": count, "_sql": sql }
                // 方便用户调试 SQL，也保持返回格式一致性
                let row: (i64,) = sqlx::query_as(sql)
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Query failed: {}", e)))?;

                Ok(serde_json::json!({
                    "value": row.0,
                    "_sql": sql
                }))
            }

            "builtin::list" => {
                // LIST 查询返回记录数组
                let rows = sqlx::query(sql)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Query failed: {}", e)))?;

                let items: Vec<Value> = rows.iter().map(Self::pg_row_to_json).collect();
                Ok(serde_json::json!(items))
            }

            "builtin::take" => {
                // TAKE 查询返回单条记录或 null
                let row = sqlx::query(sql)
                    .fetch_optional(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Query failed: {}", e)))?;

                match row {
                    Some(r) => Ok(Self::pg_row_to_json(&r)),
                    None => Ok(Value::Null),
                }
            }

            "builtin::page" => {
                // PAGE 查询：需要分两次查询（数据 + 总数）
                // SQL 格式：SELECT * FROM table LIMIT x OFFSET y; SELECT COUNT(*) FROM table
                let sqls: Vec<&str> = sql.split(';').map(|s| s.trim()).collect();

                if sqls.len() < 2 {
                    return Err(ToolError::ExecutionError("Invalid page SQL".to_string()));
                }

                // 查询数据
                let rows = sqlx::query(sqls[0])
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Query failed: {}", e)))?;

                let items: Vec<Value> = rows.iter().map(Self::pg_row_to_json).collect();

                // 查询总数
                let count_row: (i64,) = sqlx::query_as(sqls[1])
                    .fetch_one(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Count query failed: {}", e)))?;

                let total = count_row.0;
                let page_size = 20i64; // 默认页大小
                let total_pages = (total + page_size - 1) / page_size;

                Ok(serde_json::json!({
                    "items": items,
                    "total": total,
                    "page": 1,
                    "pageSize": page_size,
                    "totalPages": total_pages
                }))
            }

            "builtin::native" => {
                // 原生 SQL 查询
                let rows = sqlx::query(sql)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Query failed: {}", e)))?;

                let items: Vec<Value> = rows.iter().map(Self::pg_row_to_json).collect();
                Ok(serde_json::json!(items))
            }

            _ => Err(ToolError::ExecutionError(format!(
                "Unknown builtin handler: {}",
                handler
            ))),
        }
    }

    /// 将 PostgreSQL 行转换为 JSON 对象
    fn pg_row_to_json(row: &PgRow) -> Value {
        let mut obj = serde_json::Map::new();

        for (i, column) in row.columns().iter().enumerate() {
            let name = column.name().to_string();

            // 尝试不同类型的读取
            let value: Value = if let Ok(v) = row.try_get::<i64, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<i32, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<f64, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<bool, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<String, _>(i) {
                serde_json::json!(v)
            } else if let Ok(v) = row.try_get::<Option<String>, _>(i) {
                match v {
                    Some(s) => serde_json::json!(s),
                    None => Value::Null,
                }
            } else {
                // 无法识别的类型，尝试作为字符串读取
                Value::Null
            };

            obj.insert(name, value);
        }

        Value::Object(obj)
    }

    /// 解析 exps 表达式为 SQL WHERE 子句
    ///
    /// 输入格式（GML 模板字符串）：
    /// - `customerId = 5 && orderTime > '2025-09-01'`
    /// - `status == 'active' || priority > 3`
    ///
    /// 输出格式（SQL WHERE）：
    /// - `customer_id = 5 AND order_time > '2025-09-01'`
    /// - `status = 'active' OR priority > 3`
    fn parse_exps_to_where(args: &Value) -> Option<String> {
        let exps = args.get("exps").and_then(|v| v.as_str())?;

        // 转换操作符：GML -> SQL
        let sql_expr = exps
            // 逻辑操作符
            .replace("&&", " AND ")
            .replace("||", " OR ")
            // 相等操作符：GML 的 == 转换为 SQL 的 =
            .replace("==", "=")
            // 不等操作符保持不变
            .replace("!=", "<>");

        // 转换字段名：camelCase -> snake_case
        let sql_where = Self::camel_to_snake(&sql_expr);

        Some(sql_where)
    }

    /// 将 camelCase 转换为 snake_case
    ///
    /// 例如：customerId -> customer_id, orderTime -> order_time
    fn camel_to_snake(input: &str) -> String {
        let mut result = String::with_capacity(input.len() + 10);
        let mut prev_was_lower = false;

        for ch in input.chars() {
            if ch.is_ascii_uppercase() {
                if prev_was_lower {
                    result.push('_');
                }
                result.push(ch.to_ascii_lowercase());
                prev_was_lower = false;
            } else {
                result.push(ch);
                prev_was_lower = ch.is_ascii_lowercase();
            }
        }

        result
    }

    /// 生成 SQL 语句（用于日志和调试）
    fn generate_sql(
        handler: &str,
        table: &str,
        args: &Value,
        where_clause: &Option<String>,
    ) -> String {
        let where_part = where_clause
            .as_ref()
            .map(|w| format!(" WHERE {}", w))
            .unwrap_or_default();

        match handler {
            "builtin::count" => {
                format!("SELECT COUNT(*) FROM {}{}", table, where_part)
            }
            "builtin::list" => {
                let fields = args
                    .get("fields")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_else(|| "*".to_string());

                let limit = args
                    .get("limit")
                    .and_then(|v| v.as_i64())
                    .map(|l| format!(" LIMIT {}", l))
                    .unwrap_or_default();

                let offset = args
                    .get("offset")
                    .and_then(|v| v.as_i64())
                    .map(|o| format!(" OFFSET {}", o))
                    .unwrap_or_default();

                let order = args
                    .get("order_by")
                    .and_then(|v| v.as_str())
                    .map(|o| format!(" ORDER BY {}", o))
                    .unwrap_or_default();

                format!(
                    "SELECT {} FROM {}{}{}{}{}",
                    fields, table, where_part, order, limit, offset
                )
            }
            "builtin::take" => {
                let fields = args
                    .get("fields")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str())
                            .collect::<Vec<_>>()
                            .join(", ")
                    })
                    .unwrap_or_else(|| "*".to_string());

                format!("SELECT {} FROM {}{} LIMIT 1", fields, table, where_part)
            }
            "builtin::page" => {
                let page = args.get("page").and_then(|v| v.as_i64()).unwrap_or(1);
                let page_size = args.get("page_size").and_then(|v| v.as_i64()).unwrap_or(20);
                let offset = (page - 1) * page_size;

                format!(
                    "SELECT * FROM {}{} LIMIT {} OFFSET {}; SELECT COUNT(*) FROM {}{}",
                    table, where_part, page_size, offset, table, where_part
                )
            }
            "builtin::native" => args
                .get("sql")
                .and_then(|v| v.as_str())
                .unwrap_or("-- no sql provided")
                .to_string(),
            _ => format!("-- unsupported handler: {}", handler),
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
    /// HTTP 方法（仅用于 api 类型）
    pub method: Option<String>,
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
        assert!(parsed.method.is_none()); // 默认无指定方法
    }

    #[test]
    fn test_parse_api_uri_with_method() {
        let parsed = ManagedToolRegistry::parse_uri("api://crm-service/users?method=GET").unwrap();
        assert_eq!(parsed.tool_type, "api");
        assert_eq!(parsed.service_name, "crm-service");
        assert_eq!(parsed.endpoint, Some("users".to_string()));
        assert_eq!(parsed.method, Some("GET".to_string()));
    }

    #[test]
    fn test_parse_db_uri() {
        let parsed = ManagedToolRegistry::parse_uri("db://ec.mysql.order/count").unwrap();
        assert_eq!(parsed.tool_type, "db");
        assert_eq!(parsed.service_name, "ec.mysql.order");
        assert_eq!(parsed.endpoint, Some("count".to_string()));
        assert!(parsed.method.is_none());
    }

    #[test]
    fn test_parse_uri_without_endpoint() {
        let parsed = ManagedToolRegistry::parse_uri("api://service-name").unwrap();
        assert_eq!(parsed.tool_type, "api");
        assert_eq!(parsed.service_name, "service-name");
        assert!(parsed.endpoint.is_none());
        assert!(parsed.method.is_none());
    }

    #[test]
    fn test_replace_path_params() {
        // REST 风格 {paramName}
        let args = serde_json::json!({"userId": 5});
        let result = ManagedToolRegistry::replace_path_params("user/{userId}", &args);
        assert_eq!(result, "user/5");

        // GML 风格 ${paramName}
        let args = serde_json::json!({"customerId": 5});
        let result = ManagedToolRegistry::replace_path_params("user/${customerId}", &args);
        assert_eq!(result, "user/5");

        // 多个路径参数（混合格式）
        let args = serde_json::json!({"userId": 5, "orderId": "abc123"});
        let result = ManagedToolRegistry::replace_path_params("user/${userId}/orders/{orderId}", &args);
        assert_eq!(result, "user/5/orders/abc123");

        // 字符串类型参数
        let args = serde_json::json!({"name": "john"});
        let result = ManagedToolRegistry::replace_path_params("users/${name}/profile", &args);
        assert_eq!(result, "users/john/profile");

        // 参数不存在时保留占位符
        let args = serde_json::json!({"other": "value"});
        let result = ManagedToolRegistry::replace_path_params("user/${userId}", &args);
        assert_eq!(result, "user/${userId}");

        // 无占位符时原样返回
        let args = serde_json::json!({"userId": 5});
        let result = ManagedToolRegistry::replace_path_params("users/list", &args);
        assert_eq!(result, "users/list");
    }

    #[tokio::test]
    async fn test_execute_db_with_builtin_udf() {
        let config_store = Arc::new(InMemoryConfigStore::new());

        // 添加数据源配置（使用 PostgreSQL，因为目前只实现了 PostgreSQL 支持）
        config_store
            .save_datasource(
                "test-tenant",
                DatasourceConfig {
                    name: "test.pg.users".to_string(),
                    display_name: "Test Users".to_string(),
                    description: None,
                    db_type: DatabaseType::PostgreSQL,
                    connection_string: "postgresql://localhost/test".to_string(),
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
                "db://test.pg.users/count",
                serde_json::json!({}),
                &context,
            )
            .await;

        // 在测试环境中，数据库连接可能失败（没有真实数据库）
        // 我们验证的是：要么执行成功返回正确格式，要么返回连接错误
        match result {
            Ok(output) => {
                // 如果成功，验证返回格式
                assert!(output.value.is_object());
                assert!(output.value.get("value").is_some());
                assert!(output.value.get("_sql").is_some());
            }
            Err(e) => {
                // 如果失败，应该是连接错误（测试环境没有真实数据库）
                let error_msg = format!("{:?}", e);
                assert!(
                    error_msg.contains("Connection") || error_msg.contains("connection")
                    || error_msg.contains("Unsupported"),
                    "Expected connection or unsupported error, got: {}",
                    error_msg
                );
            }
        }
    }

    #[test]
    fn test_parse_exps_to_where() {
        // 测试 GML 表达式转换为 SQL WHERE
        let args = serde_json::json!({
            "exps": "customerId = 5 && orderTime > '2025-09-01'"
        });
        let where_clause = ManagedToolRegistry::parse_exps_to_where(&args);
        assert!(where_clause.is_some());
        let sql = where_clause.unwrap();
        // SQL 关键字大小写不敏感，camel_to_snake 会转成小写
        assert!(sql.to_lowercase().contains(" and "), "sql should contain AND: {}", sql);
        assert!(sql.contains("customer_id"), "sql should contain customer_id: {}", sql);
        assert!(sql.contains("order_time"), "sql should contain order_time: {}", sql);
    }

    #[test]
    fn test_camel_to_snake() {
        assert_eq!(ManagedToolRegistry::camel_to_snake("customerId"), "customer_id");
        assert_eq!(ManagedToolRegistry::camel_to_snake("orderTime"), "order_time");
        // 连续大写字母会被逐个转换
        assert_eq!(ManagedToolRegistry::camel_to_snake("ABC"), "abc");
        assert_eq!(ManagedToolRegistry::camel_to_snake("simple"), "simple");
        // URL 这样的缩写，每个大写字母前都会插入下划线
        assert_eq!(ManagedToolRegistry::camel_to_snake("getURL"), "get_url");
    }
}
