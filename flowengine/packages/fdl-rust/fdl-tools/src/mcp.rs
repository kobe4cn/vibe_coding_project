//! MCP (Model Context Protocol) tool handler

use crate::error::{ToolError, ToolResult};
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::Value;
use std::time::Instant;

/// MCP tool handler (placeholder implementation)
pub struct McpHandler {
    server_url: String,
}

impl McpHandler {
    /// Create a new MCP handler
    pub fn new(server_url: &str) -> Self {
        Self {
            server_url: server_url.to_string(),
        }
    }
}

#[async_trait]
impl ToolHandler for McpHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        _context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        // Parse path: service/method
        let parts: Vec<&str> = path.splitn(2, '/').collect();
        if parts.len() != 2 {
            return Err(ToolError::InvalidUri(format!("Invalid MCP path: {}", path)));
        }

        let service = parts[0];
        let method = parts[1];

        // Placeholder: In production, call the MCP server
        tracing::info!("MCP call: {}/{} with args: {}", service, method, args);

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(ToolOutput {
            value: serde_json::json!({
                "success": true,
                "service": service,
                "method": method,
                "server": self.server_url,
            }),
            duration_ms,
            messages: vec![format!(
                "Placeholder: MCP call to {}/{} not implemented",
                service, method
            )],
        })
    }

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "mcp".to_string(),
            description: "MCP (Model Context Protocol) tool handler".to_string(),
            input_schema: None,
            output_schema: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_handler_creation() {
        let handler = McpHandler::new("http://localhost:3000");
        let metadata = handler.metadata();
        assert_eq!(metadata.name, "mcp");
    }

    #[tokio::test]
    async fn test_mcp_execute_valid_path() {
        let handler = McpHandler::new("http://localhost:3000");
        let context = crate::ToolContext::default();
        let args = serde_json::json!({ "path": "/test/file.txt" });

        let result = handler
            .execute("filesystem/read_file", args, &context)
            .await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(output.value.get("success"), Some(&serde_json::json!(true)));
        assert_eq!(
            output.value.get("service"),
            Some(&serde_json::json!("filesystem"))
        );
        assert_eq!(
            output.value.get("method"),
            Some(&serde_json::json!("read_file"))
        );
    }

    #[tokio::test]
    async fn test_mcp_execute_invalid_path() {
        let handler = McpHandler::new("http://localhost:3000");
        let context = crate::ToolContext::default();

        let result = handler
            .execute("invalid_path", serde_json::json!({}), &context)
            .await;
        assert!(result.is_err());
    }
}
