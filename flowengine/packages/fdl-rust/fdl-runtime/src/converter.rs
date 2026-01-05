//! Flow model converter
//!
//! Converts frontend React Flow format to backend executor format

use fdl_executor::types::{CaseBranch, Flow, FlowArgs, FlowMeta, FlowNode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Frontend node position
#[derive(Debug, Clone, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Frontend node data
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendNodeData {
    pub node_type: String,
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub only: Option<String>,
    // Exec node
    #[serde(default)]
    pub exec: Option<String>,
    // Mapping node
    #[serde(default, rename = "with")]
    pub with_expr: Option<String>,
    #[serde(default)]
    pub sets: Option<String>,
    #[serde(default)]
    pub args: Option<String>,
    // Condition node
    #[serde(default)]
    pub when: Option<String>,
    // Switch node
    #[serde(default)]
    pub cases: Option<Vec<FrontendCase>>,
    // Delay node
    #[serde(default)]
    pub wait: Option<String>,
    // Each node
    #[serde(default)]
    pub each: Option<String>,
    // Loop node
    #[serde(default)]
    pub vars: Option<String>,
    // Agent node
    #[serde(default)]
    pub agent: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub instructions: Option<String>,
    // MCP node
    #[serde(default)]
    pub mcp: Option<String>,
    #[serde(default)]
    pub server: Option<String>,
    #[serde(default)]
    pub tool: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FrontendCase {
    pub when: String,
    pub then: String,
}

/// Frontend React Flow node
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: Option<String>,
    pub position: Position,
    pub data: FrontendNodeData,
}

/// Frontend edge data
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendEdgeData {
    pub edge_type: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub case_index: Option<usize>,
}

/// Frontend React Flow edge
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(default)]
    pub data: Option<FrontendEdgeData>,
}

