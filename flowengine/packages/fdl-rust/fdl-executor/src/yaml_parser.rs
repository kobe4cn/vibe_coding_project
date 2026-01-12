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
    /// 入口节点列表：Start 节点连接的目标节点 ID
    /// 如果未指定，将自动检测无入边的节点作为入口
    #[serde(default)]
    pub entry: Option<Vec<String>>,
}

/// YAML 参数定义（支持简单类型或带默认值）
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum YamlParamDef {
    /// 简单类型：`name: string`
    Simple(String),
    /// 带默认值：`{ type: string, default: 'value' }`
    WithDefault { r#type: String, default: String },
}

/// YAML 输出字段
#[derive(Debug, Clone, Deserialize)]
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
    /// Guard 配置
    #[serde(default)]
    pub guard: Option<String>,
    /// Approval 配置
    #[serde(default)]
    pub approval: Option<String>,
    /// Handoff 目标
    #[serde(default)]
    pub handoff: Option<String>,
    /// OSS URI（对象存储）
    #[serde(default)]
    pub oss: Option<String>,
    /// MQ URI（消息队列）
    #[serde(default)]
    pub mq: Option<String>,
    /// Mail 配置
    #[serde(default)]
    pub mail: Option<String>,
    /// SMS 配置
    #[serde(default)]
    pub sms: Option<String>,
    /// Service URI（微服务调用）
    #[serde(default)]
    pub service: Option<String>,
    /// 节点类型（前端显式指定）
    #[serde(rename = "nodeType", default)]
    pub node_type_str: Option<String>,
}

/// 解析 YAML 字符串为 Flow 结构
pub fn parse_yaml(yaml_str: &str) -> ExecutorResult<Flow> {
    let doc: YamlDocument = serde_yaml::from_str(yaml_str)
        .map_err(|e| ExecutorError::InvalidFlow(format!("YAML parse error: {}", e)))?;

    convert_yaml_to_flow(doc.flow)
}

