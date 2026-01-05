//! AI Agent execution node
//!
//! Executes AI agent calls using configured LLM providers.
//! Supports system prompts, user messages, and tool calling.

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::FlowNode;
use fdl_gml::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Agent configuration
#[derive(Debug, Clone)]
pub struct AgentConfig {
    /// Agent/model identifier (e.g., "claude-3", "gpt-4")
    pub model: String,
    /// System prompt for the agent
    pub system_prompt: Option<String>,
    /// Maximum tokens to generate
    pub max_tokens: Option<u32>,
    /// Temperature for sampling
    pub temperature: Option<f32>,
    /// Available tools for the agent
    pub tools: Vec<AgentTool>,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            model: "default".to_string(),
            system_prompt: None,
            max_tokens: Some(4096),
            temperature: Some(0.7),
            tools: Vec::new(),
        }
    }
}

/// Tool available to the agent
#[derive(Debug, Clone)]
pub struct AgentTool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

/// Agent execution result
#[derive(Debug, Clone)]
pub struct AgentResponse {
    /// The generated content
    pub content: String,
    /// Tool calls made by the agent
    pub tool_calls: Vec<ToolCall>,
    /// Token usage
    pub usage: TokenUsage,
    /// Whether the agent finished or needs more interaction
    pub finish_reason: FinishReason,
}

/// Tool call made by the agent
#[derive(Debug, Clone)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: Value,
}

/// Token usage statistics
#[derive(Debug, Clone, Default)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Reason for finishing generation
#[derive(Debug, Clone, PartialEq)]
pub enum FinishReason {
    Stop,
    MaxTokens,
    ToolCalls,
    ContentFilter,
}

/// Execute an AI agent node
pub async fn execute_agent_node(
    node_id: &str,
    node: &FlowNode,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    // Get agent URI (e.g., "agent://claude-3/chat")
    let agent_uri = node.agent.as_ref().ok_or_else(|| {
        ExecutorError::InvalidNode(format!("Node {} missing agent URI", node_id))
    })?;

    // Parse agent configuration from URI
    let config = parse_agent_uri(agent_uri)?;

    // Build prompt from args
    let eval_ctx = context.read().await.build_eval_context();
    let prompt = if let Some(args_expr) = &node.args {
        let args = fdl_gml::evaluate(args_expr, &eval_ctx)?;
        build_prompt_from_args(&args)?
    } else {
        return Err(ExecutorError::InvalidNode(format!(
            "Node {} missing prompt arguments",
            node_id
        )));
    };

    tracing::info!(
        "Executing agent: {} with model: {}, prompt: {}",
        agent_uri,
        config.model,
        truncate_string(&prompt, 100)
    );

    // Execute agent call (placeholder - actual implementation would call LLM API)
    let response = execute_agent_call(&config, &prompt).await?;

    // Build result value
    let result = Value::object([
        ("success", Value::bool(true)),
        ("content", Value::string(response.content.clone())),
        (
            "tool_calls",
            Value::Array(
                response
                    .tool_calls
                    .iter()
                    .map(|tc| {
                        Value::object([
                            ("id", Value::string(tc.id.clone())),
                            ("name", Value::string(tc.name.clone())),
                            ("arguments", tc.arguments.clone()),
                        ])
                    })
                    .collect(),
            ),
        ),
        (
            "usage",
            Value::object([
                ("prompt_tokens", Value::Int(response.usage.prompt_tokens as i64)),
                (
                    "completion_tokens",
                    Value::Int(response.usage.completion_tokens as i64),
                ),
                ("total_tokens", Value::Int(response.usage.total_tokens as i64)),
            ]),
        ),
        (
            "finish_reason",
            Value::string(match response.finish_reason {
                FinishReason::Stop => "stop",
                FinishReason::MaxTokens => "max_tokens",
                FinishReason::ToolCalls => "tool_calls",
                FinishReason::ContentFilter => "content_filter",
            }),
        ),
    ]);

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

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}

/// Parse agent URI into configuration
fn parse_agent_uri(uri: &str) -> ExecutorResult<AgentConfig> {
    // Expected format: agent://model-name/action?params
    let parts: Vec<&str> = uri.splitn(2, "://").collect();
    if parts.len() != 2 || parts[0] != "agent" {
        return Err(ExecutorError::InvalidNode(format!(
            "Invalid agent URI format: {}",
            uri
        )));
    }

    let path = parts[1];
    let (model_path, query) = if let Some(idx) = path.find('?') {
        (&path[..idx], Some(&path[idx + 1..]))
    } else {
        (path, None)
    };

    let model = model_path.split('/').next().unwrap_or("default").to_string();

    let mut config = AgentConfig {
        model,
        ..Default::default()
    };

    // Parse query parameters
    if let Some(q) = query {
        for param in q.split('&') {
            let parts: Vec<&str> = param.splitn(2, '=').collect();
            if parts.len() == 2 {
                match parts[0] {
                    "max_tokens" => {
                        config.max_tokens = parts[1].parse().ok();
                    }
                    "temperature" => {
                        config.temperature = parts[1].parse().ok();
                    }
                    _ => {}
                }
            }
        }
    }

    Ok(config)
}

