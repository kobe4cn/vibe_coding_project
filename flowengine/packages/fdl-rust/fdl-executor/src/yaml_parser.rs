//! YAML 流程解析器
//!
//! 支持标准 FDL YAML 格式的解析，将其转换为内部 Flow 结构。
//!
//! 标准 FDL YAML 格式：
//! ```yaml
//! flow:
//!     name: 流程名称
//!     desp: 流程描述
//!     args:
//!         in:
//!             param1: type
//!         out:
//!             - name: field1
//!               type: string
//!     node:
//!         step1:
//!             name: 步骤名称
//!             exec: api://...
//! ```

use crate::error::{ExecutorError, ExecutorResult};
use crate::types::{Flow, FlowArgs, FlowMeta, FlowNode, OutputDef, ParamDef};
use serde::Deserialize;
use std::collections::HashMap;

/// 标准 FDL YAML 格式的顶层结构
#[derive(Debug, Deserialize)]
pub struct YamlDocument {
    pub flow: YamlFlow,
}

/// YAML 流程定义
#[derive(Debug, Deserialize)]
pub struct YamlFlow {
    /// 流程名称
    pub name: String,
    /// 流程描述
    #[serde(default)]
    pub desp: Option<String>,
    /// 参数定义
    #[serde(default)]
    pub args: Option<YamlArgs>,
    /// 全局变量
    #[serde(default)]
    pub vars: Option<HashMap<String, String>>,
    /// 节点定义（注意：使用 node 而不是 nodes）
    #[serde(default)]
    pub node: HashMap<String, YamlNode>,
}

/// YAML 参数定义
#[derive(Debug, Deserialize, Default)]
pub struct YamlArgs {
    /// 输入参数
    #[serde(rename = "in", default)]
    pub inputs: HashMap<String, YamlParamDef>,
    /// 输出参数
    #[serde(default)]
    pub out: Option<Vec<YamlOutputField>>,
}

