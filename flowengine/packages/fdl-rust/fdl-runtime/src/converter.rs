//! 流程模型转换器
//!
//! 将前端 React Flow 格式转换为后端执行器格式。
//!
//! 前端使用 React Flow 的节点-边模型，后端使用基于依赖图的节点模型。
//! 转换器负责：
//! - 将边（edges）转换为节点的 next/then/else/fail 字段
//! - 将前端节点数据映射到后端 FlowNode 结构
//! - 解析全局变量
//! - 处理 Start 节点的参数定义

use fdl_executor::types::{
    CaseBranch, Flow, FlowArgs, FlowMeta, FlowNode, InputParamDef, ParamDef,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 前端节点位置（用于可视化，后端不使用）
#[derive(Debug, Clone, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// 前端 Start 节点的参数定义
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendParameterDef {
    pub name: String,
    #[serde(rename = "type")]
    pub param_type: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub default_value: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

/// Frontend node data
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FrontendNodeData {
    #[serde(default)]
    pub node_type: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub only: Option<String>,
    // Start node - 流程入口参数定义
    #[serde(default)]
    pub parameters: Option<Vec<FrontendParameterDef>>,
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
    // Extended node types - 扩展节点类型
    #[serde(default)]
    pub guard: Option<String>,
    #[serde(default)]
    pub approval: Option<String>,
    #[serde(default)]
    pub handoff: Option<String>,
    #[serde(default)]
    pub oss: Option<String>,
    #[serde(default)]
    pub mq: Option<String>,
    #[serde(default)]
    pub mail: Option<String>,
    #[serde(default)]
    pub sms: Option<String>,
    #[serde(default)]
    pub service: Option<String>,
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

/// Frontend 输出参数定义
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendOutputDef {
    pub name: String,
    #[serde(rename = "type")]
    pub output_type: String,
}

/// Frontend 流程参数（inputs/outputs）
/// 支持两种输出字段命名：`out`（YAML 格式）和 `outputs`（前端 JSON 格式）
#[derive(Debug, Clone, Deserialize, Default)]
pub struct FrontendArgs {
    #[serde(rename = "in", default)]
    pub inputs: Option<HashMap<String, String>>,
    /// YAML 格式使用 `out`
    #[serde(default)]
    pub out: Option<Vec<FrontendOutputDef>>,
    /// 前端 JSON 格式使用 `outputs`
    #[serde(default)]
    pub outputs: Option<Vec<FrontendOutputDef>>,
}

impl FrontendArgs {
    /// 获取输出定义，优先使用 `out`，如果不存在则使用 `outputs`
    pub fn get_outputs(&self) -> Option<&Vec<FrontendOutputDef>> {
        self.out.as_ref().or(self.outputs.as_ref())
    }
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
    /// 流程参数定义（可选，用于 YAML 格式的流程）
    #[serde(default)]
    pub args: Option<FrontendArgs>,
}

/// 工具类型检测结果
/// 包含各种工具类型的 URI（oss、mq、mail、sms、service）
type ToolTypeDetectionResult = (
    Option<String>, // oss
    Option<String>, // mq
    Option<String>, // mail
    Option<String>, // sms
    Option<String>, // service
);

/// 从 exec URI 前缀检测工具类型，返回填充的专用字段
///
/// 如果前端已显式设置了专用字段（如 oss:），则优先使用
/// 否则从 exec 字段的 URI 前缀推断
fn detect_tool_type_from_exec(data: &FrontendNodeData) -> ToolTypeDetectionResult {
    // 如果已显式设置专用字段，优先使用
    if data.oss.is_some() {
        return (
            data.oss.clone(),
            data.mq.clone(),
            data.mail.clone(),
            data.sms.clone(),
            data.service.clone(),
        );
    }
    if data.mq.is_some() {
        return (
            data.oss.clone(),
            data.mq.clone(),
            data.mail.clone(),
            data.sms.clone(),
            data.service.clone(),
        );
    }
    if data.mail.is_some() {
        return (
            data.oss.clone(),
            data.mq.clone(),
            data.mail.clone(),
            data.sms.clone(),
            data.service.clone(),
        );
    }
    if data.sms.is_some() {
        return (
            data.oss.clone(),
            data.mq.clone(),
            data.mail.clone(),
            data.sms.clone(),
            data.service.clone(),
        );
    }
    if data.service.is_some() {
        return (
            data.oss.clone(),
            data.mq.clone(),
            data.mail.clone(),
            data.sms.clone(),
            data.service.clone(),
        );
    }

    // 如果没有显式设置，从 exec 字段检测
    if let Some(ref exec_uri) = data.exec {
        let lower = exec_uri.to_lowercase();
        if lower.starts_with("oss://") {
            return (Some(exec_uri.clone()), None, None, None, None);
        }
        if lower.starts_with("mq://") {
            return (None, Some(exec_uri.clone()), None, None, None);
        }
        if lower.starts_with("mail://") {
            return (None, None, Some(exec_uri.clone()), None, None);
        }
        if lower.starts_with("sms://") {
            return (None, None, None, Some(exec_uri.clone()), None);
        }
        if lower.starts_with("svc://") {
            return (None, None, None, None, Some(exec_uri.clone()));
        }
    }

    // 没有检测到特殊工具类型，保持原样
    (
        data.oss.clone(),
        data.mq.clone(),
        data.mail.clone(),
        data.sms.clone(),
        data.service.clone(),
    )
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

        // 转换 Start 节点的参数定义
        let parameters = data.parameters.as_ref().map(|params| {
            params
                .iter()
                .map(|p| InputParamDef {
                    name: p.name.clone(),
                    param_type: p.param_type.clone(),
                    required: p.required,
                    default_value: p.default_value.clone(),
                    description: p.description.clone(),
                })
                .collect()
        });

        // 检测 exec URI 前缀并填充对应的专用字段
        // 支持两种写法：
        // 1. 专用字段：oss: "oss://...", mq: "mq://...", service: "svc://..."
        // 2. 统一 exec 字段：exec: "oss://..." (自动识别并填充)
        let (oss, mq, mail, sms, service) = detect_tool_type_from_exec(data);

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
            // Start 节点专用字段
            parameters,
            node_type_str: Some(data.node_type.clone()),
            // 扩展节点类型字段
            guard: data.guard.clone(),
            approval: data.approval.clone(),
            handoff: data.handoff.clone(),
            oss,
            mq,
            mail,
            sms,
            service,
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

    // 从 Start 节点提取参数定义和入口节点
    // 查找 Start 节点并提取其连接的下游节点作为 entry
    // 同时传递 frontend.args 用于提取输出定义
    let args = extract_flow_args(&frontend.nodes, &frontend.edges, frontend.args.as_ref());

    // 如果有 entry，更新 Start 节点的 next 字段为逗号分隔的所有入口节点
    // 这确保调度器能并行执行所有入口节点
    if let Some(ref entry) = args.entry
        && let Some(start_node) = frontend.nodes.iter().find(|n| n.data.node_type == "start")
        && let Some(node) = nodes.get_mut(&start_node.id)
    {
        node.next = Some(entry.join(", "));
    }

    Flow {
        meta: FlowMeta {
            name: frontend.meta.name.clone(),
            description: frontend.meta.description.clone(),
        },
        args,
        vars,
        nodes,
    }
}

/// 从前端节点中提取 FlowArgs
///
/// 查找 Start 节点，提取：
/// 1. 参数定义 -> FlowArgs.inputs
/// 2. Start 节点的所有出边目标 -> FlowArgs.entry
/// 3. 输出定义 -> FlowArgs.out
fn extract_flow_args(
    nodes: &[FrontendNode],
    edges: &[FrontendEdge],
    frontend_args: Option<&FrontendArgs>,
) -> FlowArgs {
    // 查找 Start 节点
    let start_node = nodes.iter().find(|n| n.data.node_type == "start");

    let start_node = match start_node {
        Some(node) => node,
        None => return FlowArgs::default(),
    };

    // 提取参数定义并转换为 inputs
    let inputs: HashMap<String, ParamDef> = start_node
        .data
        .parameters
        .as_ref()
        .map(|params| {
            params
                .iter()
                .map(|p| {
                    let param_def = if let Some(ref default) = p.default_value {
                        ParamDef::WithDefault {
                            type_name: p.param_type.clone(),
                            default: default.clone(),
                        }
                    } else {
                        ParamDef::Simple(p.param_type.clone())
                    };
                    (p.name.clone(), param_def)
                })
                .collect()
        })
        .unwrap_or_default();

    // 收集 Start 节点的所有出边目标作为 entry
    // 支持 Start 节点连接到多个下游节点
    let entry_nodes: Vec<String> = edges
        .iter()
        .filter(|e| e.source == start_node.id)
        .map(|e| e.target.clone())
        .collect();

    let entry = if entry_nodes.is_empty() {
        None
    } else {
        Some(entry_nodes)
    };

    // 转换输出定义：FrontendOutputDef[] -> OutputDef::Structured
    // 使用 get_outputs() 同时支持 out 和 outputs 两种命名
    let out = frontend_args
        .and_then(|args| args.get_outputs())
        .map(|out_defs| {
            let structured: HashMap<String, String> = out_defs
                .iter()
                .map(|def| (def.name.clone(), def.output_type.clone()))
                .collect();
            fdl_executor::types::OutputDef::Structured(structured)
        });

    FlowArgs {
        defs: HashMap::new(),
        inputs,
        out,
        entry,
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

/// 参数验证错误
#[derive(Debug, Clone)]
pub struct ValidationError {
    pub field: String,
    pub message: String,
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.field, self.message)
    }
}

/// 验证流程输入参数
///
/// 从 Start 节点提取参数定义，验证输入是否满足要求：
/// 1. 必填参数必须提供
/// 2. 应用默认值到缺失的可选参数
///
/// 返回验证后的输入（包含默认值）或验证错误列表
pub fn validate_inputs(
    frontend: &FrontendFlow,
    inputs: &serde_json::Value,
) -> Result<serde_json::Value, Vec<ValidationError>> {
    // 查找 Start 节点
    let start_node = frontend.nodes.iter().find(|n| n.data.node_type == "start");

    // 如果没有 Start 节点，直接返回原始输入（无需验证）
    let start_node = match start_node {
        Some(node) => node,
        None => return Ok(inputs.clone()),
    };

    // 获取参数定义
    let parameters = match &start_node.data.parameters {
        Some(params) => params,
        None => return Ok(inputs.clone()), // 没有参数定义，直接返回
    };

    // 如果没有定义参数，直接返回
    if parameters.is_empty() {
        return Ok(inputs.clone());
    }

    let mut errors = Vec::new();
    let mut validated_inputs = inputs.clone();

    // 确保 validated_inputs 是一个对象
    if !validated_inputs.is_object() {
        validated_inputs = serde_json::json!({});
    }

    let inputs_obj = validated_inputs.as_object_mut().unwrap();

    for param in parameters {
        let has_value =
            inputs_obj.contains_key(&param.name) && !inputs_obj.get(&param.name).unwrap().is_null();

        if !has_value {
            // 参数未提供
            if param.required {
                // 必填参数缺失
                errors.push(ValidationError {
                    field: param.name.clone(),
                    message: format!("参数 '{}' 为必填项", param.name),
                });
            } else if let Some(ref default_value) = param.default_value {
                // 可选参数有默认值，应用默认值
                let parsed_default = parse_default_value(default_value, &param.param_type);
                inputs_obj.insert(param.name.clone(), parsed_default);
            }
        }
    }

    if errors.is_empty() {
        Ok(validated_inputs)
    } else {
        Err(errors)
    }
}

/// 解析默认值字符串为对应类型的 JSON 值
fn parse_default_value(default: &str, param_type: &str) -> serde_json::Value {
    match param_type {
        "number" => default
            .parse::<f64>()
            .map(|n| serde_json::json!(n))
            .unwrap_or(serde_json::Value::Null),
        "boolean" => serde_json::json!(default == "true"),
        "object" | "array" => serde_json::from_str(default).unwrap_or(serde_json::Value::Null),
        _ => serde_json::Value::String(default.to_string()),
    }
}

/// 根据流程定义的 out/outputs 字段过滤输出结果
///
/// 如果流程定义了 args.out 或 args.outputs，则只返回指定的字段。
///
/// 查找策略（按优先级）：
/// 1. 优先从终止节点（merge, output, end, result 等）提取
/// 2. 如果没找到，再从其他节点中查找
///
/// 如果没有定义输出字段，返回原始输出。
pub fn filter_output_by_definition(
    frontend: &FrontendFlow,
    raw_outputs: &serde_json::Value,
) -> serde_json::Value {
    // 获取输出定义（支持 out 和 outputs 两种命名）
    let out_defs = match &frontend.args {
        Some(args) => match args.get_outputs() {
            Some(out) => out,
            None => return raw_outputs.clone(),
        },
        None => return raw_outputs.clone(),
    };

    // 如果没有定义输出字段，返回原始输出
    if out_defs.is_empty() {
        return raw_outputs.clone();
    }

    // 获取原始输出对象
    let raw_obj = match raw_outputs.as_object() {
        Some(obj) => obj,
        None => return raw_outputs.clone(),
    };

    // 查找终止节点（通常是最后执行的节点，用于聚合结果）
    // 优先级：显式的输出节点 > 没有 next 的节点 > 任意节点
    let terminal_node = find_terminal_node(frontend, raw_obj);

    // 构建过滤后的输出
    let mut filtered = serde_json::Map::new();

    for out_def in out_defs {
        let field_name = &out_def.name;
        let mut found_value: Option<serde_json::Value> = None;

        // 优先从终止节点提取
        if let Some(ref terminal) = terminal_node
            && let Some(node_value) = raw_obj.get(terminal)
            && let Some(node_obj) = node_value.as_object()
            && let Some(value) = node_obj.get(field_name)
        {
            found_value = Some(value.clone());
        }

        // 如果终止节点没有该字段，从其他节点查找
        if found_value.is_none() {
            for (node_id, node_value) in raw_obj {
                // 跳过系统变量
                if node_id == "tenantId" || node_id == "buCode" {
                    continue;
                }

                // 如果节点值是对象，检查是否包含目标字段
                if let Some(node_obj) = node_value.as_object()
                    && let Some(value) = node_obj.get(field_name)
                {
                    found_value = Some(value.clone());
                    break;
                }
            }
        }

        // 如果找到了值，添加到过滤结果
        if let Some(value) = found_value {
            filtered.insert(field_name.clone(), value);
        }
    }

    serde_json::Value::Object(filtered)
}

/// 查找终止节点
///
/// 终止节点是没有 next 的节点，通常是流程的最后一步，用于聚合和输出结果。
/// 查找策略：
/// 1. 查找名称包含 merge/output/end/result 的节点
/// 2. 查找没有 next 边的节点
fn find_terminal_node(
    frontend: &FrontendFlow,
    raw_obj: &serde_json::Map<String, serde_json::Value>,
) -> Option<String> {
    // 终止节点的常见名称关键字
    const TERMINAL_KEYWORDS: &[&str] = &["merge", "output", "end", "result", "final"];

    // 收集所有有 next 边的源节点
    let sources_with_next: std::collections::HashSet<&String> =
        frontend.edges.iter().map(|e| &e.source).collect();

    // 优先查找名称匹配的终止节点
    for keyword in TERMINAL_KEYWORDS {
        for node in &frontend.nodes {
            if node.id.to_lowercase().contains(keyword)
                && raw_obj.contains_key(&node.id)
                && !sources_with_next.contains(&node.id)
            {
                return Some(node.id.clone());
            }
        }
    }

    // 查找没有 next 边的节点（终止节点）
    for node in &frontend.nodes {
        // 跳过 start 节点
        if node.data.node_type == "start" {
            continue;
        }
        // 如果节点没有出边，且在输出中存在，则为终止节点
        if !sources_with_next.contains(&node.id) && raw_obj.contains_key(&node.id) {
            return Some(node.id.clone());
        }
    }

    None
}

/// 获取流程的输出定义字段名列表
pub fn get_output_field_names(frontend: &FrontendFlow) -> Option<Vec<String>> {
    frontend.args.as_ref().and_then(|args| {
        args.get_outputs()
            .map(|out| out.iter().map(|def| def.name.clone()).collect())
    })
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
                    ..Default::default()
                },
            }],
            edges: vec![],
            vars: None,
            args: None,
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
                        ..Default::default()
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
                        ..Default::default()
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
            args: None,
        };

        let flow = convert_frontend_to_executor(&frontend);

        let node_a = flow.nodes.get("a").unwrap();
        assert_eq!(node_a.next, Some("b".to_string()));
    }
}
