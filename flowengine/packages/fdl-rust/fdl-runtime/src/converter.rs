//! 流程模型转换器
//!
//! 将前端 React Flow 格式转换为后端执行器格式。
//! 
//! 前端使用 React Flow 的节点-边模型，后端使用基于依赖图的节点模型。
//! 转换器负责：
//! - 将边（edges）转换为节点的 next/then/else/fail 字段
//! - 将前端节点数据映射到后端 FlowNode 结构
//! - 解析全局变量

use fdl_executor::types::{CaseBranch, Flow, FlowArgs, FlowMeta, FlowNode};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 前端节点位置（用于可视化，后端不使用）
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

/// 将前端流程转换为执行器流程
/// 
/// 转换过程：
/// 1. 解析边（edges）并分类为 next/then/else/fail 四种类型
/// 2. 将前端节点数据转换为后端 FlowNode
/// 3. 解析全局变量
pub fn convert_frontend_to_executor(frontend: &FrontendFlow) -> Flow {
    let mut nodes: HashMap<String, FlowNode> = HashMap::new();

    // 构建边查找表：根据边类型分类存储
    // 前端使用边表示节点连接，后端使用节点内的 next/then/else/fail 字段
    let mut next_edges: HashMap<String, String> = HashMap::new();
    let mut then_edges: HashMap<String, String> = HashMap::new();
    let mut else_edges: HashMap<String, String> = HashMap::new();
    let mut fail_edges: HashMap<String, String> = HashMap::new();

    for edge in &frontend.edges {
        // 从边的数据中获取边类型，默认为 "next"
        let edge_type = edge
            .data
            .as_ref()
            .map(|d| d.edge_type.as_str())
            .unwrap_or("next");

        // 根据边类型分类存储，用于后续设置节点的相应字段
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
                // 未知类型默认为 next
                next_edges.insert(edge.source.clone(), edge.target.clone());
            }
        }
    }

    // 转换每个节点：将前端节点数据映射到后端 FlowNode
    for node in &frontend.nodes {
        let data = &node.data;
        let node_id = &node.id;

        let flow_node = FlowNode {
            name: Some(data.label.clone()),
            description: data.description.clone(),
            // 从边查找表中获取对应的目标节点
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
            // 转换 switch 节点的 case 分支
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
            node: None, // 子流程节点在此转换中不支持
            each: data.each.clone(),
            // 支持两种方式指定 agent：直接 URI 或通过 model 字段构建
            agent: data.agent.clone().or_else(|| {
                // 如果提供了 model，构建 agent URI
                data.model.as_ref().map(|m| format!("agent://{}", m))
            }),
            // 支持两种方式指定 MCP：直接 URI 或通过 server + tool 构建
            mcp: data.mcp.clone().or_else(|| {
                // 如果提供了 server 和 tool，构建 MCP URI
                match (&data.server, &data.tool) {
                    (Some(server), Some(tool)) => Some(format!("mcp://{}/{}", server, tool)),
                    _ => None,
                }
            }),
        };

        nodes.insert(node_id.clone(), flow_node);
    }

    // 解析全局变量：简单解析 "key = value" 格式的字符串
    let vars = frontend
        .vars
        .as_ref()
        .map(|v| {
            // 按行解析，每行格式为 "key = value"
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

/// 执行结果（用于 API 响应）
/// 
/// 包含执行的成功状态、输出结果、各节点结果、错误信息和执行时长。
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
    fn test_json_deserialization() {
        // 模拟前端发送的真实 JSON 数据
        let json_data = r#"{
            "meta": { "name": "Test Flow" },
            "nodes": [{
                "id": "mapping-1",
                "type": "mapping",
                "position": { "x": 100, "y": 200 },
                "data": {
                    "nodeType": "mapping",
                    "label": "计算结果",
                    "with": "result = 1 + 2"
                }
            }],
            "edges": []
        }"#;

        let frontend: FrontendFlow = serde_json::from_str(json_data).unwrap();
        assert_eq!(frontend.nodes.len(), 1);

        let node = &frontend.nodes[0];
        assert_eq!(node.data.node_type, "mapping");
        assert_eq!(node.data.with_expr, Some("result = 1 + 2".to_string()));

        // 转换并执行
        let flow = convert_frontend_to_executor(&frontend);
        let executor_node = flow.nodes.get("mapping-1").unwrap();
        assert_eq!(executor_node.with_expr, Some("result = 1 + 2".to_string()));
    }

    #[tokio::test]
    async fn test_end_to_end_execution() {
        use fdl_executor::Executor;
        use fdl_gml::Value;

        // 模拟前端发送的真实 JSON 数据
        let json_data = r#"{
            "meta": { "name": "Test Flow" },
            "nodes": [{
                "id": "step1",
                "type": "mapping",
                "position": { "x": 100, "y": 200 },
                "data": {
                    "nodeType": "mapping",
                    "label": "计算结果",
                    "with": "result = 10 + 20"
                }
            }],
            "edges": []
        }"#;

        let frontend: FrontendFlow = serde_json::from_str(json_data).unwrap();
        let flow = convert_frontend_to_executor(&frontend);

        // 执行流程
        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        // 验证结果
        let step1 = result.get("step1").expect("step1 should exist");
        assert_eq!(step1.get("result"), Some(&Value::Int(30)));
    }

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
