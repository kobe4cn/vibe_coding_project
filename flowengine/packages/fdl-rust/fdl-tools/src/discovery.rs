//! 工具发现机制
//!
//! 提供从外部规范（如 OpenAPI）发现和导入工具的能力：
//! - OpenAPI 3.x 规范解析
//! - Swagger 2.0 规范解析
//! - 自动提取 API 端点作为工具

use crate::error::{ToolError, ToolResult};
use crate::models::{
    ApiConfig, ParamDef, Tool, ToolArgs, ToolService, ToolServiceConfig, ToolType,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// OpenAPI 规范版本
#[derive(Debug, Clone, PartialEq)]
pub enum OpenApiVersion {
    /// Swagger 2.0
    V2,
    /// OpenAPI 3.0.x
    V3_0,
    /// OpenAPI 3.1.x
    V3_1,
}

/// 从 OpenAPI 规范发现的工具信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredTool {
    /// 工具 ID（从 operationId 或路径生成）
    pub id: String,
    /// 工具名称
    pub name: String,
    /// 工具描述
    pub description: Option<String>,
    /// HTTP 方法
    pub method: String,
    /// API 路径
    pub path: String,
    /// 参数定义
    pub parameters: Vec<DiscoveredParameter>,
    /// 请求体 schema
    pub request_body_schema: Option<JsonValue>,
    /// 响应 schema
    pub response_schema: Option<JsonValue>,
    /// 标签
    pub tags: Vec<String>,
}

/// 从 OpenAPI 规范发现的参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredParameter {
    /// 参数名称
    pub name: String,
    /// 参数位置（path, query, header, cookie）
    pub location: String,
    /// 参数类型
    pub param_type: String,
    /// 是否必需
    pub required: bool,
    /// 参数描述
    pub description: Option<String>,
    /// 默认值
    pub default_value: Option<JsonValue>,
}

/// OpenAPI 解析器
///
/// 支持解析 OpenAPI 3.x 和 Swagger 2.0 规范
pub struct OpenApiParser;

impl OpenApiParser {
    /// 从 JSON 字符串解析 OpenAPI 规范
    pub fn parse_json(json_str: &str) -> ToolResult<OpenApiSpec> {
        let value: JsonValue = serde_json::from_str(json_str)
            .map_err(|e| ToolError::ParseError(format!("Invalid JSON: {}", e)))?;
        Self::parse_value(value)
    }

    /// 从 YAML 字符串解析 OpenAPI 规范
    pub fn parse_yaml(yaml_str: &str) -> ToolResult<OpenApiSpec> {
        let value: JsonValue = serde_yaml::from_str(yaml_str)
            .map_err(|e| ToolError::ParseError(format!("Invalid YAML: {}", e)))?;
        Self::parse_value(value)
    }

    /// 从 JSON Value 解析 OpenAPI 规范
    fn parse_value(value: JsonValue) -> ToolResult<OpenApiSpec> {
        // 检测版本
        let version = Self::detect_version(&value)?;

        // 解析基本信息
        let info = Self::parse_info(&value)?;

        // 解析服务器/主机信息
        let base_url = Self::parse_base_url(&value, &version)?;

        // 解析路径和操作
        let tools = Self::parse_paths(&value, &version)?;

        Ok(OpenApiSpec {
            version,
            info,
            base_url,
            tools,
        })
    }

    /// 检测 OpenAPI 版本
    fn detect_version(value: &JsonValue) -> ToolResult<OpenApiVersion> {
        // OpenAPI 3.x 使用 "openapi" 字段
        if let Some(openapi) = value.get("openapi").and_then(|v| v.as_str()) {
            if openapi.starts_with("3.1") {
                return Ok(OpenApiVersion::V3_1);
            } else if openapi.starts_with("3.0") {
                return Ok(OpenApiVersion::V3_0);
            }
        }

        // Swagger 2.0 使用 "swagger" 字段
        if let Some(swagger) = value.get("swagger").and_then(|v| v.as_str())
            && swagger == "2.0"
        {
            return Ok(OpenApiVersion::V2);
        }

        Err(ToolError::ParseError(
            "Unable to detect OpenAPI version".to_string(),
        ))
    }