/// Build prompt string from arguments
fn build_prompt_from_args(args: &Value) -> ExecutorResult<String> {
    // Support various argument formats
    if let Some(s) = args.as_str() {
        return Ok(s.to_string());
    }

    if let Some(obj) = args.as_object() {
        // Check for common field names
        if let Some(prompt) = obj.get("prompt").and_then(|v| v.as_str()) {
            return Ok(prompt.to_string());
        }
        if let Some(message) = obj.get("message").and_then(|v| v.as_str()) {
            return Ok(message.to_string());
        }
        if let Some(content) = obj.get("content").and_then(|v| v.as_str()) {
            return Ok(content.to_string());
        }

        // Check for messages array (chat format)
        if let Some(Value::Array(messages)) = obj.get("messages") {
            let prompt: Vec<String> = messages
                .iter()
                .filter_map(|m| {
                    let role = m.get("role").and_then(|v| v.as_str()).unwrap_or("user");
                    let content = m.get("content").and_then(|v| v.as_str())?;
                    Some(format!("{}: {}", role, content))
                })
                .collect();
            return Ok(prompt.join("\n"));
        }
    }

    Err(ExecutorError::InvalidNode(
        "Could not extract prompt from arguments".to_string(),
    ))
}

/// Execute the actual agent call (placeholder implementation)
async fn execute_agent_call(config: &AgentConfig, prompt: &str) -> ExecutorResult<AgentResponse> {
    // TODO: Implement actual LLM API calls
    // This is a placeholder that simulates an agent response

    // Simulate some processing time
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    let prompt_tokens = (prompt.len() / 4) as u32; // Rough estimate
    let completion_tokens = 50; // Simulated

    Ok(AgentResponse {
        content: format!(
            "[Agent {} response to: {}]",
            config.model,
            truncate_string(prompt, 50)
        ),
        tool_calls: Vec::new(),
        usage: TokenUsage {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        },
        finish_reason: FinishReason::Stop,
    })
}

/// Truncate string for logging
fn truncate_string(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_agent_uri() {
        let config = parse_agent_uri("agent://claude-3/chat").unwrap();
        assert_eq!(config.model, "claude-3");

        let config = parse_agent_uri("agent://gpt-4/complete?max_tokens=1000&temperature=0.5").unwrap();
        assert_eq!(config.model, "gpt-4");
        assert_eq!(config.max_tokens, Some(1000));
        assert_eq!(config.temperature, Some(0.5));
    }

    #[test]
    fn test_parse_agent_uri_invalid() {
        assert!(parse_agent_uri("invalid-uri").is_err());
        assert!(parse_agent_uri("http://wrong-scheme").is_err());
    }

    #[test]
    fn test_build_prompt_from_string() {
        let args = Value::string("Hello, world!");
        let prompt = build_prompt_from_args(&args).unwrap();
        assert_eq!(prompt, "Hello, world!");
    }

    #[test]
    fn test_build_prompt_from_object() {
        let args = Value::object([("prompt", Value::string("Test prompt"))]);
        let prompt = build_prompt_from_args(&args).unwrap();
        assert_eq!(prompt, "Test prompt");

        let args = Value::object([("message", Value::string("Test message"))]);
        let prompt = build_prompt_from_args(&args).unwrap();
        assert_eq!(prompt, "Test message");
    }

    #[test]
    fn test_build_prompt_from_messages() {
        let args = Value::object([(
            "messages",
            Value::Array(vec![
                Value::object([
                    ("role", Value::string("system")),
                    ("content", Value::string("You are helpful")),
                ]),
                Value::object([
                    ("role", Value::string("user")),
                    ("content", Value::string("Hello")),
                ]),
            ]),
        )]);
        let prompt = build_prompt_from_args(&args).unwrap();
        assert!(prompt.contains("system: You are helpful"));
        assert!(prompt.contains("user: Hello"));
    }

    #[tokio::test]
    async fn test_execute_agent_call() {
        let config = AgentConfig::default();
        let response = execute_agent_call(&config, "Test prompt").await.unwrap();
        assert!(response.content.contains("Agent"));
        assert_eq!(response.finish_reason, FinishReason::Stop);
    }

    #[test]
    fn test_truncate_string() {
        assert_eq!(truncate_string("short", 10), "short");
        assert_eq!(truncate_string("this is a longer string", 10), "this is a ...");
    }
}