/// Frontend flow metadata
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendMeta {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

/// Frontend flow model (React Flow format)
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendFlow {
    pub meta: FrontendMeta,
    #[serde(default)]
    pub nodes: Vec<FrontendNode>,
    #[serde(default)]
    pub edges: Vec<FrontendEdge>,
    #[serde(default)]
    pub vars: Option<String>,
}

/// Convert frontend flow to executor flow
pub fn convert_frontend_to_executor(frontend: &FrontendFlow) -> Flow {
    let mut nodes: HashMap<String, FlowNode> = HashMap::new();

    // Build edge lookup: source -> (target, edge_type)
    let mut next_edges: HashMap<String, String> = HashMap::new();
    let mut then_edges: HashMap<String, String> = HashMap::new();
    let mut else_edges: HashMap<String, String> = HashMap::new();
    let mut fail_edges: HashMap<String, String> = HashMap::new();

    for edge in &frontend.edges {
        let edge_type = edge
            .data
            .as_ref()
            .map(|d| d.edge_type.as_str())
            .unwrap_or("next");

        match edge_type {
            "next" => {
                next_edges.insert(edge.source.clone(), edge.target.clone());
            }
            "then" => {
                then_edges.insert(edge.source.clone(), edge.target.clone());
            }
            "else" => {
                else_edges.insert(edge.source.clone(), edge.target.clone());
            }
            "fail" => {
                fail_edges.insert(edge.source.clone(), edge.target.clone());
            }
            _ => {
                next_edges.insert(edge.source.clone(), edge.target.clone());
            }
        }
    }

    // Convert each node
    for node in &frontend.nodes {
        let data = &node.data;
        let node_id = &node.id;

        let flow_node = FlowNode {
            name: Some(data.label.clone()),
            description: data.description.clone(),
            next: next_edges.get(node_id).cloned(),
            fail: fail_edges.get(node_id).cloned(),
            only: data.only.clone(),
            exec: data.exec.clone(),
            args: data.args.clone(),
            with_expr: data.with_expr.clone(),
            sets: data.sets.clone(),
            when: data.when.clone(),
            then: then_edges.get(node_id).cloned(),
            else_branch: else_edges.get(node_id).cloned(),
            case: data.cases.as_ref().map(|cases| {
                cases
                    .iter()
                    .map(|c| CaseBranch {
                        when: c.when.clone(),
                        then: c.then.clone(),
                    })
                    .collect()
            }),
            wait: data.wait.clone(),
            vars: data.vars.clone(),
            node: None, // Sub-flow nodes not supported in this conversion
            each: data.each.clone(),
            agent: data.agent.clone().or_else(|| {
                // Build agent URI from model if present
                data.model.as_ref().map(|m| format!("agent://{}", m))
            }),
            mcp: data.mcp.clone().or_else(|| {
                // Build MCP URI from server and tool
                match (&data.server, &data.tool) {
                    (Some(server), Some(tool)) => Some(format!("mcp://{}/{}", server, tool)),
                    _ => None,
                }
            }),
        };

        nodes.insert(node_id.clone(), flow_node);
    }

    // Parse global vars
    let vars = frontend
        .vars
        .as_ref()
        .map(|v| {
            // Simple parsing: "key = value" lines
            v.lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.splitn(2, '=').collect();
                    if parts.len() == 2 {
                        Some((parts[0].trim().to_string(), parts[1].trim().to_string()))
                    } else {
                        None
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Flow {
        meta: FlowMeta {
            name: frontend.meta.name.clone(),
            description: frontend.meta.description.clone(),
        },
        args: FlowArgs::default(),
        vars,
        nodes,
    }
}

/// Execution result for API response
#[derive(Debug, Clone, Serialize)]
pub struct ExecutionResult {
    pub success: bool,
    pub outputs: serde_json::Value,
    pub node_results: HashMap<String, serde_json::Value>,
    pub error: Option<String>,
    pub duration_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_simple_flow() {
        let frontend = FrontendFlow {
            meta: FrontendMeta {
                name: "Test Flow".to_string(),
                description: Some("A test".to_string()),
            },
            nodes: vec![FrontendNode {
                id: "node1".to_string(),
                node_type: Some("mapping".to_string()),
                position: Position { x: 0.0, y: 0.0 },
                data: FrontendNodeData {
                    node_type: "mapping".to_string(),
                    label: "Step 1".to_string(),
                    with_expr: Some("result = 1 + 1".to_string()),
                    description: None,
                    only: None,
                    exec: None,
                    sets: None,
                    args: None,
                    when: None,
                    cases: None,
                    wait: None,
                    each: None,
                    vars: None,
                    agent: None,
                    model: None,
                    instructions: None,
                    mcp: None,
                    server: None,
                    tool: None,
                },
            }],
            edges: vec![],
            vars: None,
        };

        let flow = convert_frontend_to_executor(&frontend);
        assert_eq!(flow.meta.name, "Test Flow");
        assert!(flow.nodes.contains_key("node1"));

        let node = flow.nodes.get("node1").unwrap();
        assert_eq!(node.with_expr, Some("result = 1 + 1".to_string()));
    }

    #[test]
    fn test_convert_flow_with_edges() {
        let frontend = FrontendFlow {
            meta: FrontendMeta {
                name: "Flow".to_string(),
                description: None,
            },
            nodes: vec![
                FrontendNode {
                    id: "a".to_string(),
                    node_type: Some("mapping".to_string()),
                    position: Position { x: 0.0, y: 0.0 },
                    data: FrontendNodeData {
                        node_type: "mapping".to_string(),
                        label: "A".to_string(),
                        with_expr: Some("x = 1".to_string()),
                        description: None,
                        only: None,
                        exec: None,
                        sets: None,
                        args: None,
                        when: None,
                        cases: None,
                        wait: None,
                        each: None,
                        vars: None,
                        agent: None,
                        model: None,
                        instructions: None,
                        mcp: None,
                        server: None,
                        tool: None,
                    },
                },
                FrontendNode {
                    id: "b".to_string(),
                    node_type: Some("mapping".to_string()),
                    position: Position { x: 0.0, y: 100.0 },
                    data: FrontendNodeData {
                        node_type: "mapping".to_string(),
                        label: "B".to_string(),
                        with_expr: Some("y = a.x + 1".to_string()),
                        description: None,
                        only: None,
                        exec: None,
                        sets: None,
                        args: None,
                        when: None,
                        cases: None,
                        wait: None,
                        each: None,
                        vars: None,
                        agent: None,
                        model: None,
                        instructions: None,
                        mcp: None,
                        server: None,
                        tool: None,
                    },
                },
            ],
            edges: vec![FrontendEdge {
                id: "e1".to_string(),
                source: "a".to_string(),
                target: "b".to_string(),
                data: Some(FrontendEdgeData {
                    edge_type: "next".to_string(),
                    label: None,
                    case_index: None,
                }),
            }],
            vars: None,
        };

        let flow = convert_frontend_to_executor(&frontend);

        let node_a = flow.nodes.get("a").unwrap();
        assert_eq!(node_a.next, Some("b".to_string()));
    }
}
