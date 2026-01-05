//! HTTP API tool handler

use crate::error::{ToolError, ToolResult};
use crate::registry::{ToolHandler, ToolMetadata};
use crate::{ToolContext, ToolOutput};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use std::time::{Duration, Instant};

/// HTTP API tool handler
pub struct ApiHandler {
    client: Client,
    base_url: String,
}

impl ApiHandler {
    /// Create a new API handler
    pub fn new(base_url: &str) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.to_string(),
        }
    }

    /// Create with custom client
    pub fn with_client(client: Client, base_url: &str) -> Self {
        Self {
            client,
            base_url: base_url.to_string(),
        }
    }
}

#[async_trait]
impl ToolHandler for ApiHandler {
    async fn execute(
        &self,
        path: &str,
        args: Value,
        context: &ToolContext,
    ) -> ToolResult<ToolOutput> {
        let start = Instant::now();

        let url = format!("{}/{}", self.base_url, path);

        let mut request = self
            .client
            .post(&url)
            .timeout(Duration::from_millis(context.timeout_ms))
            .header("Content-Type", "application/json")
            .header("X-Tenant-Id", &context.tenant_id)
            .header("X-Bu-Code", &context.bu_code);

        // Add custom headers from metadata
        for (key, value) in &context.metadata {
            request = request.header(key, value);
        }

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

    fn metadata(&self) -> ToolMetadata {
        ToolMetadata {
            name: "api".to_string(),
            description: "HTTP API tool handler".to_string(),
            input_schema: None,
            output_schema: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_handler_creation() {
        let handler = ApiHandler::new("http://localhost:8080");
        let metadata = handler.metadata();
        assert_eq!(metadata.name, "api");
    }
}
