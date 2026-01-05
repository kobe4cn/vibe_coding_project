//! Executor error types

use thiserror::Error;

/// Executor error type
#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("Flow not found: {0}")]
    FlowNotFound(String),

    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Invalid node configuration: {0}")]
    InvalidNode(String),

    #[error("Execution error at node {node}: {message}")]
    NodeExecutionError { node: String, message: String },

    #[error("Timeout at node {node} after {timeout_ms}ms")]
    NodeTimeout { node: String, timeout_ms: u64 },

    #[error("Condition error: {0}")]
    ConditionError(String),

    #[error("Tool error: {0}")]
    ToolError(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("GML error: {0}")]
    GmlError(String),

    #[error("Invalid flow definition: {0}")]
    InvalidFlow(String),

    #[error("Cycle detected in flow")]
    CycleDetected,

    #[error("Max iterations exceeded in loop node {0}")]
    MaxIterationsExceeded(String),

    #[error("Persistence error: {0}")]
    PersistenceError(String),

    #[error("Recovery error: {0}")]
    RecoveryError(String),

    #[error("Agent error: {0}")]
    AgentError(String),

    #[error("MCP error: {0}")]
    McpError(String),
}

impl From<fdl_gml::GmlError> for ExecutorError {
    fn from(err: fdl_gml::GmlError) -> Self {
        ExecutorError::GmlError(err.to_string())
    }
}

impl From<fdl_tools::ToolError> for ExecutorError {
    fn from(err: fdl_tools::ToolError) -> Self {
        ExecutorError::ToolError(err.to_string())
    }
}

/// Executor result type
pub type ExecutorResult<T> = Result<T, ExecutorError>;