    /// 解析 info 部分
    fn parse_info(value: &JsonValue) -> ToolResult<OpenApiInfo> {
        let info = value
            .get("info")
            .ok_or_else(|| ToolError::ParseError("Missing 'info' field".to_string()))?;

        Ok(OpenApiInfo {
            title: info
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled API")
                .to_string(),
            description: info
                .get("description")
                .and_then(|v| v.as_str())
                .map(String::from),
            version: info
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("1.0.0")
                .to_string(),
        })
    }

    /// 解析基础 URL
    fn parse_base_url(value: &JsonValue, version: &OpenApiVersion) -> ToolResult<Option<String>> {
        match version {
            OpenApiVersion::V2 => {
                // Swagger 2.0: host + basePath
                let host = value.get("host").and_then(|v| v.as_str());
                let base_path = value.get("basePath").and_then(|v| v.as_str()).unwrap_or("");
                let schemes = value
                    .get("schemes")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_str())
                    .unwrap_or("https");

                if let Some(host) = host {
                    Ok(Some(format!("{}://{}{}", schemes, host, base_path)))
                } else {
                    Ok(None)
                }
            }
            OpenApiVersion::V3_0 | OpenApiVersion::V3_1 => {
                // OpenAPI 3.x: servers 数组
                let servers = value.get("servers").and_then(|v| v.as_array());
                if let Some(servers) = servers
                    && let Some(first) = servers.first()
                {
                    return Ok(first.get("url").and_then(|v| v.as_str()).map(String::from));
                }

                Ok(None)
            }
        }
    }

    /// 解析 paths 部分
    fn parse_paths(value: &JsonValue, version: &OpenApiVersion) -> ToolResult<Vec<DiscoveredTool>> {
        let paths = value
            .get("paths")
            .and_then(|v| v.as_object())
            .ok_or_else(|| ToolError::ParseError("Missing 'paths' field".to_string()))?;

        let mut tools = Vec::new();

        for (path, path_item) in paths {
            if let Some(path_obj) = path_item.as_object() {
                // HTTP 方法列表
                let methods = ["get", "post", "put", "patch", "delete", "options", "head"];

                for method in &methods {
                    if let Some(operation) = path_obj.get(*method)
                        && let Some(tool) = Self::parse_operation(path, method, operation, version)?
                    {
                        tools.push(tool);
                    }
                }
            }
        }

        Ok(tools)
    }

    /// 解析单个操作
    fn parse_operation(
        path: &str,
        method: &str,
        operation: &JsonValue,
        version: &OpenApiVersion,
    ) -> ToolResult<Option<DiscoveredTool>> {
        // 获取 operationId 或生成一个
        let operation_id = operation
            .get("operationId")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| Self::generate_operation_id(path, method));

        // 解析 summary/description
        let summary = operation.get("summary").and_then(|v| v.as_str());
        let description = operation.get("description").and_then(|v| v.as_str());
        let name = summary.unwrap_or(&operation_id).to_string();
        let desc = description.or(summary).map(String::from);

        // 解析 tags
        let tags: Vec<String> = operation
            .get("tags")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();

        // 解析参数
        let parameters = Self::parse_parameters(operation, version)?;

        // 解析请求体
        let request_body_schema = Self::parse_request_body(operation, version)?;

        // 解析响应
        let response_schema = Self::parse_response(operation, version)?;

        Ok(Some(DiscoveredTool {
            id: operation_id,
            name,
            description: desc,
            method: method.to_uppercase(),
            path: path.to_string(),
            parameters,
            request_body_schema,
            response_schema,
            tags,
        }))
    }

    /// 生成操作 ID
    fn generate_operation_id(path: &str, method: &str) -> String {
        let clean_path = path
            .replace('/', "_")
            .replace(['{', '}'], "")
            .trim_matches('_')
            .to_string();
        format!("{}_{}", method, clean_path)
    }

    /// 解析参数
    fn parse_parameters(
        operation: &JsonValue,
        _version: &OpenApiVersion,
    ) -> ToolResult<Vec<DiscoveredParameter>> {
        let params = operation
            .get("parameters")
            .and_then(|v| v.as_array())
            .map(|arr| arr.as_slice())
            .unwrap_or(&[]);

        let mut result = Vec::new();

        for param in params {
            let name = param
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let location = param
                .get("in")
                .and_then(|v| v.as_str())
                .unwrap_or("query")
                .to_string();
            let required = param
                .get("required")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let description = param
                .get("description")
                .and_then(|v| v.as_str())
                .map(String::from);

            // 解析类型
            let param_type = Self::extract_type(param);
            let default_value = param.get("default").cloned();

            result.push(DiscoveredParameter {
                name,
                location,
                param_type,
                required,
                description,
                default_value,
            });
        }

        Ok(result)
    }

    /// 解析请求体（OpenAPI 3.x）
    fn parse_request_body(
        operation: &JsonValue,
        version: &OpenApiVersion,
    ) -> ToolResult<Option<JsonValue>> {
        match version {
            OpenApiVersion::V3_0 | OpenApiVersion::V3_1 => {
                if let Some(request_body) = operation.get("requestBody")
                    && let Some(content) = request_body.get("content")
                {
                    // 优先获取 application/json
                    if let Some(json_content) = content.get("application/json") {
                        return Ok(json_content.get("schema").cloned());
                    }
                    // 其他内容类型
                    if let Some(obj) = content.as_object()
                        && let Some((_, first_content)) = obj.iter().next()
                    {
                        return Ok(first_content.get("schema").cloned());
                    }
                }
            }
            OpenApiVersion::V2 => {
                // Swagger 2.0: 参数中 in=body
                if let Some(params) = operation.get("parameters").and_then(|v| v.as_array()) {
                    for param in params {
                        if param.get("in").and_then(|v| v.as_str()) == Some("body") {
                            return Ok(param.get("schema").cloned());
                        }
                    }
                }
            }
        }
        Ok(None)
    }

    /// 解析响应
    fn parse_response(
        operation: &JsonValue,
        version: &OpenApiVersion,
    ) -> ToolResult<Option<JsonValue>> {
        let responses = match operation.get("responses") {
            Some(r) => r,
            None => return Ok(None),
        };

        // 优先获取 200 响应
        let success_response = responses
            .get("200")
            .or_else(|| responses.get("201"))
            .or_else(|| responses.get("default"));

        if let Some(response) = success_response {
            match version {
                OpenApiVersion::V3_0 | OpenApiVersion::V3_1 => {
                    if let Some(content) = response.get("content")
                        && let Some(json_content) = content.get("application/json")
                    {
                        return Ok(json_content.get("schema").cloned());
                    }
                }
                OpenApiVersion::V2 => {
                    return Ok(response.get("schema").cloned());
                }
            }
        }

        Ok(None)
    }

    /// 提取类型
    fn extract_type(param: &JsonValue) -> String {
        // OpenAPI 3.x: schema.type
        if let Some(schema) = param.get("schema")
            && let Some(t) = schema.get("type").and_then(|v| v.as_str())
        {
            return t.to_string();
        }

        // Swagger 2.0: 直接在参数上
        if let Some(t) = param.get("type").and_then(|v| v.as_str()) {
            return t.to_string();
        }

        "string".to_string()
    }
}

