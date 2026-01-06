//! Tool registry and handler trait

use crate::error::ToolResult;
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

/// Tool handler trait
#[async_trait]
pub trait ToolHandler: Send + Sync {
    /// Execute the tool with the given arguments
    async fn execute(
        &self,
        path: &str,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput>;

    /// Get tool metadata/schema
    fn metadata(&self) -> ToolMetadata;
}

/// Tool metadata
#[derive(Debug, Clone)]
pub struct ToolMetadata {
    pub name: String,
    pub description: String,
    pub input_schema: Option<Value>,
    pub output_schema: Option<Value>,
}

/// Tool registry for managing tool handlers
pub struct ToolRegistry {
    handlers: HashMap<String, Arc<dyn ToolHandler>>,
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    /// Register a tool handler
    pub fn register(&mut self, tool_type: &str, handler: Arc<dyn ToolHandler>) {
        self.handlers.insert(tool_type.to_string(), handler);
    }

    /// Get a tool handler by type
    pub fn get(&self, tool_type: &str) -> Option<Arc<dyn ToolHandler>> {
        self.handlers.get(tool_type).cloned()
    }

    /// Execute a tool by URI
    pub async fn execute(
        &self,
        uri: &str,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let parsed = crate::parse_tool_uri(uri)?;

        let handler = self
            .get(&parsed.tool_type)
            .ok_or_else(|| crate::error::ToolError::ToolNotFound(parsed.tool_type.clone()))?;

        handler.execute(&parsed.path, args, context).await
    }

    /// List all registered tool types
    pub fn list_types(&self) -> Vec<String> {
        self.handlers.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockHandler;

    #[async_trait]
    impl ToolHandler for MockHandler {
        async fn execute(
            &self,
            path: &str,
            _args: Value,
            _context: &crate::ToolContext,
        ) -> crate::ToolResult<crate::ToolOutput> {
            Ok(crate::ToolOutput {
                value: serde_json::json!({ "path": path, "mock": true }),
                duration_ms: 1,
                messages: vec![],
            })
        }

        fn metadata(&self) -> ToolMetadata {
            ToolMetadata {
                name: "mock".to_string(),
                description: "Mock handler for testing".to_string(),
                input_schema: None,
                output_schema: None,
            }
        }
    }

    #[test]
    fn test_registry_creation() {
        let registry = ToolRegistry::new();
        assert!(registry.list_types().is_empty());
    }

    #[test]
    fn test_registry_register_and_get() {
        let mut registry = ToolRegistry::new();
        let handler = Arc::new(MockHandler);
        registry.register("mock", handler);

        assert!(registry.get("mock").is_some());
        assert!(registry.get("unknown").is_none());
        assert!(registry.list_types().contains(&"mock".to_string()));
    }

    #[tokio::test]
    async fn test_registry_execute() {
        let mut registry = ToolRegistry::new();
        registry.register("mock", Arc::new(MockHandler));

        let context = crate::ToolContext::default();
        let args = serde_json::json!({ "key": "value" });

        let result = registry.execute("mock://test/path", args, &context).await;
        assert!(result.is_ok());

        let output = result.unwrap();
        assert_eq!(
            output.value.get("path"),
            Some(&serde_json::json!("test/path"))
        );
        assert_eq!(output.value.get("mock"), Some(&serde_json::json!(true)));
    }

    #[tokio::test]
    async fn test_registry_execute_unknown_type() {
        let registry = ToolRegistry::new();
        let context = crate::ToolContext::default();

        let result = registry
            .execute("unknown://path", serde_json::json!({}), &context)
            .await;
        assert!(result.is_err());
    }
}
