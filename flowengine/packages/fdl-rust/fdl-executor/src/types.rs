//! FDL 类型定义
//!
//! 定义了流程定义语言（FDL）的核心数据结构，包括：
//! - Flow: 流程定义
//! - FlowNode: 流程节点
//! - NodeType: 节点类型枚举

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 流程定义
///
/// 包含流程的元数据、参数定义、全局变量和节点定义。
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
    /// Entry node IDs - nodes that Start node connects to
    /// 入口节点列表：Start 节点连接的目标节点 ID
    #[serde(default)]
    pub entry: Option<Vec<String>>,
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
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

    // Guard node fields
    /// Guard types to check (pii, jailbreak, moderation, etc.)
    #[serde(default)]
    pub guard: Option<String>,

    // Approval node fields
    /// Approval request configuration
    #[serde(default)]
    pub approval: Option<String>,

    // Handoff node fields
    /// Target agent for handoff
    #[serde(default)]
    pub handoff: Option<String>,

    // OSS node fields
    /// Object storage URI (e.g., "oss://bucket/path")
    #[serde(default)]
    pub oss: Option<String>,

    // MQ node fields
    /// Message queue URI (e.g., "mq://topic/queue")
    #[serde(default)]
    pub mq: Option<String>,

    // Mail node fields
    /// Mail sending configuration
    #[serde(default)]
    pub mail: Option<String>,

    // SMS node fields
    /// SMS sending configuration
    #[serde(default)]
    pub sms: Option<String>,

    // Service node fields
    /// Microservice call URI (e.g., "svc://service/method")
    #[serde(default)]
    pub service: Option<String>,

    // Start node fields
    /// Input parameters for start node
    #[serde(default)]
    pub parameters: Option<Vec<InputParamDef>>,

    /// Node type (used by frontend, e.g., "start", "exec", "mapping")
    #[serde(rename = "nodeType", default)]
    pub node_type_str: Option<String>,
}

impl FlowNode {
    /// 根据节点字段确定节点类型
    ///
    /// 节点类型通过检查特定字段的存在来确定，优先级顺序：
    /// 0. node_type_str 显式指定 -> 对应类型
    /// 1. exec -> Exec（工具调用）
    /// 2. agent -> Agent（AI 代理）
    /// 3. mcp -> Mcp（MCP 协议）
    /// 4. guard -> Guard（安全检查）
    /// 5. approval -> Approval（人工审批）
    /// 6. handoff -> Handoff（Agent 移交）
    /// 7. oss -> Oss（对象存储）
    /// 8. mq -> Mq（消息队列）
    /// 9. mail -> Mail（邮件发送）
    /// 10. sms -> Sms（短信发送）
    /// 11. service -> Service（微服务调用）
    /// 12. when + then -> Condition（条件分支）
    /// 13. case -> Switch（多分支）
    /// 14. wait -> Delay（延迟）
    /// 15. each -> Each（迭代）
    /// 16. vars + when + node -> Loop（循环）
    /// 17. with_expr -> Mapping（数据映射）
    /// 18. 其他 -> Unknown（未知类型）
    pub fn node_type(&self) -> NodeType {
        // 优先检查显式指定的节点类型（来自前端）
        if let Some(ref type_str) = self.node_type_str {
            match type_str.as_str() {
                "start" => return NodeType::Start,
                "exec" => return NodeType::Exec,
                "mapping" => return NodeType::Mapping,
                "condition" => return NodeType::Condition,
                "switch" => return NodeType::Switch,
                "delay" => return NodeType::Delay,
                "each" => return NodeType::Each,
                "loop" => return NodeType::Loop,
                "agent" => return NodeType::Agent,
                "mcp" => return NodeType::Mcp,
                "guard" => return NodeType::Guard,
                "approval" => return NodeType::Approval,
                "handoff" => return NodeType::Handoff,
                "oss" => return NodeType::Oss,
                "mq" => return NodeType::Mq,
                "mail" => return NodeType::Mail,
                "sms" => return NodeType::Sms,
                "service" => return NodeType::Service,
                _ => {}
            }
        }

        // 通过字段检测节点类型
        if self.exec.is_some() {
            NodeType::Exec
        } else if self.agent.is_some() {
            NodeType::Agent
        } else if self.mcp.is_some() {
            NodeType::Mcp
        } else if self.guard.is_some() {
            NodeType::Guard
        } else if self.approval.is_some() {
            NodeType::Approval
        } else if self.handoff.is_some() {
            NodeType::Handoff
        } else if self.oss.is_some() {
            NodeType::Oss
        } else if self.mq.is_some() {
            NodeType::Mq
        } else if self.mail.is_some() {
            NodeType::Mail
        } else if self.sms.is_some() {
            NodeType::Sms
        } else if self.service.is_some() {
            NodeType::Service
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

    /// Check if this is a start node
    pub fn is_start(&self) -> bool {
        self.node_type() == NodeType::Start
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
    /// Start node - flow entry point
    Start,
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
    /// Guard node - security checks
    Guard,
    /// Approval node - human-in-the-loop
    Approval,
    /// Handoff node - agent handoff
    Handoff,
    /// OSS node - object storage operations
    Oss,
    /// MQ node - message queue operations
    Mq,
    /// Mail node - email sending
    Mail,
    /// SMS node - SMS sending
    Sms,
    /// Service node - microservice call
    Service,
    /// Unknown node type
    Unknown,
}

/// Start node input parameter definition
///
/// 定义了流程启动时需要传入的参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InputParamDef {
    /// Parameter name
    pub name: String,
    /// Parameter type: string, number, boolean, object, array
    #[serde(rename = "type")]
    pub param_type: String,
    /// Whether the parameter is required
    #[serde(default)]
    pub required: bool,
    /// Default value (optional)
    #[serde(rename = "defaultValue")]
    pub default_value: Option<String>,
    /// Parameter description (optional)
    pub description: Option<String>,
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
