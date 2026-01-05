//! FDL type definitions

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Flow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    /// Flow metadata
    pub meta: FlowMeta,
    /// Flow arguments (inputs/outputs)
    #[serde(default)]
    pub args: FlowArgs,
    /// Global variables
    #[serde(default)]
    pub vars: HashMap<String, String>,
    /// Flow nodes
    pub nodes: HashMap<String, FlowNode>,
}

/// Flow metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowMeta {
    /// Flow name
    pub name: String,
    /// Flow description
    #[serde(default)]
    pub description: Option<String>,
}

/// Flow arguments definition
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FlowArgs {
    /// Type definitions
    #[serde(default)]
    pub defs: HashMap<String, TypeDef>,
    /// Input parameters
    #[serde(rename = "in", default)]
    pub inputs: HashMap<String, ParamDef>,
    /// Output parameters
    #[serde(default)]
    pub out: Option<OutputDef>,
}

/// Type definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeDef {
    #[serde(flatten)]
    pub fields: HashMap<String, String>,
}

/// Parameter definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ParamDef {
    /// Simple type definition: `name: string`
    Simple(String),
    /// With default value: `name: string = 'default'`
    WithDefault { type_name: String, default: String },
}

/// Output definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OutputDef {
    /// Simple type: `out: string`
    Simple(String),
    /// Structured output
    Structured(HashMap<String, String>),
}

/// Flow node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    /// Node display name
    #[serde(default)]
    pub name: Option<String>,
    /// Node description
    #[serde(default)]
    pub description: Option<String>,
    /// Next node(s) to execute
    #[serde(default)]
    pub next: Option<String>,
    /// Error handler node
    #[serde(default)]
    pub fail: Option<String>,
    /// Conditional execution
    #[serde(default)]
    pub only: Option<String>,

    // Tool call node fields
    /// Tool execution URI
    #[serde(default)]
    pub exec: Option<String>,
    /// Tool arguments (GML)
    #[serde(default)]
    pub args: Option<String>,

    // Data mapping node fields
    /// Output transformation (GML)
    #[serde(rename = "with", default)]
    pub with_expr: Option<String>,
    /// Variable updates (GML)
    #[serde(default)]
    pub sets: Option<String>,

    // Condition node fields
    /// Condition expression
    #[serde(default)]
    pub when: Option<String>,
    /// True branch
    #[serde(default)]
    pub then: Option<String>,
    /// False branch
    #[serde(rename = "else", default)]
    pub else_branch: Option<String>,

    // Switch node fields
    /// Case branches
    #[serde(default)]
    pub case: Option<Vec<CaseBranch>>,

    // Delay node fields
    /// Wait duration
    #[serde(default)]
    pub wait: Option<String>,

    // Loop node fields
    /// Loop variables (GML)
    #[serde(default)]
    pub vars: Option<String>,
    /// Loop body nodes
    #[serde(default)]
    pub node: Option<HashMap<String, FlowNode>>,

    // Each node fields
    /// Each iteration source
    #[serde(default)]
    pub each: Option<String>,

    // Agent node fields
    /// AI Agent URI (e.g., "agent://claude-3/chat")
    #[serde(default)]
    pub agent: Option<String>,

    // MCP node fields
    /// MCP tool URI (e.g., "mcp://filesystem/read_file")
    #[serde(default)]
    pub mcp: Option<String>,
}

impl FlowNode {
    /// Determine the node type from its fields
    pub fn node_type(&self) -> NodeType {
        if self.exec.is_some() {
            NodeType::Exec
        } else if self.agent.is_some() {
            NodeType::Agent
        } else if self.mcp.is_some() {
            NodeType::Mcp
        } else if self.when.is_some() && self.then.is_some() {
            NodeType::Condition
        } else if self.case.is_some() {
            NodeType::Switch
        } else if self.wait.is_some() {
            NodeType::Delay
        } else if self.each.is_some() {
            NodeType::Each
        } else if self.vars.is_some() && self.when.is_some() && self.node.is_some() {
            NodeType::Loop
        } else if self.with_expr.is_some() {
            NodeType::Mapping
        } else {
            NodeType::Unknown
        }
    }
}

/// Case branch for switch node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseBranch {
    /// Condition expression
    pub when: String,
    /// Target node
    pub then: String,
}

/// Node type enumeration
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum NodeType {
    /// Tool execution node
    Exec,
    /// Data mapping node
    Mapping,
    /// Condition (if/else) node
    Condition,
    /// Switch (case/when) node
    Switch,
    /// Delay node
    Delay,
    /// Each (iteration) node
    Each,
    /// Loop (while) node
    Loop,
    /// AI Agent node
    Agent,
    /// MCP (Model Context Protocol) node
    Mcp,
    /// Unknown node type
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_type_detection() {
        let exec_node = FlowNode {
            name: Some("Test".into()),
            exec: Some("api://test".into()),
            ..Default::default()
        };
        assert_eq!(exec_node.node_type(), NodeType::Exec);

        let mapping_node = FlowNode {
            name: Some("Map".into()),
            with_expr: Some("name = user.name".into()),
            ..Default::default()
        };
        assert_eq!(mapping_node.node_type(), NodeType::Mapping);

        let condition_node = FlowNode {
            name: Some("Check".into()),
            when: Some("x > 0".into()),
            then: Some("yes".into()),
            ..Default::default()
        };
        assert_eq!(condition_node.node_type(), NodeType::Condition);
    }
}

impl Default for FlowNode {
    fn default() -> Self {
        Self {
            name: None,
            description: None,
            next: None,
            fail: None,
            only: None,
            exec: None,
            args: None,
            with_expr: None,
            sets: None,
            when: None,
            then: None,
            else_branch: None,
            case: None,
            wait: None,
            vars: None,
            node: None,
            each: None,
            agent: None,
            mcp: None,
        }
    }
}