/// 解析后的 OpenAPI 规范
#[derive(Debug, Clone)]
pub struct OpenApiSpec {
    /// 版本
    pub version: OpenApiVersion,
    /// API 信息
    pub info: OpenApiInfo,
    /// 基础 URL
    pub base_url: Option<String>,
    /// 发现的工具列表
    pub tools: Vec<DiscoveredTool>,
}

/// OpenAPI 信息
#[derive(Debug, Clone)]
pub struct OpenApiInfo {
    /// API 标题
    pub title: String,
    /// API 描述
    pub description: Option<String>,
    /// API 版本
    pub version: String,
}

impl OpenApiSpec {
    /// 转换为 ToolService
    ///
    /// 将 OpenAPI 规范转换为 FlowEngine 的工具服务模型
    pub fn to_tool_service(&self, service_code: &str, tenant_id: &str) -> ToolService {
        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: self.base_url.clone().unwrap_or_default(),
            auth: None,
            default_headers: HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service_id = uuid::Uuid::new_v4().to_string();
        let tools: Vec<Tool> = self
            .tools
            .iter()
            .map(|t| self.discovered_tool_to_tool(&service_id, t))
            .collect();

        ToolService {
            id: service_id,
            tool_type: ToolType::Api,
            code: service_code.to_string(),
            name: self.info.title.clone(),
            description: self.info.description.clone(),
            config,
            tools,
            tenant_id: tenant_id.to_string(),
            enabled: true,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
        }
    }