/// 将 YAML 流程转换为内部 Flow 结构
///
/// 转换过程：
/// 1. 转换元数据和参数定义
/// 2. 转换所有节点
/// 3. 创建虚拟 Start 节点（从 args.in 生成参数定义）
/// 4. 确定入口节点（从 args.entry 或自动检测）
fn convert_yaml_to_flow(yaml: YamlFlow) -> ExecutorResult<Flow> {
    // 转换元数据
    let meta = FlowMeta {
        name: yaml.name,
        description: yaml.desp,
    };

    // 转换节点（先转换，用于后续入口检测）
    let mut nodes: HashMap<String, FlowNode> = yaml
        .node
        .into_iter()
        .map(|(k, v)| (k, convert_yaml_node(v)))
        .collect();

    // 转换参数
    let args = if let Some(yaml_args) = &yaml.args {
        // 确定入口节点
        let entry_nodes = if let Some(ref entry) = yaml_args.entry {
            // 使用显式指定的入口节点
            Some(entry.clone())
        } else {
            // 自动检测：找出所有无入边的节点
            let targets: std::collections::HashSet<&str> = nodes
                .values()
                .filter_map(|n| n.next.as_deref())
                .chain(nodes.values().filter_map(|n| n.then.as_deref()))
                .chain(nodes.values().filter_map(|n| n.else_branch.as_deref()))
                .chain(nodes.values().filter_map(|n| n.fail.as_deref()))
                .collect();

            let entry_ids: Vec<String> = nodes
                .keys()
                .filter(|id| !targets.contains(id.as_str()))
                .cloned()
                .collect();

            if entry_ids.is_empty() {
                None
            } else {
                Some(entry_ids)
            }
        };

        FlowArgs {
            defs: HashMap::new(),
            inputs: yaml_args
                .inputs
                .iter()
                .map(|(k, v)| (k.clone(), convert_param_def(v.clone())))
                .collect(),
            out: yaml_args
                .out
                .as_ref()
                .map(|o| convert_output_def(o.clone())),
            entry: entry_nodes,
        }
    } else {
        FlowArgs::default()
    };

    // 如果有输入参数，创建虚拟 Start 节点
    if !args.inputs.is_empty() || args.entry.is_some() {
        let start_node_id = "__start__".to_string();

        // 从 args.inputs 生成 Start 节点的参数定义
        let parameters: Vec<crate::types::InputParamDef> = args
            .inputs
            .iter()
            .map(|(name, param_def)| {
                let (param_type, default_value) = match param_def {
                    ParamDef::Simple(t) => (t.clone(), None),
                    ParamDef::WithDefault { type_name, default } => {
                        (type_name.clone(), Some(default.clone()))
                    }
                };
                crate::types::InputParamDef {
                    name: name.clone(),
                    param_type,
                    required: default_value.is_none(),
                    default_value,
                    description: None,
                }
            })
            .collect();

        // Start 节点的 next 字段连接到所有入口节点
        // 使用逗号分隔多个入口节点，调度器会解析并并行执行
        let next = args.entry.as_ref().map(|entries| entries.join(", "));

        let start_node = FlowNode {
            name: Some("开始".to_string()),
            node_type_str: Some("start".to_string()),
            parameters: if parameters.is_empty() {
                None
            } else {
                Some(parameters)
            },
            next,
            ..Default::default()
        };

        nodes.insert(start_node_id, start_node);
    }

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
    let map: HashMap<String, String> = fields.into_iter().map(|f| (f.name, f.r#type)).collect();
    OutputDef::Structured(map)
}

/// 转换 YAML 节点为 FlowNode
///
/// 支持两种工具调用语法：
/// 1. 专用字段语法：`oss: oss://bucket/path`、`mq: mq://topic/queue` 等
/// 2. exec 统一语法：`exec: oss://bucket/path`（自动识别 URI 前缀并填充对应字段）
fn convert_yaml_node(yaml: YamlNode) -> FlowNode {
    // 检测 exec URI 前缀，自动填充对应的专用字段
    // 这样可以兼容两种写法：exec: oss://... 和 oss: oss://...
    let (oss, mq, mail, sms, service, node_type_str) = detect_tool_type_from_exec(&yaml);

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
        guard: yaml.guard,
        approval: yaml.approval,
        handoff: yaml.handoff,
        oss,
        mq,
        mail,
        sms,
        service,
        parameters: None,
        node_type_str,
    }
}

/// 工具类型检测结果
/// 包含各种工具类型的 URI（oss、mq、mail、sms、service）和节点类型字符串
type ToolTypeDetectionResult = (
    Option<String>, // oss
    Option<String>, // mq
    Option<String>, // mail
    Option<String>, // sms
    Option<String>, // service
    Option<String>, // node_type_str
);

/// 从 exec URI 前缀检测工具类型，返回填充的专用字段
///
/// 如果 YAML 中已显式设置了专用字段（如 oss:），则优先使用
/// 否则从 exec 字段的 URI 前缀推断
fn detect_tool_type_from_exec(yaml: &YamlNode) -> ToolTypeDetectionResult {
    // 如果已显式设置专用字段，优先使用
    if yaml.oss.is_some() {
        return (
            yaml.oss.clone(),
            yaml.mq.clone(),
            yaml.mail.clone(),
            yaml.sms.clone(),
            yaml.service.clone(),
            yaml.node_type_str.clone().or(Some("oss".to_string())),
        );
    }
    if yaml.mq.is_some() {
        return (
            yaml.oss.clone(),
            yaml.mq.clone(),
            yaml.mail.clone(),
            yaml.sms.clone(),
            yaml.service.clone(),
            yaml.node_type_str.clone().or(Some("mq".to_string())),
        );
    }
    if yaml.mail.is_some() {
        return (
            yaml.oss.clone(),
            yaml.mq.clone(),
            yaml.mail.clone(),
            yaml.sms.clone(),
            yaml.service.clone(),
            yaml.node_type_str.clone().or(Some("mail".to_string())),
        );
    }
    if yaml.sms.is_some() {
        return (
            yaml.oss.clone(),
            yaml.mq.clone(),
            yaml.mail.clone(),
            yaml.sms.clone(),
            yaml.service.clone(),
            yaml.node_type_str.clone().or(Some("sms".to_string())),
        );
    }
    if yaml.service.is_some() {
        return (
            yaml.oss.clone(),
            yaml.mq.clone(),
            yaml.mail.clone(),
            yaml.sms.clone(),
            yaml.service.clone(),
            yaml.node_type_str.clone().or(Some("service".to_string())),
        );
    }

    // 如果没有显式设置，从 exec 字段检测
    if let Some(ref exec_uri) = yaml.exec {
        let lower = exec_uri.to_lowercase();
        if lower.starts_with("oss://") {
            return (
                Some(exec_uri.clone()),
                None,
                None,
                None,
                None,
                yaml.node_type_str.clone().or(Some("oss".to_string())),
            );
        }
        if lower.starts_with("mq://") {
            return (
                None,
                Some(exec_uri.clone()),
                None,
                None,
                None,
                yaml.node_type_str.clone().or(Some("mq".to_string())),
            );
        }
        if lower.starts_with("mail://") {
            return (
                None,
                None,
                Some(exec_uri.clone()),
                None,
                None,
                yaml.node_type_str.clone().or(Some("mail".to_string())),
            );
        }
        if lower.starts_with("sms://") {
            return (
                None,
                None,
                None,
                Some(exec_uri.clone()),
                None,
                yaml.node_type_str.clone().or(Some("sms".to_string())),
            );
        }
        if lower.starts_with("svc://") {
            return (
                None,
                None,
                None,
                None,
                Some(exec_uri.clone()),
                yaml.node_type_str.clone().or(Some("service".to_string())),
            );
        }
    }

    // 没有检测到特殊工具类型，保持原样
    (
        yaml.oss.clone(),
        yaml.mq.clone(),
        yaml.mail.clone(),
        yaml.sms.clone(),
        yaml.service.clone(),
        yaml.node_type_str.clone(),
    )
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

        // 验证节点（3 个业务节点 + 1 个虚拟 Start 节点）
        assert_eq!(flow.nodes.len(), 4);
        assert!(flow.nodes.contains_key("customer"));
        assert!(flow.nodes.contains_key("merge"));
        assert!(flow.nodes.contains_key("orderCount"));
        assert!(flow.nodes.contains_key("__start__"));

        // 验证虚拟 Start 节点
        let start = flow.nodes.get("__start__").unwrap();
        assert_eq!(start.node_type(), crate::types::NodeType::Start);
        assert!(start.parameters.is_some());
        // Start 节点连接到入口节点
        assert!(start.next.is_some());

        // 验证 customer 节点
        let customer = flow.nodes.get("customer").unwrap();
        assert_eq!(
            customer.exec,
            Some("api://crm-service/customer".to_string())
        );
        assert_eq!(customer.next, Some("merge".to_string()));

        // 验证 merge 节点
        let merge = flow.nodes.get("merge").unwrap();
        assert!(merge.with_expr.is_some());

        // 验证 orderCount 节点
        let order_count = flow.nodes.get("orderCount").unwrap();
        assert_eq!(
            order_count.exec,
            Some("db://ec.mysql.order/count".to_string())
        );
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
        assert!(
            value.get("tenantId").is_none(),
            "tenantId should be filtered"
        );
        assert!(value.get("buCode").is_none(), "buCode should be filtered");

        // 验证 customer 节点被执行
        assert!(
            value.get("customer").is_some(),
            "customer node should be executed"
        );

        // 验证 orderCount 节点被执行
        assert!(
            value.get("orderCount").is_some(),
            "orderCount node should be executed"
        );

        // 验证 merge 节点被执行
        assert!(
            value.get("merge").is_some(),
            "merge node should be executed"
        );

        // 验证 merge 节点正确展开了 customer 的结果
        let merge = value.get("merge").unwrap();
        assert!(
            merge.get("success").is_some(),
            "merge should have spread customer's success field"
        );
        assert!(
            merge.get("orders").is_some(),
            "merge should have orders field"
        );
    }

    #[tokio::test]
    async fn test_output_filtering_with_args_out() {
        // 测试执行器返回完整的节点结果（args.out 过滤由 runtime 层处理）
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

        println!("Executor output: {:?}", result);

        // 执行器现在返回完整的节点结果，args.out 过滤由 runtime 层处理
        // 这样可以保留完整的节点结果用于调试
        let compute = result.get("compute");
        assert!(compute.is_some(), "compute node should be in output");

        // 节点结果应该包含所有字段
        let compute = compute.unwrap();
        assert!(
            compute.get("result").is_some(),
            "result should be in compute output"
        );
        assert!(
            compute.get("message").is_some(),
            "message should be in compute output"
        );
        assert!(
            compute.get("extra").is_some(),
            "extra should be in compute output (runtime will filter)"
        );
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

    #[test]
    fn test_exec_uri_to_specialized_fields() {
        // 测试 exec URI 前缀自动填充到专用字段
        let yaml = r#"
flow:
    name: 工具类型检测测试
    node:
        fetchAvatar:
            name: 获取头像
            exec: oss://customer-assets/avatars/test.jpg
            args: operation = 'presign'
        sendMessage:
            name: 发送消息
            exec: mq://orders/new-order
        callService:
            name: 调用服务
            exec: svc://user-service/getUser
        sendEmail:
            name: 发送邮件
            exec: mail://smtp/send
        sendSms:
            name: 发送短信
            exec: sms://aliyun/send
        normalExec:
            name: 普通调用
            exec: api://crm/customer
"#;
        let flow = parse_yaml(yaml).unwrap();

        // 验证 OSS 节点
        let oss_node = flow.nodes.get("fetchAvatar").unwrap();
        assert_eq!(oss_node.node_type(), crate::types::NodeType::Oss);
        assert!(
            oss_node.oss.is_some(),
            "OSS field should be filled from exec"
        );
        assert_eq!(
            oss_node.oss.as_ref().unwrap(),
            "oss://customer-assets/avatars/test.jpg"
        );

        // 验证 MQ 节点
        let mq_node = flow.nodes.get("sendMessage").unwrap();
        assert_eq!(mq_node.node_type(), crate::types::NodeType::Mq);
        assert!(mq_node.mq.is_some(), "MQ field should be filled from exec");

        // 验证 Service 节点
        let svc_node = flow.nodes.get("callService").unwrap();
        assert_eq!(svc_node.node_type(), crate::types::NodeType::Service);
        assert!(
            svc_node.service.is_some(),
            "Service field should be filled from exec"
        );

        // 验证 Mail 节点
        let mail_node = flow.nodes.get("sendEmail").unwrap();
        assert_eq!(mail_node.node_type(), crate::types::NodeType::Mail);
        assert!(
            mail_node.mail.is_some(),
            "Mail field should be filled from exec"
        );

        // 验证 SMS 节点
        let sms_node = flow.nodes.get("sendSms").unwrap();
        assert_eq!(sms_node.node_type(), crate::types::NodeType::Sms);
        assert!(
            sms_node.sms.is_some(),
            "SMS field should be filled from exec"
        );

        // 验证普通 exec 节点不受影响
        let exec_node = flow.nodes.get("normalExec").unwrap();
        assert_eq!(exec_node.node_type(), crate::types::NodeType::Exec);
        assert!(exec_node.oss.is_none());
        assert!(exec_node.mq.is_none());
    }
}
