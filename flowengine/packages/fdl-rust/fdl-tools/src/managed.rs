//! 托管工具注册表
//!
//! 基于配置存储动态解析和执行工具调用。
//! 支持 API 服务、数据源、OSS、MQ、Mail、SMS、Svc 的动态配置。

use crate::config::{
    ApiServiceConfig, AuthType, ConfigStore, DatabaseType, DatasourceConfig, UdfConfig, UdfType,
};
use crate::error::{ToolError, ToolResult};
use crate::models::{
    MailConfig, MailProvider, MessageSerialization, MqBroker, MqConfig, OssConfig,
    ServiceDiscovery, ServiceProtocol, SmsConfig, SmsProvider, SvcConfig, ToolServiceConfig,
    ToolType,
};
use crate::service_store::ToolServiceStore;
use crate::{ToolContext, ToolOutput};
use lapin::{BasicProperties, Connection, ConnectionProperties, options::*};
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor, message::header::ContentType,
    transport::smtp::authentication::Credentials as SmtpCredentials,
};
use reqwest::Client;
use s3::creds::Credentials;
use s3::{Bucket, Region};
use serde_json::Value;
use sqlx::{Column, PgPool, Row, postgres::PgRow};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// 托管工具注册表
///
/// 通过配置存储动态解析工具调用，支持：
/// - `api://service-name/endpoint` - REST API 调用
/// - `db://datasource-name/udf-name` - 数据库操作
/// - `oss://service-name/path` - 对象存储操作
/// - `mq://service-name/queue` - 消息队列操作
/// - `svc://service-name/method` - 微服务调用
/// - `mail://service-name/send` - 邮件服务
/// - `sms://service-name/send` - 短信服务
pub struct ManagedToolRegistry {
    config_store: Arc<dyn ConfigStore>,
    service_store: Option<Arc<dyn ToolServiceStore>>,
    http_client: Client,
}

impl ManagedToolRegistry {
    /// 创建 HTTP 客户端（禁用代理以避免 localhost 请求被代理）
    fn create_http_client() -> Client {
        Client::builder()
            .no_proxy()  // 禁用系统代理，避免 localhost 请求被代理导致 503
            .build()
            .unwrap_or_else(|_| Client::new())
    }

    /// 创建新的托管注册表
    pub fn new(config_store: Arc<dyn ConfigStore>) -> Self {
        Self {
            config_store,
            service_store: None,
            http_client: Self::create_http_client(),
        }
    }

    /// 创建带有服务存储的托管注册表
    pub fn with_service_store(
        config_store: Arc<dyn ConfigStore>,
        service_store: Arc<dyn ToolServiceStore>,
    ) -> Self {
        Self {
            config_store,
            service_store: Some(service_store),
            http_client: Self::create_http_client(),
        }
    }

    /// 设置服务存储
    pub fn set_service_store(&mut self, service_store: Arc<dyn ToolServiceStore>) {
        self.service_store = Some(service_store);
    }

