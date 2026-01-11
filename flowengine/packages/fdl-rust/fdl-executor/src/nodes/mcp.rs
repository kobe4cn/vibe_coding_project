//! MCP (Model Context Protocol) execution node
//!
//! Executes calls to MCP servers for tool invocation, resource access,
//! and prompt templates.

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::FlowNode;
use fdl_gml::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// MCP server connection configuration
#[derive(Debug, Clone)]
pub struct McpServerConfig {
    /// Server name/identifier
    pub name: String,
    /// Server transport type
    pub transport: McpTransport,
    /// Connection timeout in milliseconds
    pub timeout_ms: u64,
}

/// MCP transport types
#[derive(Debug, Clone)]
pub enum McpTransport {
    /// Standard I/O transport (subprocess)
    Stdio { command: String, args: Vec<String> },
    /// HTTP/SSE transport
    Sse { url: String },
    /// WebSocket transport
    WebSocket { url: String },
}

/// MCP tool definition
#[derive(Debug, Clone)]
pub struct McpTool {
    pub name: String,
    pub description: Option<String>,
    pub input_schema: Value,
}

/// MCP resource definition
#[derive(Debug, Clone)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    pub description: Option<String>,
    pub mime_type: Option<String>,
}

/// MCP call result
#[derive(Debug, Clone)]
pub struct McpResult {
    /// Result content
    pub content: Vec<McpContent>,
    /// Whether the call succeeded
    pub is_error: bool,
}

/// MCP content types
#[derive(Debug, Clone)]
pub enum McpContent {
    Text(String),
    Image { data: String, mime_type: String },
    Resource { uri: String, text: String },
}

/// Execute an MCP node
pub async fn execute_mcp_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    // Get MCP URI (e.g., "mcp://filesystem/read_file")
    let mcp_uri = node
        .mcp
        .as_ref()
        .ok_or_else(|| ExecutorError::InvalidNode(format!("Node {} missing MCP URI", node_id)))?;

    // Parse MCP URI
    let (server_name, tool_name) = parse_mcp_uri(mcp_uri)?;

    // Build arguments
    let eval_ctx = context.read().await.build_eval_context();
    let args = if let Some(args_expr) = &node.args {
        fdl_gml::evaluate(args_expr, &eval_ctx)?
    } else {
        Value::Object(HashMap::new())
    };

    tracing::info!(
        "Executing MCP call: server={}, tool={}, args={:?}",
        server_name,
        tool_name,
        args
    );

    // Execute MCP call (placeholder - actual implementation would use MCP client)
    let mcp_result = execute_mcp_call(&server_name, &tool_name, &args).await?;

    // Build result value
    let content_values: Vec<Value> = mcp_result
        .content
        .iter()
        .map(|c| match c {
            McpContent::Text(text) => Value::object([
                ("type", Value::string("text")),
                ("text", Value::string(text.clone())),
            ]),
            McpContent::Image { data, mime_type } => Value::object([
                ("type", Value::string("image")),
                ("data", Value::string(data.clone())),
                ("mimeType", Value::string(mime_type.clone())),
            ]),
            McpContent::Resource { uri, text } => Value::object([
                ("type", Value::string("resource")),
                ("uri", Value::string(uri.clone())),
                ("text", Value::string(text.clone())),
            ]),
        })
        .collect();

    let result = Value::object([
        ("success", Value::bool(!mcp_result.is_error)),
        ("server", Value::string(server_name.clone())),
        ("tool", Value::string(tool_name.clone())),
        ("content", Value::Array(content_values)),
        ("isError", Value::bool(mcp_result.is_error)),
    ]);

    // Apply sets if present - 将表达式结果更新到全局变量
    if let Some(sets_expr) = &node.sets {
        let mut ctx = context.write().await;
        let mut eval_scope = ctx.build_eval_context().as_object().cloned().unwrap_or_default();
        eval_scope.insert(node_id.to_string(), result.clone());
        let sets_ctx = Value::Object(eval_scope);
        let sets_result = fdl_gml::evaluate(sets_expr, &sets_ctx)?;
        if let Value::Object(sets_obj) = sets_result {
            for (key, value) in sets_obj {
                ctx.set_global(&key, value);
            }
        }
    }

    // Apply with transformation if present
    let output = if let Some(with_expr) = &node.with_expr {
        let mut scope = eval_ctx.as_object().cloned().unwrap_or_default();
        scope.insert(node_id.to_string(), result);
        let with_ctx = Value::Object(scope);
        fdl_gml::evaluate(with_expr, &with_ctx)?
    } else {
        result
    };

    // Store result in context
    context.write().await.set_variable(node_id, output);

    // Handle error routing
    if mcp_result.is_error
        && let Some(fail_node) = &node.fail
    {
        return Ok(vec![fail_node.clone()]);
    }

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}