    /// 将发现的工具转换为 Tool 模型
    fn discovered_tool_to_tool(&self, service_id: &str, discovered: &DiscoveredTool) -> Tool {
        // 构建参数定义
        let inputs: Vec<ParamDef> = discovered
            .parameters
            .iter()
            .map(|p| ParamDef {
                name: p.name.clone(),
                param_type: map_openapi_type(&p.param_type),
                nullable: !p.required,
                default_value: p.default_value.clone(),
                description: p.description.clone(),
                builtin: false,
            })
            .collect();

        Tool {
            id: uuid::Uuid::new_v4().to_string(),
            service_id: service_id.to_string(),
            code: discovered.id.clone(),
            name: discovered.name.clone(),
            description: discovered.description.clone(),
            args: ToolArgs {
                defs: HashMap::new(),
                input: inputs,
                output: None,
            },
            opts: None,
            enabled: true,
            created_at: Some(chrono::Utc::now()),
            updated_at: Some(chrono::Utc::now()),
        }
    }
}

/// 将 OpenAPI 类型映射到 FDL 类型
fn map_openapi_type(openapi_type: &str) -> String {
    match openapi_type {
        "integer" => "number".to_string(),
        "number" => "number".to_string(),
        "boolean" => "boolean".to_string(),
        "array" => "array".to_string(),
        "object" => "object".to_string(),
        _ => "string".to_string(),
    }
}

/// 工具发现服务
///
/// 提供统一的工具发现接口
pub struct ToolDiscoveryService {
    /// HTTP 客户端
    client: reqwest::Client,
}

impl ToolDiscoveryService {
    /// 创建新的发现服务
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    /// 从 URL 发现工具
    ///
    /// 支持 OpenAPI JSON/YAML 格式
    pub async fn discover_from_url(&self, url: &str) -> ToolResult<OpenApiSpec> {
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| ToolError::NetworkError(e.to_string()))?;

        let content = response
            .text()
            .await
            .map_err(|e| ToolError::NetworkError(e.to_string()))?;

        // 尝试 JSON 解析，失败则尝试 YAML
        if content.trim().starts_with('{') {
            OpenApiParser::parse_json(&content)
        } else {
            OpenApiParser::parse_yaml(&content)
        }
    }

    /// 从文本内容发现工具
    pub fn discover_from_content(&self, content: &str) -> ToolResult<OpenApiSpec> {
        if content.trim().starts_with('{') {
            OpenApiParser::parse_json(content)
        } else {
            OpenApiParser::parse_yaml(content)
        }
    }
}