    /// 获取服务配置
    async fn get_service_config(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
        service_code: &str,
    ) -> ToolResult<Option<ToolServiceConfig>> {
        if let Some(store) = &self.service_store {
            if let Some(service) = store
                .get_service_by_code(tenant_id, tool_type, service_code)
                .await?
            {
                if service.enabled {
                    return Ok(Some(service.config));
                }
            }
        }
        Ok(None)
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
            q.split('&').find_map(|pair| {
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
    ///
    /// 支持的工具类型：
    /// - `api://service-name/endpoint` - REST API 调用
    /// - `db://datasource-name/udf-name` - 数据库操作
    /// - `oss://service-name/path` - 对象存储操作
    /// - `mq://service-name/queue` - 消息队列操作
    /// - `svc://service-name/method` - 微服务调用
    /// - `mail://service-name/send` - 邮件服务
    /// - `sms://service-name/send` - 短信服务
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
            "oss" => self.execute_oss(&parsed, args, context).await,
            "mq" => self.execute_mq(&parsed, args, context).await,
            "svc" => self.execute_svc(&parsed, args, context).await,
            "mail" => self.execute_mail(&parsed, args, context).await,
            "sms" => self.execute_sms(&parsed, args, context).await,
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
        let url = format!(
            "{}/{}",
            service_config.base_url.trim_end_matches('/'),
            endpoint
        );

        // 确定 HTTP 方法：优先使用 URI 中的 method，其次使用 args._method，默认 POST
        let method = parsed
            .method
            .as_deref()
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
        }
        .timeout(timeout);

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
                let query_params: Vec<(String, String)> = obj
                    .iter()
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
        }
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
                let param_name = &cap[1]; // paramName

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
                let username = config.auth_config.get("username").ok_or_else(|| {
                    ToolError::AuthError("Missing username in auth_config".into())
                })?;
                let password = config.auth_config.get("password").ok_or_else(|| {
                    ToolError::AuthError("Missing password in auth_config".into())
                })?;
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
                let token = config.auth_config.get("access_token").ok_or_else(|| {
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

    /// 执行 OSS 对象存储操作
    ///
    /// 支持操作：upload, download, delete, list, presign, head
    /// 使用 rust-s3 库，兼容 S3、MinIO、阿里云 OSS 等
    async fn execute_oss(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        let operation = args
            .get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("download");

        let path = parsed.endpoint.as_deref().unwrap_or("");

        tracing::info!(
            "OSS operation: {} on service '{}', path: {}",
            operation,
            parsed.service_name,
            path
        );

        // 获取 OSS 配置
        let config = self
            .get_service_config(&context.tenant_id, ToolType::Oss, &parsed.service_name)
            .await?;

        let oss_config = match config {
            Some(ToolServiceConfig::Oss(c)) => c,
            _ => {
                // 无配置时返回 mock 结果
                tracing::warn!(
                    "No OSS config found for '{}', using mock",
                    parsed.service_name
                );
                return self.execute_oss_mock(parsed, &args, operation, path, start);
            }
        };

        // 创建 S3 Bucket 客户端
        let bucket = self.create_s3_bucket(&oss_config)?;

        // 执行操作
        let result = match operation {
            "upload" | "put" | "save" => {
                // 获取上传内容：支持字符串或对象（自动序列化为 JSON）
                let content = match args.get("content") {
                    Some(Value::String(s)) => s.clone(),
                    Some(v) => {
                        // 非字符串值，序列化为 JSON
                        tracing::debug!("OSS upload: serializing non-string content to JSON");
                        serde_json::to_string(v).unwrap_or_default()
                    }
                    None => {
                        tracing::warn!("OSS upload: no 'content' field found in args: {:?}", args);
                        String::new()
                    }
                };

                tracing::info!("OSS upload to '{}', content length: {} bytes", path, content.len());

                let content_type = args
                    .get("contentType")
                    .and_then(|v| v.as_str())
                    .unwrap_or("application/octet-stream");

                match bucket
                    .put_object_with_content_type(path, content.as_bytes(), content_type)
                    .await
                {
                    Ok(response) => {
                        serde_json::json!({
                            "success": true,
                            "objectUrl": format!("oss://{}/{}", parsed.service_name, path),
                            "statusCode": response.status_code(),
                        })
                    }
                    Err(e) => {
                        tracing::error!("OSS upload failed: {:?}", e);
                        serde_json::json!({
                            "success": false,
                            "error": format!("Upload failed: {}", e)
                        })
                    }
                }
            }
            "download" | "get" => match bucket.get_object(path).await {
                Ok(response) => {
                    let content = String::from_utf8_lossy(response.bytes()).to_string();
                    let content_type = response
                        .headers()
                        .get("content-type")
                        .cloned()
                        .unwrap_or_default();
                    serde_json::json!({
                        "success": true,
                        "content": content,
                        "contentType": content_type,
                        "contentLength": response.bytes().len(),
                    })
                }
                Err(e) => {
                    tracing::error!("OSS download failed: {:?}", e);
                    serde_json::json!({
                        "success": false,
                        "error": format!("Download failed: {}", e)
                    })
                }
            },
            "delete" | "remove" => match bucket.delete_object(path).await {
                Ok(response) => {
                    serde_json::json!({
                        "success": true,
                        "deleted": path,
                        "statusCode": response.status_code(),
                    })
                }
                Err(e) => {
                    tracing::error!("OSS delete failed: {:?}", e);
                    serde_json::json!({
                        "success": false,
                        "error": format!("Delete failed: {}", e)
                    })
                }
            },
            "list" | "ls" => {
                let prefix = args.get("prefix").and_then(|v| v.as_str()).unwrap_or(path);
                match bucket.list(prefix.to_string(), None).await {
                    Ok(results) => {
                        let objects: Vec<Value> = results
                            .iter()
                            .flat_map(|r| &r.contents)
                            .map(|obj| {
                                serde_json::json!({
                                    "key": obj.key,
                                    "size": obj.size,
                                    "lastModified": obj.last_modified,
                                })
                            })
                            .collect();
                        serde_json::json!({
                            "success": true,
                            "objects": objects,
                            "prefix": prefix,
                        })
                    }
                    Err(e) => {
                        tracing::error!("OSS list failed: {:?}", e);
                        serde_json::json!({
                            "success": false,
                            "error": format!("List failed: {}", e)
                        })
                    }
                }
            }
            "presign" | "sign" => {
                let expiry = args.get("expiry").and_then(|v| v.as_u64()).unwrap_or(3600) as u32;
                match bucket.presign_get(path, expiry, None).await {
                    Ok(url) => {
                        serde_json::json!({
                            "success": true,
                            "presignedUrl": url,
                            "expiresIn": expiry,
                        })
                    }
                    Err(e) => {
                        tracing::error!("OSS presign failed: {:?}", e);
                        serde_json::json!({
                            "success": false,
                            "error": format!("Presign failed: {}", e)
                        })
                    }
                }
            }
            "head" | "meta" => match bucket.head_object(path).await {
                Ok((head, _)) => {
                    serde_json::json!({
                        "success": true,
                        "contentType": head.content_type.unwrap_or_default(),
                        "contentLength": head.content_length.unwrap_or(0),
                        "lastModified": head.last_modified.unwrap_or_default(),
                    })
                }
                Err(e) => {
                    tracing::error!("OSS head failed: {:?}", e);
                    serde_json::json!({
                        "success": false,
                        "error": format!("Head failed: {}", e)
                    })
                }
            },
            _ => {
                serde_json::json!({
                    "success": false,
                    "error": format!("Unknown OSS operation: {}", operation)
                })
            }
        };

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("OSS operation '{}' executed", operation)],
        })
    }

    /// 创建 S3 兼容的 Bucket 客户端
    fn create_s3_bucket(&self, config: &OssConfig) -> ToolResult<Box<Bucket>> {
        let region = match &config.endpoint {
            Some(endpoint) => Region::Custom {
                region: config
                    .region
                    .clone()
                    .unwrap_or_else(|| "us-east-1".to_string()),
                endpoint: endpoint.clone(),
            },
            None => {
                let region_str = config
                    .region
                    .clone()
                    .unwrap_or_else(|| "us-east-1".to_string());
                region_str.parse().unwrap_or(Region::UsEast1)
            }
        };

        let credentials = Credentials::new(
            Some(&config.credentials.access_key_id),
            Some(&config.credentials.secret_access_key),
            config.credentials.session_token.as_deref(),
            None,
            None,
        )
        .map_err(|e| ToolError::ExecutionError(format!("Invalid OSS credentials: {}", e)))?;

        let mut bucket = Bucket::new(&config.bucket, region, credentials)
            .map_err(|e| ToolError::ExecutionError(format!("Failed to create bucket: {}", e)))?;

        if config.path_style {
            bucket = bucket.with_path_style();
        }

        Ok(bucket)
    }

