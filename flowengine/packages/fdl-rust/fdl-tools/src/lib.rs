//! # FDL-Tools
//!
//! Tool handlers for FDL executor. Provides integrations with external
//! services like APIs, databases, MCP servers, and more.
//!
//! ## Tool Types
//!
//! - `api://` - HTTP API calls
//! - `db://` - Database operations
//! - `mcp://` - MCP service calls
//! - `flow://` - Sub-flow invocation
//! - `agent://` - AI agent calls

pub mod api;
pub mod database;
pub mod error;
pub mod mcp;
pub mod registry;

pub use error::{ToolError, ToolResult};
pub use registry::{ToolHandler, ToolRegistry};

use serde_json::Value;
use std::collections::HashMap;

/// Tool execution context
#[derive(Debug, Clone)]
pub struct ToolContext {
    /// Tenant ID
    pub tenant_id: String,
    /// Business unit code
    pub bu_code: String,
    /// Request timeout in milliseconds
    pub timeout_ms: u64,
    /// Additional headers/metadata
    pub metadata: HashMap<String, String>,
}

impl Default for ToolContext {
    fn default() -> Self {
        Self {
            tenant_id: String::new(),
            bu_code: String::new(),
            timeout_ms: 30000,
            metadata: HashMap::new(),
        }
    }
}

/// Tool execution result
#[derive(Debug, Clone)]
pub struct ToolOutput {
    /// The result value
    pub value: Value,
    /// Execution duration in milliseconds
    pub duration_ms: u64,
    /// Any warnings or info messages
    pub messages: Vec<String>,
}

/// Parse a tool URI into its components
pub fn parse_tool_uri(uri: &str) -> ToolResult<ToolUri> {
    let parts: Vec<&str> = uri.splitn(2, "://").collect();
    if parts.len() != 2 {
        return Err(ToolError::InvalidUri(format!("Invalid URI format: {}", uri)));
    }

    let tool_type = parts[0].to_string();
    let remaining = parts[1];

    // Parse path and options
    let (path, options) = if let Some(idx) = remaining.find('?') {
        let path = remaining[..idx].to_string();
        let options_str = &remaining[idx + 1..];
        let options = parse_query_string(options_str);
        (path, options)
    } else {
        (remaining.to_string(), HashMap::new())
    };

    Ok(ToolUri {
        tool_type,
        path,
        options,
    })
}

/// Parsed tool URI
#[derive(Debug, Clone)]
pub struct ToolUri {
    pub tool_type: String,
    pub path: String,
    pub options: HashMap<String, String>,
}

fn parse_query_string(s: &str) -> HashMap<String, String> {
    s.split('&')
        .filter_map(|pair| {
            let mut parts = pair.splitn(2, '=');
            let key = parts.next()?.to_string();
            let value = parts.next().unwrap_or("").to_string();
            Some((key, value))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tool_uri() {
        let uri = parse_tool_uri("api://crm-service/customer?timeout=5000").unwrap();
        assert_eq!(uri.tool_type, "api");
        assert_eq!(uri.path, "crm-service/customer");
        assert_eq!(uri.options.get("timeout"), Some(&"5000".to_string()));
    }

    #[test]
    fn test_parse_db_uri() {
        let uri = parse_tool_uri("db://ec.mysql.order/page").unwrap();
        assert_eq!(uri.tool_type, "db");
        assert_eq!(uri.path, "ec.mysql.order/page");
    }

    #[test]
    fn test_parse_mcp_uri() {
        let uri = parse_tool_uri("mcp://filesystem/read_file").unwrap();
        assert_eq!(uri.tool_type, "mcp");
        assert_eq!(uri.path, "filesystem/read_file");
    }

    #[test]
    fn test_parse_uri_with_multiple_options() {
        let uri = parse_tool_uri("api://service/method?timeout=5000&retry=3").unwrap();
        assert_eq!(uri.tool_type, "api");
        assert_eq!(uri.path, "service/method");
        assert_eq!(uri.options.get("timeout"), Some(&"5000".to_string()));
        assert_eq!(uri.options.get("retry"), Some(&"3".to_string()));
    }

    #[test]
    fn test_parse_uri_without_options() {
        let uri = parse_tool_uri("flow://subflow/process").unwrap();
        assert_eq!(uri.tool_type, "flow");
        assert_eq!(uri.path, "subflow/process");
        assert!(uri.options.is_empty());
    }

    #[test]
    fn test_parse_invalid_uri() {
        let result = parse_tool_uri("invalid-uri");
        assert!(result.is_err());
    }

    #[test]
    fn test_tool_context_default() {
        let ctx = ToolContext::default();
        assert_eq!(ctx.timeout_ms, 30000);
        assert!(ctx.tenant_id.is_empty());
        assert!(ctx.bu_code.is_empty());
    }

    #[test]
    fn test_tool_context_custom() {
        let mut ctx = ToolContext {
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            timeout_ms: 60000,
            metadata: HashMap::new(),
        };
        ctx.metadata.insert("X-Custom".to_string(), "value".to_string());

        assert_eq!(ctx.tenant_id, "tenant-1");
        assert_eq!(ctx.bu_code, "BU001");
        assert_eq!(ctx.timeout_ms, 60000);
        assert_eq!(ctx.metadata.get("X-Custom"), Some(&"value".to_string()));
    }
}