impl Default for ToolDiscoveryService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const OPENAPI_3_SAMPLE: &str = r#"
{
    "openapi": "3.0.0",
    "info": {
        "title": "Pet Store API",
        "version": "1.0.0",
        "description": "A sample pet store API"
    },
    "servers": [
        {"url": "https://api.petstore.com/v1"}
    ],
    "paths": {
        "/pets": {
            "get": {
                "operationId": "listPets",
                "summary": "List all pets",
                "tags": ["pets"],
                "parameters": [
                    {
                        "name": "limit",
                        "in": "query",
                        "required": false,
                        "schema": {"type": "integer"}
                    }
                ],
                "responses": {
                    "200": {
                        "description": "A list of pets",
                        "content": {
                            "application/json": {
                                "schema": {"type": "array"}
                            }
                        }
                    }
                }
            },
            "post": {
                "operationId": "createPet",
                "summary": "Create a pet",
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {"type": "object"}
                        }
                    }
                },
                "responses": {
                    "201": {"description": "Created"}
                }
            }
        },
        "/pets/{petId}": {
            "get": {
                "operationId": "getPet",
                "summary": "Get a pet by ID",
                "parameters": [
                    {
                        "name": "petId",
                        "in": "path",
                        "required": true,
                        "schema": {"type": "string"}
                    }
                ],
                "responses": {
                    "200": {"description": "A pet"}
                }
            }
        }
    }
}
"#;

    const SWAGGER_2_SAMPLE: &str = r#"
{
    "swagger": "2.0",
    "info": {
        "title": "Legacy API",
        "version": "2.0.0"
    },
    "host": "api.legacy.com",
    "basePath": "/v2",
    "schemes": ["https"],
    "paths": {
        "/users": {
            "get": {
                "operationId": "listUsers",
                "summary": "List users",
                "parameters": [
                    {
                        "name": "page",
                        "in": "query",
                        "type": "integer"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Success",
                        "schema": {"type": "array"}
                    }
                }
            }
        }
    }
}
"#;

    #[test]
    fn test_parse_openapi_3() {
        let spec = OpenApiParser::parse_json(OPENAPI_3_SAMPLE).unwrap();

        assert_eq!(spec.version, OpenApiVersion::V3_0);
        assert_eq!(spec.info.title, "Pet Store API");
        assert_eq!(
            spec.base_url,
            Some("https://api.petstore.com/v1".to_string())
        );
        assert_eq!(spec.tools.len(), 3);

        // Check listPets operation
        let list_pets = spec.tools.iter().find(|t| t.id == "listPets").unwrap();
        assert_eq!(list_pets.method, "GET");
        assert_eq!(list_pets.path, "/pets");
        assert_eq!(list_pets.parameters.len(), 1);
        assert_eq!(list_pets.parameters[0].name, "limit");
    }

    #[test]
    fn test_parse_swagger_2() {
        let spec = OpenApiParser::parse_json(SWAGGER_2_SAMPLE).unwrap();

        assert_eq!(spec.version, OpenApiVersion::V2);
        assert_eq!(spec.info.title, "Legacy API");
        assert_eq!(spec.base_url, Some("https://api.legacy.com/v2".to_string()));
        assert_eq!(spec.tools.len(), 1);

        let list_users = &spec.tools[0];
        assert_eq!(list_users.id, "listUsers");
        assert_eq!(list_users.method, "GET");
    }

    #[test]
    fn test_to_tool_service() {
        let spec = OpenApiParser::parse_json(OPENAPI_3_SAMPLE).unwrap();
        let service = spec.to_tool_service("petstore", "tenant-1");

        assert_eq!(service.code, "petstore");
        assert_eq!(service.tenant_id, "tenant-1");
        assert_eq!(service.name, "Pet Store API");
        assert_eq!(service.tool_type, ToolType::Api);
        assert_eq!(service.tools.len(), 3);
    }

    #[test]
    fn test_generate_operation_id() {
        assert_eq!(
            OpenApiParser::generate_operation_id("/pets/{petId}", "get"),
            "get_pets_petId"
        );
        assert_eq!(
            OpenApiParser::generate_operation_id("/users", "post"),
            "post_users"
        );
    }

    #[test]
    fn test_invalid_json() {
        let result = OpenApiParser::parse_json("invalid json");
        assert!(result.is_err());
    }

    #[test]
    fn test_missing_version() {
        let result = OpenApiParser::parse_json(r#"{"info": {"title": "Test"}}"#);
        assert!(result.is_err());
    }
}