    /// OSS mock 实现（无配置时使用）
    fn execute_oss_mock(
        &self,
        parsed: &ParsedUri,
        args: &Value,
        operation: &str,
        path: &str,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let result = match operation {
            "upload" | "put" | "save" => serde_json::json!({
                "success": true,
                "objectUrl": format!("oss://{}/{}", parsed.service_name, path),
                "etag": "mock-etag-12345",
                "_mock": true
            }),
            "download" | "get" => serde_json::json!({
                "content": "mock content",
                "contentType": "application/octet-stream",
                "_mock": true
            }),
            "presign" | "sign" => {
                let expiry = args.get("expiry").and_then(|v| v.as_i64()).unwrap_or(3600);
                serde_json::json!({
                    "presignedUrl": format!("https://{}.oss.example.com/{}?expires={}",
                        parsed.service_name, path, expiry),
                    "expiresIn": expiry,
                    "_mock": true
                })
            }
            "list" | "ls" => serde_json::json!({
                "objects": [],
                "prefix": path,
                "_mock": true
            }),
            "delete" | "remove" => serde_json::json!({
                "success": true,
                "deleted": path,
                "_mock": true
            }),
            "head" | "meta" => serde_json::json!({
                "contentType": "application/octet-stream",
                "contentLength": 0,
                "lastModified": "2025-01-01T00:00:00Z",
                "_mock": true
            }),
            _ => serde_json::json!({
                "error": format!("Unknown OSS operation: {}", operation),
                "_mock": true
            }),
        };

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("OSS operation '{}' executed (mock)", operation)],
        })
    }

    /// 执行 MQ 消息队列操作
    ///
    /// 支持操作：
    /// - publish/send: 发布消息到队列
    /// - consume/receive: 从队列消费消息
    ///
    /// 目前支持 RabbitMQ (lapin)，其他 broker 返回 mock
    async fn execute_mq(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        let operation = args
            .get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("publish");

        // 解析 endpoint：支持 "exchange/routing_key" 或 "queue" 格式
        // mq://service/exchange/routing_key -> exchange=exchange, routing_key=routing_key, queue=routing_key
        // mq://service/queue -> exchange="", routing_key=queue, queue=queue
        let endpoint = parsed.endpoint.as_deref().unwrap_or("default");
        let (parsed_exchange, parsed_routing_key) = if let Some(idx) = endpoint.find('/') {
            let ex = &endpoint[..idx];
            let rk = &endpoint[idx + 1..];
            (Some(ex.to_string()), rk.to_string())
        } else {
            (None, endpoint.to_string())
        };

        // queue 名默认使用 routing_key（但 args 中可以覆盖）
        let queue = args
            .get("queue")
            .and_then(|v| v.as_str())
            .unwrap_or(&parsed_routing_key);

        tracing::info!(
            "MQ operation: {} on service '{}', exchange: {:?}, routing_key: {}, queue: {}",
            operation,
            parsed.service_name,
            parsed_exchange,
            parsed_routing_key,
            queue
        );

        // 获取 MQ 配置
        let config = self
            .get_service_config(&context.tenant_id, ToolType::Mq, &parsed.service_name)
            .await?;

        let mq_config = match config {
            Some(ToolServiceConfig::Mq(c)) => c,
            _ => {
                tracing::warn!(
                    "No MQ config found for '{}', using mock",
                    parsed.service_name
                );
                return self.execute_mq_mock(parsed, &args, operation, queue, start);
            }
        };

        // 根据 broker 类型选择实现
        match mq_config.broker {
            MqBroker::RabbitMq => {
                self.execute_rabbitmq(
                    &mq_config,
                    operation,
                    queue,
                    parsed_exchange.as_deref(),
                    &parsed_routing_key,
                    &args,
                    start,
                )
                .await
            }
            _ => {
                // 其他 broker 暂未实现
                tracing::warn!("Broker {:?} not implemented, using mock", mq_config.broker);
                self.execute_mq_mock(parsed, &args, operation, queue, start)
            }
        }
    }

    /// 执行 RabbitMQ 操作
    async fn execute_rabbitmq(
        &self,
        config: &MqConfig,
        operation: &str,
        queue_name: &str,
        uri_exchange: Option<&str>,
        uri_routing_key: &str,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        // 建立连接
        let conn = Connection::connect(&config.connection_string, ConnectionProperties::default())
            .await
            .map_err(|e| {
                ToolError::ConnectionError(format!("RabbitMQ connection failed: {}", e))
            })?;

        // 获取队列名
        let queue = config.default_queue.as_deref().unwrap_or(queue_name);

        let result = match operation {
            "publish" | "send" => {
                let message = args.get("message").cloned().unwrap_or(Value::Null);

                // 序列化消息
                let payload = match config.serialization {
                    MessageSerialization::Json => serde_json::to_vec(&message).map_err(|e| {
                        ToolError::ExecutionError(format!("JSON serialization failed: {}", e))
                    })?,
                    _ => {
                        // 其他序列化格式暂用 JSON
                        serde_json::to_vec(&message).map_err(|e| {
                            ToolError::ExecutionError(format!("Serialization failed: {}", e))
                        })?
                    }
                };

                // 获取 exchange：args > URI > config > 默认空
                let exchange = args
                    .get("exchange")
                    .and_then(|v| v.as_str())
                    .or(uri_exchange)
                    .or(config.default_exchange.as_deref())
                    .unwrap_or("");

                // 获取 routing_key：args > URI > config > queue
                let routing_key = args
                    .get("routingKey")
                    .or_else(|| args.get("routing_key"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(uri_routing_key);
                let routing_key = if routing_key.is_empty() {
                    config.default_routing_key.as_deref().unwrap_or(queue)
                } else {
                    routing_key
                };

                // 使用独立 channel 声明 queue/exchange/binding（失败不影响发布）
                // AMQP 协议中，声明失败会关闭 channel，所以用单独的 channel
                tracing::info!("Setting up RabbitMQ resources: queue='{}', exchange='{}', routing_key='{}'", queue, exchange, routing_key);

                // Step 1: 声明队列
                match conn.create_channel().await {
                    Ok(setup_channel) => {
                        match setup_channel
                            .queue_declare(
                                queue,
                                lapin::options::QueueDeclareOptions::default(),
                                lapin::types::FieldTable::default(),
                            )
                            .await
                        {
                            Ok(q) => tracing::info!(
                                "Queue '{}' ready: {} messages, {} consumers",
                                q.name(), q.message_count(), q.consumer_count()
                            ),
                            Err(e) => tracing::warn!("Queue '{}' declaration failed: {}", queue, e),
                        }
                    }
                    Err(e) => tracing::warn!("Failed to create channel for queue declaration: {}", e),
                }

                // Step 2: 如果指定了 exchange，声明并绑定
                if !exchange.is_empty() {
                    // 声明 exchange（使用 durable=true 匹配常见的生产环境配置）
                    let exchange_ok = match conn.create_channel().await {
                        Ok(ex_channel) => {
                            match ex_channel
                                .exchange_declare(
                                    exchange,
                                    lapin::ExchangeKind::Topic,
                                    lapin::options::ExchangeDeclareOptions {
                                        durable: true,  // 匹配生产环境的 durable exchange
                                        ..Default::default()
                                    },
                                    lapin::types::FieldTable::default(),
                                )
                                .await
                            {
                                Ok(_) => {
                                    tracing::info!("Exchange '{}' declared successfully (durable=true)", exchange);
                                    true
                                }
                                Err(e) => {
                                    // 声明失败可能是因为 exchange 已存在但配置不同
                                    // 尝试使用 passive=true 检查 exchange 是否存在
                                    tracing::warn!("Exchange '{}' declaration failed: {}", exchange, e);
                                    false
                                }
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Failed to create channel for exchange declaration: {}", e);
                            false
                        }
                    };

                    // 无论 exchange 声明成功与否，都尝试绑定队列
                    // 如果 exchange 已存在，绑定操作仍然可以成功
                    match conn.create_channel().await {
                        Ok(bind_channel) => {
                            match bind_channel
                                .queue_bind(
                                    queue,
                                    exchange,
                                    routing_key,
                                    lapin::options::QueueBindOptions::default(),
                                    lapin::types::FieldTable::default(),
                                )
                                .await
                            {
                                Ok(_) => tracing::info!(
                                    "Queue '{}' bound to exchange '{}' with routing key '{}'",
                                    queue, exchange, routing_key
                                ),
                                Err(e) => tracing::warn!(
                                    "Queue '{}' bind to exchange '{}' failed: {}",
                                    queue, exchange, e
                                ),
                            }
                        }
                        Err(e) => tracing::warn!("Failed to create channel for queue binding: {}", e),
                    }

                    let _ = exchange_ok; // suppress unused warning
                }

                // 创建发布用的 channel 并启用 publisher confirms
                let pub_channel = conn
                    .create_channel()
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Failed to create publish channel: {}", e)))?;

                // 启用 publisher confirms 以获得准确的确认
                pub_channel
                    .confirm_select(lapin::options::ConfirmSelectOptions::default())
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Failed to enable confirms: {}", e)))?;

                tracing::info!(
                    "RabbitMQ publish: exchange='{}', routing_key='{}', queue='{}', payload_size={}",
                    exchange,
                    routing_key,
                    queue,
                    payload.len()
                );

                // 发布消息
                let confirm = pub_channel
                    .basic_publish(
                        exchange,
                        routing_key,
                        BasicPublishOptions::default(),
                        &payload,
                        BasicProperties::default()
                            .with_content_type("application/json".into())
                            .with_delivery_mode(2), // 持久化
                    )
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Publish failed: {}", e)))?
                    .await
                    .map_err(|e| {
                        ToolError::ExecutionError(format!("Publish confirm failed: {}", e))
                    })?;

                let acked = confirm.is_ack();
                let nacked = confirm.is_nack();
                tracing::info!(
                    "RabbitMQ publish confirmed: ack={}, nack={}, confirm={:?}",
                    acked, nacked, confirm
                );

                if !acked {
                    tracing::warn!(
                        "Message was NOT acknowledged! exchange='{}', routing_key='{}'. Check if exchange exists and has bindings.",
                        exchange, routing_key
                    );
                }

                serde_json::json!({
                    "success": acked,
                    "messageId": format!("msg-{}", uuid::Uuid::new_v4()),
                    "queue": queue,
                    "exchange": exchange,
                    "routingKey": routing_key,
                    "confirmed": acked,
                })
            }
            "consume" | "receive" | "get" => {
                // 创建 channel
                let channel = conn
                    .create_channel()
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Failed to create channel: {}", e)))?;

                // 尝试获取一条消息（non-blocking）
                let delivery = channel
                    .basic_get(queue, BasicGetOptions { no_ack: false })
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Get failed: {}", e)))?;

                match delivery {
                    Some(msg) => {
                        // 解析消息内容
                        let content = String::from_utf8_lossy(&msg.data).to_string();
                        let parsed_content: Value = serde_json::from_str(&content)
                            .unwrap_or(Value::String(content.clone()));

                        // 自动 ack
                        let auto_ack = args
                            .get("auto_ack")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(true);

                        if auto_ack {
                            msg.ack(BasicAckOptions::default()).await.map_err(|e| {
                                ToolError::ExecutionError(format!("Ack failed: {}", e))
                            })?;
                        }

                        serde_json::json!({
                            "success": true,
                            "hasMessage": true,
                            "message": parsed_content,
                            "deliveryTag": msg.delivery_tag,
                            "queue": queue,
                            "acked": auto_ack,
                        })
                    }
                    None => {
                        serde_json::json!({
                            "success": true,
                            "hasMessage": false,
                            "queue": queue,
                        })
                    }
                }
            }
            "purge" => {
                // 创建 channel
                let channel = conn
                    .create_channel()
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Failed to create channel: {}", e)))?;

                // 清空队列
                let purged_count = channel
                    .queue_purge(queue, QueuePurgeOptions::default())
                    .await
                    .map_err(|e| ToolError::ExecutionError(format!("Purge failed: {}", e)))?;

                serde_json::json!({
                    "success": true,
                    "queue": queue,
                    "purgedCount": purged_count,
                })
            }
            _ => {
                serde_json::json!({
                    "success": false,
                    "error": format!("Unknown MQ operation: {}", operation)
                })
            }
        };

        // 关闭连接
        let _ = conn.close(0, "normal shutdown").await;

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("MQ operation '{}' completed", operation)],
        })
    }

    /// MQ mock 实现
    fn execute_mq_mock(
        &self,
        parsed: &ParsedUri,
        args: &Value,
        operation: &str,
        queue: &str,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let result = match operation {
            "publish" | "send" => {
                let message = args.get("message").cloned().unwrap_or(Value::Null);
                serde_json::json!({
                    "success": true,
                    "messageId": format!("msg-{}", uuid::Uuid::new_v4()),
                    "queue": queue,
                    "message": message,
                    "_mock": true
                })
            }
            "consume" | "receive" | "get" => serde_json::json!({
                "success": true,
                "hasMessage": false,
                "queue": queue,
                "_mock": true
            }),
            _ => serde_json::json!({
                "success": false,
                "error": format!("Unknown MQ operation: {}", operation),
                "_mock": true
            }),
        };

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!(
                "MQ operation '{}' on '{}' executed (mock)",
                operation, parsed.service_name
            )],
        })
    }

    /// 执行 SVC 微服务调用
    ///
    /// 支持多种服务发现方式：静态配置、Consul、K8s DNS
    /// 自动处理负载均衡和故障转移
    async fn execute_svc(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        let endpoint_path = parsed.endpoint.as_deref().unwrap_or("");

        tracing::info!(
            "SVC call: service '{}', path: {}",
            parsed.service_name,
            endpoint_path
        );

        // 获取 SVC 配置
        let config = self
            .get_service_config(&context.tenant_id, ToolType::Svc, &parsed.service_name)
            .await?;

        let svc_config = match config {
            Some(ToolServiceConfig::Svc(c)) => {
                tracing::info!(
                    "SVC config found for '{}': discovery={:?}, protocol={:?}, timeout={}ms",
                    parsed.service_name,
                    c.discovery,
                    c.protocol,
                    c.timeout_ms
                );
                c
            }
            _ => {
                tracing::warn!(
                    "No SVC config found for '{}', using mock",
                    parsed.service_name
                );
                return self.execute_svc_mock(parsed, &args, endpoint_path, start);
            }
        };

        // 获取服务端点（支持服务发现）
        let endpoint = self.resolve_service_endpoint(&svc_config)?;
        tracing::info!("Resolved endpoint for '{}': {}", parsed.service_name, endpoint);

        // 构建完整 URL
        let url = format!("{}/{}", endpoint.trim_end_matches('/'), endpoint_path);

        // 确定 HTTP 方法：优先使用 URI 中的 method，其次使用 args._method，默认 POST
        let method = parsed
            .method
            .as_deref()
            .or_else(|| args.get("_method").and_then(|v| v.as_str()))
            .unwrap_or("POST")
            .to_uppercase();

        tracing::info!(
            "SVC Request: {} {} (endpoint: {}, discovery: {:?})",
            method,
            url,
            endpoint,
            svc_config.discovery
        );

        // 提取请求体：如果 args 包含 body 字段，使用 body 内容；否则使用整个 args
        // 同时移除内部控制参数（_method, contentType 等）
        let request_body = if let Some(body) = args.get("body") {
            tracing::info!("SVC using 'body' field as request body");
            body.clone()
        } else {
            let mut clean = args.clone();
            if let Some(obj) = clean.as_object_mut() {
                obj.remove("_method");
                obj.remove("contentType");
            }
            clean
        };

        // 提取自定义 Content-Type（如果有）
        let content_type = args
            .get("contentType")
            .and_then(|v| v.as_str())
            .unwrap_or("application/json");

        tracing::info!("SVC request body: {}", request_body);

        // 构建请求
        let timeout = Duration::from_millis(svc_config.timeout_ms.min(context.timeout_ms));
        let request = match method.as_str() {
            "GET" => self.http_client.get(&url),
            "PUT" => self.http_client.put(&url),
            "PATCH" => self.http_client.patch(&url),
            "DELETE" => self.http_client.delete(&url),
            _ => self.http_client.post(&url),
        }
        .timeout(timeout)
        .header("Content-Type", content_type)
        .header("X-Tenant-Id", &context.tenant_id)
        .header("X-Bu-Code", &context.bu_code);

        // 发送请求
        let response = if method == "GET" || method == "DELETE" {
            if let Some(obj) = request_body.as_object() {
                let query_params: Vec<(String, String)> = obj
                    .iter()
                    .filter_map(|(k, v)| match v {
                        Value::String(s) => Some((k.clone(), s.clone())),
                        Value::Number(n) => Some((k.clone(), n.to_string())),
                        Value::Bool(b) => Some((k.clone(), b.to_string())),
                        _ => None,
                    })
                    .collect();
                request.query(&query_params).send().await
            } else {
                request.send().await
            }
        } else {
            request.json(&request_body).send().await
        }
        .map_err(|e| {
            tracing::error!("SVC connection failed: {} {} -> {}", method, url, e);
            ToolError::ConnectionError(format!("SVC call failed: {}", e))
        })?;

        let status = response.status();
        if !status.is_success() {
            let message = response.text().await.unwrap_or_default();
            tracing::error!(
                "SVC call failed: {} {} -> {} (body: {})",
                method,
                url,
                status,
                if message.is_empty() { "<empty>" } else { &message }
            );
            return Err(ToolError::HttpError {
                status: status.as_u16(),
                message,
            });
        }

        tracing::info!("SVC call success: {} {} -> {}", method, url, status);

        let value: Value = response.json().await.map_err(|e| {
            ToolError::ExecutionError(format!("Failed to parse SVC response: {}", e))
        })?;

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value,
            duration_ms,
            messages: vec![format!("SVC call to '{}' completed", parsed.service_name)],
        })
    }

    /// 解析服务端点（支持服务发现）
    fn resolve_service_endpoint(&self, config: &SvcConfig) -> ToolResult<String> {
        match &config.discovery {
            ServiceDiscovery::Static { endpoints } => {
                // 静态配置：简单轮询，这里取第一个可用端点
                endpoints
                    .first()
                    .cloned()
                    .ok_or_else(|| ToolError::ExecutionError("No endpoints configured".to_string()))
            }
            ServiceDiscovery::Consul {
                address,
                service_name,
            } => {
                // Consul 服务发现：实际应该调用 Consul API
                // 这里返回模拟地址，后续可以集成真实 Consul 客户端
                tracing::warn!(
                    "Consul discovery not fully implemented, using address: {}",
                    address
                );
                Ok(format!("http://{}", service_name))
            }
            ServiceDiscovery::K8sDns {
                service_name,
                namespace,
            } => {
                // Kubernetes DNS 解析
                let protocol = match config.protocol {
                    ServiceProtocol::Http => "http",
                    ServiceProtocol::Grpc => "http", // gRPC over HTTP/2
                };
                Ok(format!(
                    "{}://{}.{}.svc.cluster.local",
                    protocol, service_name, namespace
                ))
            }
        }
    }

    /// SVC mock 实现
    fn execute_svc_mock(
        &self,
        parsed: &ParsedUri,
        args: &Value,
        endpoint_path: &str,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let result = serde_json::json!({
            "service": parsed.service_name,
            "path": endpoint_path,
            "args": args,
            "result": {
                "success": true,
                "data": {}
            },
            "_mock": true
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!(
                "SVC call to '{}' executed (mock)",
                parsed.service_name
            )],
        })
    }

    /// 执行邮件服务
    ///
    /// 支持操作：send（发送邮件）
    /// 目前支持 SMTP 方式，其他 provider 返回 mock
    async fn execute_mail(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        tracing::info!("Mail service '{}' called", parsed.service_name);

        // 获取 Mail 配置
        let config = self
            .get_service_config(&context.tenant_id, ToolType::Mail, &parsed.service_name)
            .await?;

        let mail_config = match config {
            Some(ToolServiceConfig::Mail(c)) => c,
            _ => {
                tracing::warn!(
                    "No Mail config found for '{}', using mock",
                    parsed.service_name
                );
                return self.execute_mail_mock(parsed, &args, start);
            }
        };

        // 根据 provider 选择实现
        match mail_config.provider {
            MailProvider::Smtp => self.execute_smtp_mail(&mail_config, &args, start).await,
            _ => {
                // 其他 provider 暂未实现（SendGrid、Mailgun 等需要 API 调用）
                tracing::warn!(
                    "Mail provider {:?} not implemented, using mock",
                    mail_config.provider
                );
                self.execute_mail_mock(parsed, &args, start)
            }
        }
    }

    /// 通过 SMTP 发送邮件
    async fn execute_smtp_mail(
        &self,
        config: &MailConfig,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        // 获取邮件参数
        let to = args
            .get("to")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'to' parameter".to_string()))?;

        let subject = args
            .get("subject")
            .and_then(|v| v.as_str())
            .unwrap_or("No Subject");

        let body = args.get("body").and_then(|v| v.as_str()).unwrap_or("");

        let is_html = args.get("html").and_then(|v| v.as_bool()).unwrap_or(false);

        // 构建发件人
        let from_name = config.from_name.as_deref().unwrap_or("FlowEngine");
        let from = format!("{} <{}>", from_name, config.from_address);

        // 构建邮件
        let email = if is_html {
            Message::builder()
                .from(from.parse().map_err(|e| {
                    ToolError::ExecutionError(format!("Invalid from address: {}", e))
                })?)
                .to(to
                    .parse()
                    .map_err(|e| ToolError::ExecutionError(format!("Invalid to address: {}", e)))?)
                .subject(subject)
                .header(ContentType::TEXT_HTML)
                .body(body.to_string())
                .map_err(|e| ToolError::ExecutionError(format!("Failed to build email: {}", e)))?
        } else {
            Message::builder()
                .from(from.parse().map_err(|e| {
                    ToolError::ExecutionError(format!("Invalid from address: {}", e))
                })?)
                .to(to
                    .parse()
                    .map_err(|e| ToolError::ExecutionError(format!("Invalid to address: {}", e)))?)
                .subject(subject)
                .header(ContentType::TEXT_PLAIN)
                .body(body.to_string())
                .map_err(|e| ToolError::ExecutionError(format!("Failed to build email: {}", e)))?
        };

        // 获取 SMTP 配置
        let smtp_host = config
            .smtp_host
            .as_deref()
            .ok_or_else(|| ToolError::ExecutionError("SMTP host not configured".to_string()))?;

        let smtp_port = config.smtp_port.unwrap_or(587);

        // 构建 SMTP 传输
        let mailer = if let Some(api_key) = &config.api_key {
            // 使用 API Key 作为密码（常见于 SendGrid SMTP 等）
            let creds = SmtpCredentials::new("apikey".to_string(), api_key.clone());
            AsyncSmtpTransport::<Tokio1Executor>::relay(smtp_host)
                .map_err(|e| ToolError::ConnectionError(format!("SMTP relay error: {}", e)))?
                .port(smtp_port)
                .credentials(creds)
                .build()
        } else {
            // 无认证的 SMTP
            AsyncSmtpTransport::<Tokio1Executor>::relay(smtp_host)
                .map_err(|e| ToolError::ConnectionError(format!("SMTP relay error: {}", e)))?
                .port(smtp_port)
                .build()
        };

        // 发送邮件
        let response = mailer
            .send(email)
            .await
            .map_err(|e| ToolError::ExecutionError(format!("Failed to send email: {}", e)))?;

        let message_id = format!("mail-{}", uuid::Uuid::new_v4());

        let result = serde_json::json!({
            "success": response.is_positive(),
            "messageId": message_id,
            "to": to,
            "subject": subject,
            "smtpCode": response.code().to_string(),
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("Email sent to {}", to)],
        })
    }

    /// Mail mock 实现
    fn execute_mail_mock(
        &self,
        parsed: &ParsedUri,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let to = args.get("to").and_then(|v| v.as_str()).unwrap_or("unknown");
        let subject = args
            .get("subject")
            .and_then(|v| v.as_str())
            .unwrap_or("No subject");

        let result = serde_json::json!({
            "success": true,
            "messageId": format!("mail-{}", uuid::Uuid::new_v4()),
            "to": to,
            "subject": subject,
            "service": parsed.service_name,
            "_mock": true
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec!["Mail sent (mock)".to_string()],
        })
    }

    /// 执行短信服务
    ///
    /// 支持多种短信提供商：阿里云、腾讯云、Twilio
    /// 通过 HTTP API 发送短信
    async fn execute_sms(
        &self,
        parsed: &ParsedUri,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        tracing::info!("SMS service '{}' called", parsed.service_name);

        // 获取 SMS 配置
        let config = self
            .get_service_config(&context.tenant_id, ToolType::Sms, &parsed.service_name)
            .await?;

        let sms_config = match config {
            Some(ToolServiceConfig::Sms(c)) => c,
            _ => {
                tracing::warn!(
                    "No SMS config found for '{}', using mock",
                    parsed.service_name
                );
                return self.execute_sms_mock(parsed, &args, start);
            }
        };

        // 根据 provider 选择实现
        match sms_config.provider {
            SmsProvider::Aliyun => self.execute_aliyun_sms(&sms_config, &args, start).await,
            SmsProvider::Tencent => self.execute_tencent_sms(&sms_config, &args, start).await,
            SmsProvider::Twilio => self.execute_twilio_sms(&sms_config, &args, start).await,
        }
    }

    /// 阿里云短信
    async fn execute_aliyun_sms(
        &self,
        config: &SmsConfig,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        use base64::Engine;
        use chrono::Utc;
        use hmac::{Hmac, Mac};

        let phone = args
            .get("phone")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'phone' parameter".to_string()))?;

        let template_code = args
            .get("template_code")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ToolError::ExecutionError("Missing 'template_code' parameter".to_string())
            })?;

        let template_param = args
            .get("template_param")
            .map(|v| v.to_string())
            .unwrap_or_else(|| "{}".to_string());

        let sign_name = config
            .sign_name
            .as_deref()
            .ok_or_else(|| ToolError::ExecutionError("Missing sign_name in config".to_string()))?;

        // 构建阿里云 API 请求参数
        let timestamp = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let nonce = uuid::Uuid::new_v4().to_string();

        let mut params: Vec<(&str, String)> = vec![
            ("AccessKeyId", config.api_key.clone()),
            ("Action", "SendSms".to_string()),
            ("Format", "JSON".to_string()),
            ("PhoneNumbers", phone.to_string()),
            ("SignName", sign_name.to_string()),
            ("SignatureMethod", "HMAC-SHA1".to_string()),
            ("SignatureNonce", nonce),
            ("SignatureVersion", "1.0".to_string()),
            ("TemplateCode", template_code.to_string()),
            ("TemplateParam", template_param),
            ("Timestamp", timestamp),
            ("Version", "2017-05-25".to_string()),
        ];

        // 按参数名排序
        params.sort_by(|a, b| a.0.cmp(b.0));

        // 构建待签名字符串
        let query_string: String = params
            .iter()
            .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        let string_to_sign = format!(
            "GET&{}&{}",
            urlencoding::encode("/"),
            urlencoding::encode(&query_string)
        );

        // 计算签名
        let secret = config
            .api_secret
            .as_deref()
            .ok_or_else(|| ToolError::ExecutionError("Missing api_secret in config".to_string()))?;

        type HmacSha1 = Hmac<sha1::Sha1>;
        let mut mac = HmacSha1::new_from_slice(format!("{}&", secret).as_bytes())
            .map_err(|e| ToolError::ExecutionError(format!("HMAC error: {}", e)))?;
        mac.update(string_to_sign.as_bytes());
        let signature =
            base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

        // 发送请求
        let url = format!(
            "https://dysmsapi.aliyuncs.com/?{}&Signature={}",
            query_string,
            urlencoding::encode(&signature)
        );

        let response =
            self.http_client.get(&url).send().await.map_err(|e| {
                ToolError::ConnectionError(format!("Aliyun SMS request failed: {}", e))
            })?;

        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);

        let success = body.get("Code").and_then(|v| v.as_str()) == Some("OK");
        let message_id = body
            .get("BizId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let result = serde_json::json!({
            "success": success,
            "messageId": message_id,
            "phone": phone,
            "statusCode": status.as_u16(),
            "response": body,
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("SMS sent to {} via Aliyun", phone)],
        })
    }

    /// 腾讯云短信
    async fn execute_tencent_sms(
        &self,
        config: &SmsConfig,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        use chrono::Utc;
        use hmac::{Hmac, Mac};
        use sha2::{Digest, Sha256};

        let phone = args
            .get("phone")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'phone' parameter".to_string()))?;

        let template_id = args
            .get("template_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| {
                ToolError::ExecutionError("Missing 'template_id' parameter".to_string())
            })?;

        let template_params = args
            .get("template_params")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str()).collect::<Vec<_>>())
            .unwrap_or_default();

        let sign_name = config.sign_name.as_deref().unwrap_or("");
        let app_id = args.get("app_id").and_then(|v| v.as_str()).unwrap_or("");

        // 构建腾讯云 API 请求
        let timestamp = Utc::now().timestamp();
        let date = Utc::now().format("%Y-%m-%d").to_string();

        let request_body = serde_json::json!({
            "PhoneNumberSet": [format!("+86{}", phone)],
            "SmsSdkAppId": app_id,
            "TemplateId": template_id,
            "SignName": sign_name,
            "TemplateParamSet": template_params,
        });

        let payload = serde_json::to_string(&request_body)
            .map_err(|e| ToolError::ExecutionError(format!("JSON error: {}", e)))?;

        // TC3-HMAC-SHA256 签名
        let service = "sms";
        let host = "sms.tencentcloudapi.com";
        let action = "SendSms";
        let version = "2021-01-11";

        // 构建规范请求
        let http_method = "POST";
        let canonical_uri = "/";
        let canonical_query_string = "";
        let canonical_headers = format!(
            "content-type:application/json; charset=utf-8\nhost:{}\nx-tc-action:{}\n",
            host,
            action.to_lowercase()
        );
        let signed_headers = "content-type;host;x-tc-action";
        let hashed_payload = hex::encode(Sha256::digest(payload.as_bytes()));

        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            http_method,
            canonical_uri,
            canonical_query_string,
            canonical_headers,
            signed_headers,
            hashed_payload
        );

        // 构建待签名字符串
        let credential_scope = format!("{}/{}/tc3_request", date, service);
        let hashed_canonical_request = hex::encode(Sha256::digest(canonical_request.as_bytes()));
        let string_to_sign = format!(
            "TC3-HMAC-SHA256\n{}\n{}\n{}",
            timestamp, credential_scope, hashed_canonical_request
        );

        // 计算签名
        let secret = config
            .api_secret
            .as_deref()
            .ok_or_else(|| ToolError::ExecutionError("Missing api_secret in config".to_string()))?;

        fn hmac_sha256(key: &[u8], data: &[u8]) -> Vec<u8> {
            let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC error");
            mac.update(data);
            mac.finalize().into_bytes().to_vec()
        }

        let secret_date = hmac_sha256(format!("TC3{}", secret).as_bytes(), date.as_bytes());
        let secret_service = hmac_sha256(&secret_date, service.as_bytes());
        let secret_signing = hmac_sha256(&secret_service, b"tc3_request");
        let signature = hex::encode(hmac_sha256(&secret_signing, string_to_sign.as_bytes()));

        // 构建 Authorization 头
        let authorization = format!(
            "TC3-HMAC-SHA256 Credential={}/{}, SignedHeaders={}, Signature={}",
            config.api_key, credential_scope, signed_headers, signature
        );

        // 发送请求
        let response = self
            .http_client
            .post(format!("https://{}", host))
            .header("Authorization", authorization)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("Host", host)
            .header("X-TC-Action", action)
            .header("X-TC-Timestamp", timestamp.to_string())
            .header("X-TC-Version", version)
            .body(payload)
            .send()
            .await
            .map_err(|e| {
                ToolError::ConnectionError(format!("Tencent SMS request failed: {}", e))
            })?;

        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);

        let success = body
            .get("Response")
            .and_then(|r| r.get("SendStatusSet"))
            .and_then(|s| s.as_array())
            .map(|arr| {
                arr.iter()
                    .all(|item| item.get("Code").and_then(|c| c.as_str()) == Some("Ok"))
            })
            .unwrap_or(false);

        let result = serde_json::json!({
            "success": success,
            "phone": phone,
            "statusCode": status.as_u16(),
            "response": body,
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("SMS sent to {} via Tencent", phone)],
        })
    }

    /// Twilio 短信
    async fn execute_twilio_sms(
        &self,
        config: &SmsConfig,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let phone = args
            .get("phone")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'phone' parameter".to_string()))?;

        let message = args
            .get("message")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'message' parameter".to_string()))?;

        let from = args
            .get("from")
            .and_then(|v| v.as_str())
            .or(config.sign_name.as_deref())
            .ok_or_else(|| ToolError::ExecutionError("Missing 'from' number".to_string()))?;

        // Twilio API
        let account_sid = &config.api_key;
        let auth_token = config.api_secret.as_deref().ok_or_else(|| {
            ToolError::ExecutionError("Missing api_secret (auth_token)".to_string())
        })?;

        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            account_sid
        );

        let params = [("To", phone), ("From", from), ("Body", message)];

        let response = self
            .http_client
            .post(&url)
            .basic_auth(account_sid, Some(auth_token))
            .form(&params)
            .send()
            .await
            .map_err(|e| ToolError::ConnectionError(format!("Twilio request failed: {}", e)))?;

        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);

        let success = status.is_success();
        let message_sid = body
            .get("sid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let result = serde_json::json!({
            "success": success,
            "messageId": message_sid,
            "phone": phone,
            "statusCode": status.as_u16(),
            "response": body,
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec![format!("SMS sent to {} via Twilio", phone)],
        })
    }

    /// SMS mock 实现
    fn execute_sms_mock(
        &self,
        parsed: &ParsedUri,
        args: &Value,
        start: Instant,
    ) -> ToolResult<ToolOutput> {
        let phone = args
            .get("phone")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        let result = serde_json::json!({
            "success": true,
            "messageId": format!("sms-{}", uuid::Uuid::new_v4()),
            "phone": phone,
            "service": parsed.service_name,
            "_mock": true
        });

        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ToolOutput {
            value: result,
            duration_ms,
            messages: vec!["SMS sent (mock)".to_string()],
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
                Err(ToolError::ExecutionError(
                    "SQL UDF not yet implemented".into(),
                ))
            }
            UdfType::Wasm => {
                // WASM UDF：加载并执行 WASM 模块
                Err(ToolError::ExecutionError(
                    "WASM UDF not yet implemented".into(),
                ))
            }
            UdfType::Http => {
                // HTTP UDF：调用外部 HTTP 服务
                Err(ToolError::ExecutionError(
                    "HTTP UDF not yet implemented".into(),
                ))
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
                self.execute_postgres(datasource, &udf.handler, &sql, &args)
                    .await
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
            .map_err(|e| {
                ToolError::ConnectionError(format!("PostgreSQL connection failed: {}", e))
            })?;

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
        let result =
            ManagedToolRegistry::replace_path_params("user/${userId}/orders/{orderId}", &args);
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
            .execute("db://test.pg.users/count", serde_json::json!({}), &context)
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
                    error_msg.contains("Connection")
                        || error_msg.contains("connection")
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
        assert!(
            sql.to_lowercase().contains(" and "),
            "sql should contain AND: {}",
            sql
        );
        assert!(
            sql.contains("customer_id"),
            "sql should contain customer_id: {}",
            sql
        );
        assert!(
            sql.contains("order_time"),
            "sql should contain order_time: {}",
            sql
        );
    }

    #[test]
    fn test_camel_to_snake() {
        assert_eq!(
            ManagedToolRegistry::camel_to_snake("customerId"),
            "customer_id"
        );
        assert_eq!(
            ManagedToolRegistry::camel_to_snake("orderTime"),
            "order_time"
        );
        // 连续大写字母会被逐个转换
        assert_eq!(ManagedToolRegistry::camel_to_snake("ABC"), "abc");
        assert_eq!(ManagedToolRegistry::camel_to_snake("simple"), "simple");
        // URL 这样的缩写，每个大写字母前都会插入下划线
        assert_eq!(ManagedToolRegistry::camel_to_snake("getURL"), "get_url");
    }
}