/// YAML 参数定义（支持简单类型或带默认值）
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum YamlParamDef {
    /// 简单类型：`name: string`
    Simple(String),
    /// 带默认值：`{ type: string, default: 'value' }`
    WithDefault { r#type: String, default: String },
}

/// YAML 输出字段
#[derive(Debug, Deserialize)]
pub struct YamlOutputField {
    pub name: String,
    pub r#type: String,
}

/// YAML 节点定义
#[derive(Debug, Deserialize, Default)]
pub struct YamlNode {
    /// 节点显示名称
    #[serde(default)]
    pub name: Option<String>,
    /// 节点描述
    #[serde(default)]
    pub description: Option<String>,
    /// 下一个节点
    #[serde(default)]
    pub next: Option<String>,
    /// 错误处理节点
    #[serde(default)]
    pub fail: Option<String>,
    /// 条件执行
    #[serde(default)]
    pub only: Option<String>,
    /// 工具执行 URI
    #[serde(default)]
    pub exec: Option<String>,
    /// 工具参数（GML）
    #[serde(default)]
    pub args: Option<String>,
    /// 数据映射表达式（GML）
    #[serde(rename = "with", default)]
    pub with_expr: Option<String>,
    /// 变量更新（GML）
    #[serde(default)]
    pub sets: Option<String>,
    /// 条件表达式
    #[serde(default)]
    pub when: Option<String>,
    /// 条件为真时的分支
    #[serde(default)]
    pub then: Option<String>,
    /// 条件为假时的分支
    #[serde(rename = "else", default)]
    pub else_branch: Option<String>,
    /// 延迟时间
    #[serde(default)]
    pub wait: Option<String>,
    /// 循环变量
    #[serde(default)]
    pub vars: Option<String>,
    /// 迭代源
    #[serde(default)]
    pub each: Option<String>,
    /// 子节点
    #[serde(default)]
    pub node: Option<HashMap<String, YamlNode>>,
    /// Agent URI
    #[serde(default)]
    pub agent: Option<String>,
    /// MCP URI
    #[serde(default)]
    pub mcp: Option<String>,
}

/// 解析 YAML 字符串为 Flow 结构
pub fn parse_yaml(yaml_str: &str) -> ExecutorResult<Flow> {
    let doc: YamlDocument = serde_yaml::from_str(yaml_str).map_err(|e| {
        ExecutorError::InvalidFlow(format!("YAML parse error: {}", e))
    })?;

    convert_yaml_to_flow(doc.flow)
}

/// 将 YAML 流程转换为内部 Flow 结构
fn convert_yaml_to_flow(yaml: YamlFlow) -> ExecutorResult<Flow> {
    // 转换元数据
    let meta = FlowMeta {
        name: yaml.name,
        description: yaml.desp,
    };

    // 转换参数
    let args = if let Some(yaml_args) = yaml.args {
        FlowArgs {
            defs: HashMap::new(),
            inputs: yaml_args
                .inputs
                .into_iter()
                .map(|(k, v)| (k, convert_param_def(v)))
                .collect(),
            out: yaml_args.out.map(convert_output_def),
        }
    } else {
        FlowArgs::default()
    };

    // 转换节点
    let nodes = yaml
        .node
        .into_iter()
        .map(|(k, v)| (k, convert_yaml_node(v)))
        .collect();

    Ok(Flow {
        meta,
        args,
        vars: yaml.vars.unwrap_or_default(),
        nodes,
    })
}

/// 转换参数定义
fn convert_param_def(yaml: YamlParamDef) -> ParamDef {
    match yaml {
        YamlParamDef::Simple(s) => ParamDef::Simple(s),
        YamlParamDef::WithDefault { r#type, default } => ParamDef::WithDefault {
            type_name: r#type,
            default,
        },
    }
}

/// 转换输出定义
fn convert_output_def(fields: Vec<YamlOutputField>) -> OutputDef {
    let map: HashMap<String, String> = fields
        .into_iter()
        .map(|f| (f.name, f.r#type))
        .collect();
    OutputDef::Structured(map)
}

/// 转换 YAML 节点为 FlowNode
fn convert_yaml_node(yaml: YamlNode) -> FlowNode {
    FlowNode {
        name: yaml.name,
        description: yaml.description,
        next: yaml.next,
        fail: yaml.fail,
        only: yaml.only,
        exec: yaml.exec,
        args: yaml.args,
        with_expr: yaml.with_expr,
        sets: yaml.sets,
        when: yaml.when,
        then: yaml.then,
        else_branch: yaml.else_branch,
        case: None, // YAML 格式中暂不支持 case
        wait: yaml.wait,
        vars: yaml.vars,
        each: yaml.each,
        node: yaml.node.map(|nodes| {
            nodes
                .into_iter()
                .map(|(k, v)| (k, convert_yaml_node(v)))
                .collect()
        }),
        agent: yaml.agent,
        mcp: yaml.mcp,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Executor;

    #[test]
    fn test_parse_simple_yaml() {
        let yaml = r#"
flow:
    name: 测试流程
    desp: 这是一个测试
    node:
        step1:
            name: 第一步
            with: result = 1 + 2
"#;
        let flow = parse_yaml(yaml).unwrap();
        assert_eq!(flow.meta.name, "测试流程");
        assert_eq!(flow.meta.description, Some("这是一个测试".to_string()));
        assert!(flow.nodes.contains_key("step1"));
    }

    #[test]
    fn test_parse_customer_view_flow() {
        let yaml = r#"
flow:
    name: 客户视图构建流程
    desp: 根据客户标识、订单起始时间，获取指定客户的姓名和订单数量。
    args:
        in:
            customerId: string
            from: DATE('-3M')
        out:
            - name: id
              type: string
            - name: name
              type: string
            - name: orders
              type: int
    node:
        customer:
            name: 获取客户基本信息
            exec: api://crm-service/customer
            next: merge
        merge:
            name: 合并客户视图
            with: |
                ...customer
                orders = orderCount
        orderCount:
            name: 获取客户订单数量
            exec: db://ec.mysql.order/count
            args: exps = `customerId = ${customerId} && time > '${from}'`
            next: merge
"#;
        let flow = parse_yaml(yaml).unwrap();

        // 验证元数据
        assert_eq!(flow.meta.name, "客户视图构建流程");
        assert!(flow.meta.description.is_some());

        // 验证参数
        assert!(flow.args.inputs.contains_key("customerId"));
        assert!(flow.args.inputs.contains_key("from"));
        assert!(flow.args.out.is_some());

        // 验证节点
        assert_eq!(flow.nodes.len(), 3);
        assert!(flow.nodes.contains_key("customer"));
        assert!(flow.nodes.contains_key("merge"));
        assert!(flow.nodes.contains_key("orderCount"));

        // 验证 customer 节点
        let customer = flow.nodes.get("customer").unwrap();
        assert_eq!(customer.exec, Some("api://crm-service/customer".to_string()));
        assert_eq!(customer.next, Some("merge".to_string()));

        // 验证 merge 节点
        let merge = flow.nodes.get("merge").unwrap();
        assert!(merge.with_expr.is_some());

        // 验证 orderCount 节点
        let order_count = flow.nodes.get("orderCount").unwrap();
        assert_eq!(order_count.exec, Some("db://ec.mysql.order/count".to_string()));
        assert!(order_count.args.is_some());
    }

    #[test]
    fn test_parse_exec_node() {
        let yaml = r#"
flow:
    name: API 调用测试
    node:
        call_api:
            name: 调用 API
            exec: api://test/endpoint
            args: param = 'value'
"#;
        let flow = parse_yaml(yaml).unwrap();
        let node = flow.nodes.get("call_api").unwrap();
        assert_eq!(node.node_type(), crate::types::NodeType::Exec);
    }

    #[test]
    fn test_parse_mapping_node() {
        let yaml = r#"
flow:
    name: 映射测试
    node:
        map:
            name: 数据映射
            with: result = input.value * 2
"#;
        let flow = parse_yaml(yaml).unwrap();
        let node = flow.nodes.get("map").unwrap();
        assert_eq!(node.node_type(), crate::types::NodeType::Mapping);
    }

    #[tokio::test]
    async fn test_execute_customer_view_flow() {
        // 测试不带 args.out 的流程（查看完整输出）
        let yaml = r#"
flow:
    name: 客户视图构建流程
    desp: 根据客户标识、订单起始时间，获取指定客户的姓名和订单数量。
    args:
        in:
            customerId: string
            from: DATE('-3M')
    node:
        customer:
            name: 获取客户基本信息
            exec: api://crm-service/customer
            next: merge
        merge:
            name: 合并客户视图
            with: |
                ...customer
                orders = orderCount
        orderCount:
            name: 获取客户订单数量
            exec: db://ec.mysql.order/count
            args: exps = `customerId = ${customerId} && time > '${from}'`
            next: merge
"#;
        let flow = parse_yaml(yaml).unwrap();

        let executor = Executor::new();
        let inputs = fdl_gml::Value::object([
            ("customerId", fdl_gml::Value::string("C001")),
            ("from", fdl_gml::Value::string("2024-01-01")),
        ]);

        let result = executor.execute(&flow, inputs).await;

        // 打印结果以便调试
        match &result {
            Ok(value) => {
                println!("Execution result: {:?}", value);
            }
            Err(e) => {
                println!("Execution error: {:?}", e);
            }
        }

        assert!(result.is_ok(), "Flow execution should succeed");

        let value = result.unwrap();

        // 验证系统变量已被过滤
        assert!(value.get("tenantId").is_none(), "tenantId should be filtered");
        assert!(value.get("buCode").is_none(), "buCode should be filtered");

        // 验证 customer 节点被执行
        assert!(value.get("customer").is_some(), "customer node should be executed");

        // 验证 orderCount 节点被执行
        assert!(value.get("orderCount").is_some(), "orderCount node should be executed");

        // 验证 merge 节点被执行
        assert!(value.get("merge").is_some(), "merge node should be executed");

        // 验证 merge 节点正确展开了 customer 的结果
        let merge = value.get("merge").unwrap();
        assert!(merge.get("success").is_some(), "merge should have spread customer's success field");
        assert!(merge.get("orders").is_some(), "merge should have orders field");
    }

    #[tokio::test]
    async fn test_output_filtering_with_args_out() {
        // 测试带 args.out 的流程（输出过滤）
        let yaml = r#"
flow:
    name: 输出过滤测试
    args:
        out:
            - name: result
              type: int
            - name: message
              type: string
    node:
        compute:
            name: 计算
            with: |
                result = 42
                message = 'Hello'
                extra = 'should be filtered'
"#;
        let flow = parse_yaml(yaml).unwrap();
        let executor = Executor::new();
        let result = executor.execute(&flow, fdl_gml::Value::Null).await.unwrap();

        println!("Filtered output: {:?}", result);

        // 验证只有定义的输出字段
        assert!(result.get("result").is_some(), "result should be in output");
        assert!(result.get("message").is_some(), "message should be in output");
        // extra 字段应该被过滤掉
        assert!(result.get("extra").is_none(), "extra should be filtered out");
        // compute 节点也应该被过滤掉
        assert!(result.get("compute").is_none(), "compute node should be filtered out");
    }

    #[tokio::test]
    async fn test_spread_operator_in_mapping() {
        // 测试展开运算符是否正常工作
        let yaml = r#"
flow:
    name: 展开运算符测试
    node:
        data:
            name: 准备数据
            with: |
                name = 'Alice'
                age = 30
            next: merge
        merge:
            name: 合并数据
            with: |
                ...data
                extra = 'value'
"#;
        let flow = parse_yaml(yaml).unwrap();
        let executor = Executor::new();
        let result = executor.execute(&flow, fdl_gml::Value::Null).await;

        println!("Spread test result: {:?}", result);

        // 检查执行结果
        if let Ok(value) = &result {
            let merge = value.get("merge");
            println!("Merge node output: {:?}", merge);
        }
    }
}