/// Parse MCP URI into server name and tool name
fn parse_mcp_uri(uri: &str) -> ExecutorResult<(String, String)> {
    // Expected format: mcp://server-name/tool-name
    let parts: Vec<&str> = uri.splitn(2, "://").collect();
    if parts.len() != 2 || parts[0] != "mcp" {
        return Err(ExecutorError::InvalidNode(format!(
            "Invalid MCP URI format: {}",
            uri
        )));
    }

    let path = parts[1];
    let path_parts: Vec<&str> = path.splitn(2, '/').collect();
    if path_parts.len() != 2 {
        return Err(ExecutorError::InvalidNode(format!(
            "MCP URI must have format mcp://server/tool: {}",
            uri
        )));
    }

    Ok((path_parts[0].to_string(), path_parts[1].to_string()))
}

/// Execute MCP call (placeholder implementation)
async fn execute_mcp_call(
    server_name: &str,
    tool_name: &str,
    args: &Value,
) -> ExecutorResult<McpResult> {
    // TODO: Implement actual MCP client calls
    // This is a placeholder that simulates an MCP response

    // Simulate some processing time
    tokio::time::sleep(tokio::time::Duration::from_millis(5)).await;

    // Simulate different tool responses
    let content = match tool_name {
        "read_file" => {
            let path = args
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            vec![McpContent::Text(format!(
                "[Simulated file content from {}]",
                path
            ))]
        }
        "write_file" => {
            vec![McpContent::Text("File written successfully".to_string())]
        }
        "list_directory" => {
            let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");
            vec![McpContent::Text(format!(
                "[Simulated directory listing for {}]",
                path
            ))]
        }
        "search" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            vec![McpContent::Text(format!(
                "[Simulated search results for: {}]",
                query
            ))]
        }
        _ => {
            vec![McpContent::Text(format!(
                "[MCP {}::{} executed with args: {:?}]",
                server_name, tool_name, args
            ))]
        }
    };

    Ok(McpResult {
        content,
        is_error: false,
    })
}

/// MCP client manager for managing server connections
#[derive(Debug, Default)]
pub struct McpClientManager {
    servers: HashMap<String, McpServerConfig>,
}

impl McpClientManager {
    /// Create a new MCP client manager
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    /// Register an MCP server
    pub fn register_server(&mut self, name: &str, config: McpServerConfig) {
        self.servers.insert(name.to_string(), config);
    }

    /// Get server configuration
    pub fn get_server(&self, name: &str) -> Option<&McpServerConfig> {
        self.servers.get(name)
    }

    /// List available tools from a server
    pub async fn list_tools(&self, server_name: &str) -> ExecutorResult<Vec<McpTool>> {
        // TODO: Actually query the MCP server for tools
        let _ = self.servers.get(server_name).ok_or_else(|| {
            ExecutorError::ToolNotFound(format!("MCP server not found: {}", server_name))
        })?;

        // Return placeholder tools
        Ok(vec![
            McpTool {
                name: "read_file".to_string(),
                description: Some("Read contents of a file".to_string()),
                input_schema: Value::object([
                    ("type", Value::string("object")),
                    (
                        "properties",
                        Value::object([(
                            "path",
                            Value::object([("type", Value::string("string"))]),
                        )]),
                    ),
                    ("required", Value::Array(vec![Value::string("path")])),
                ]),
            },
            McpTool {
                name: "write_file".to_string(),
                description: Some("Write contents to a file".to_string()),
                input_schema: Value::object([
                    ("type", Value::string("object")),
                    (
                        "properties",
                        Value::object([
                            ("path", Value::object([("type", Value::string("string"))])),
                            (
                                "content",
                                Value::object([("type", Value::string("string"))]),
                            ),
                        ]),
                    ),
                    (
                        "required",
                        Value::Array(vec![Value::string("path"), Value::string("content")]),
                    ),
                ]),
            },
        ])
    }

    /// List available resources from a server
    pub async fn list_resources(&self, server_name: &str) -> ExecutorResult<Vec<McpResource>> {
        // TODO: Actually query the MCP server for resources
        let _ = self.servers.get(server_name).ok_or_else(|| {
            ExecutorError::ToolNotFound(format!("MCP server not found: {}", server_name))
        })?;

        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_mcp_uri() {
        let (server, tool) = parse_mcp_uri("mcp://filesystem/read_file").unwrap();
        assert_eq!(server, "filesystem");
        assert_eq!(tool, "read_file");

        let (server, tool) = parse_mcp_uri("mcp://database/query").unwrap();
        assert_eq!(server, "database");
        assert_eq!(tool, "query");
    }

    #[test]
    fn test_parse_mcp_uri_invalid() {
        assert!(parse_mcp_uri("invalid-uri").is_err());
        assert!(parse_mcp_uri("http://wrong-scheme/tool").is_err());
        assert!(parse_mcp_uri("mcp://no-tool").is_err());
    }

    #[tokio::test]
    async fn test_execute_mcp_call_read_file() {
        let args = Value::object([("path", Value::string("/test/file.txt"))]);
        let result = execute_mcp_call("filesystem", "read_file", &args)
            .await
            .unwrap();

        assert!(!result.is_error);
        assert_eq!(result.content.len(), 1);
        match &result.content[0] {
            McpContent::Text(text) => {
                assert!(text.contains("/test/file.txt"));
            }
            _ => panic!("Expected text content"),
        }
    }

    #[tokio::test]
    async fn test_execute_mcp_call_generic() {
        let args = Value::object([("query", Value::string("test"))]);
        let result = execute_mcp_call("search", "search", &args).await.unwrap();

        assert!(!result.is_error);
        assert_eq!(result.content.len(), 1);
    }

    #[test]
    fn test_mcp_client_manager() {
        let mut manager = McpClientManager::new();

        manager.register_server(
            "test",
            McpServerConfig {
                name: "test".to_string(),
                transport: McpTransport::Stdio {
                    command: "test-server".to_string(),
                    args: vec![],
                },
                timeout_ms: 30000,
            },
        );

        assert!(manager.get_server("test").is_some());
        assert!(manager.get_server("nonexistent").is_none());
    }

    #[tokio::test]
    async fn test_list_tools() {
        let mut manager = McpClientManager::new();
        manager.register_server(
            "filesystem",
            McpServerConfig {
                name: "filesystem".to_string(),
                transport: McpTransport::Stdio {
                    command: "fs-server".to_string(),
                    args: vec![],
                },
                timeout_ms: 30000,
            },
        );

        let tools = manager.list_tools("filesystem").await.unwrap();
        assert!(!tools.is_empty());
        assert!(tools.iter().any(|t| t.name == "read_file"));
    }

    #[tokio::test]
    async fn test_list_tools_unknown_server() {
        let manager = McpClientManager::new();
        let result = manager.list_tools("unknown").await;
        assert!(result.is_err());
    }
}
