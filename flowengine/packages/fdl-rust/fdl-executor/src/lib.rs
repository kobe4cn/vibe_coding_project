//! # FDL-Executor
//!
//! FDL (Flow Definition Language) core execution engine.
//!
//! ## Features
//!
//! - Parallel execution of independent nodes
//! - Sequential execution via `next` dependencies
//! - Condition and switch node support
//! - Loop and each node support
//! - Sub-flow execution
//! - State persistence and recovery

pub mod context;
pub mod error;
pub mod nodes;
pub mod persistence;
pub mod scheduler;
pub mod types;
pub mod yaml_parser;

pub use context::ExecutionContext;
pub use error::{ExecutorError, ExecutorResult};
pub use persistence::{
    ExecutionSnapshot, ExecutionStatus, InMemoryPersistence, NodeExecutionRecord, NodeStatus,
    PersistenceBackend, PersistenceConfig, PersistenceManager, RecoveryService,
};
pub use scheduler::Scheduler;
pub use types::{Flow, FlowNode, NodeType};

use fdl_gml::Value;
use fdl_tools::{ManagedToolRegistry, ToolContext, ToolRegistry};
use std::sync::Arc;
use tokio::sync::RwLock;

/// 系统变量列表（在输出时过滤）
const SYSTEM_VARS: &[&str] = &["buCode", "tenantId"];

/// Flow executor
pub struct Executor {
    context: Arc<RwLock<ExecutionContext>>,
    scheduler: Scheduler,
    tool_registry: Option<Arc<ToolRegistry>>,
    managed_registry: Option<Arc<ManagedToolRegistry>>,
    tool_context: ToolContext,
}

impl Executor {
    /// Create a new executor
    pub fn new() -> Self {
        Self {
            context: Arc::new(RwLock::new(ExecutionContext::new())),
            scheduler: Scheduler::new(),
            tool_registry: None,
            managed_registry: None,
            tool_context: ToolContext::default(),
        }
    }

    /// Create executor with simple tool registry
    pub fn with_registry(registry: ToolRegistry) -> Self {
        Self {
            context: Arc::new(RwLock::new(ExecutionContext::new())),
            scheduler: Scheduler::new(),
            tool_registry: Some(Arc::new(registry)),
            managed_registry: None,
            tool_context: ToolContext::default(),
        }
    }

    /// Create executor with managed tool registry (uses ConfigStore)
    pub fn with_managed_registry(registry: Arc<ManagedToolRegistry>) -> Self {
        Self {
            context: Arc::new(RwLock::new(ExecutionContext::new())),
            scheduler: Scheduler::new(),
            tool_registry: None,
            managed_registry: Some(registry),
            tool_context: ToolContext::default(),
        }
    }

    /// Set tool context (tenant_id, bu_code, etc.)
    pub fn with_tool_context(mut self, context: ToolContext) -> Self {
        self.tool_context = context;
        self
    }

    /// Execute a flow
    pub async fn execute(&self, flow: &Flow, inputs: Value) -> ExecutorResult<Value> {
        // Initialize context with inputs and tool registry
        {
            let mut ctx = self.context.write().await;
            ctx.set_inputs(inputs);
            if let Some(registry) = &self.tool_registry {
                ctx.set_tool_registry(registry.clone());
            }
            if let Some(registry) = &self.managed_registry {
                ctx.set_managed_registry(registry.clone());
            }
            ctx.set_tool_context(self.tool_context.clone());
        }

        // Build execution graph and run
        let result = self.scheduler.execute(flow, self.context.clone()).await?;

        // Filter output based on args.out and remove system variables
        Ok(self.filter_output(&flow.args, result))
    }

    /// 过滤输出：只移除系统变量 (buCode, tenantId)
    ///
    /// 注意：args.out 的过滤由 runtime 层处理，以便保留完整的节点结果用于调试
    fn filter_output(&self, _args: &types::FlowArgs, output: Value) -> Value {
        let mut result = output;

        // 移除系统变量
        if let Value::Object(ref mut obj) = result {
            for var in SYSTEM_VARS {
                obj.remove(*var);
            }
        }

        // 不再在这里过滤 args.out，保留完整节点结果
        // runtime 层会根据 args.out 过滤最终的 outputs 字段
        result
    }

    /// Get the current execution context
    pub fn context(&self) -> Arc<RwLock<ExecutionContext>> {
        self.context.clone()
    }

    /// Get the simple tool registry
    pub fn tool_registry(&self) -> Option<Arc<ToolRegistry>> {
        self.tool_registry.clone()
    }

    /// Get the managed tool registry
    pub fn managed_registry(&self) -> Option<Arc<ManagedToolRegistry>> {
        self.managed_registry.clone()
    }
}

impl Default for Executor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use types::{CaseBranch, Flow, FlowArgs, FlowMeta, FlowNode};

    fn create_flow(nodes: Vec<(&str, FlowNode)>) -> Flow {
        Flow {
            meta: FlowMeta {
                name: "test".to_string(),
                description: None,
            },
            args: FlowArgs::default(),
            vars: HashMap::new(),
            nodes: nodes.into_iter().map(|(k, v)| (k.to_string(), v)).collect(),
        }
    }

    #[tokio::test]
    async fn test_executor_creation() {
        let executor = Executor::new();
        let ctx = executor.context.read().await;
        assert!(ctx.variables().is_empty());
    }

    #[tokio::test]
    async fn test_simple_mapping_flow() {
        // GML uses assignment syntax: "result = 1 + 2" not "{ result: 1 + 2 }"
        let flow = create_flow(vec![(
            "compute",
            FlowNode {
                with_expr: Some("result = 1 + 2".to_string()),
                ..Default::default()
            },
        )]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        let compute = result.get("compute").unwrap();
        assert_eq!(compute.get("result"), Some(&Value::Int(3)));
    }

    #[tokio::test]
    async fn test_linear_flow_with_chained_nodes() {
        let flow = create_flow(vec![
            (
                "step1",
                FlowNode {
                    with_expr: Some("a = 10".to_string()),
                    next: Some("step2".to_string()),
                    ..Default::default()
                },
            ),
            (
                "step2",
                FlowNode {
                    with_expr: Some("b = step1.a * 2".to_string()),
                    next: Some("step3".to_string()),
                    ..Default::default()
                },
            ),
            (
                "step3",
                FlowNode {
                    with_expr: Some("c = step2.b + 5".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("step1").and_then(|v| v.get("a")),
            Some(&Value::Int(10))
        );
        assert_eq!(
            result.get("step2").and_then(|v| v.get("b")),
            Some(&Value::Int(20))
        );
        assert_eq!(
            result.get("step3").and_then(|v| v.get("c")),
            Some(&Value::Int(25))
        );
    }

    #[tokio::test]
    async fn test_condition_node_true_branch() {
        let flow = create_flow(vec![
            (
                "check",
                FlowNode {
                    when: Some("true".to_string()),
                    then: Some("yes".to_string()),
                    else_branch: Some("no".to_string()),
                    ..Default::default()
                },
            ),
            (
                "yes",
                FlowNode {
                    with_expr: Some("answer = 'correct'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "no",
                FlowNode {
                    with_expr: Some("answer = 'wrong'".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("yes").and_then(|v| v.get("answer")),
            Some(&Value::String("correct".to_string()))
        );
        // "no" node should not be executed
        assert!(result.get("no").is_none());
    }

    #[tokio::test]
    async fn test_condition_node_false_branch() {
        let flow = create_flow(vec![
            (
                "check",
                FlowNode {
                    when: Some("1 > 5".to_string()),
                    then: Some("yes".to_string()),
                    else_branch: Some("no".to_string()),
                    ..Default::default()
                },
            ),
            (
                "yes",
                FlowNode {
                    with_expr: Some("answer = 'correct'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "no",
                FlowNode {
                    with_expr: Some("answer = 'wrong'".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("no").and_then(|v| v.get("answer")),
            Some(&Value::String("wrong".to_string()))
        );
        assert!(result.get("yes").is_none());
    }

    #[tokio::test]
    async fn test_switch_node() {
        let flow = create_flow(vec![
            (
                "setup",
                FlowNode {
                    with_expr: Some("value = 2".to_string()),
                    next: Some("route".to_string()),
                    ..Default::default()
                },
            ),
            (
                "route",
                FlowNode {
                    case: Some(vec![
                        CaseBranch {
                            when: "setup.value == 1".to_string(),
                            then: "case1".to_string(),
                        },
                        CaseBranch {
                            when: "setup.value == 2".to_string(),
                            then: "case2".to_string(),
                        },
                        CaseBranch {
                            when: "setup.value == 3".to_string(),
                            then: "case3".to_string(),
                        },
                    ]),
                    else_branch: Some("default".to_string()),
                    ..Default::default()
                },
            ),
            (
                "case1",
                FlowNode {
                    with_expr: Some("matched = 'one'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "case2",
                FlowNode {
                    with_expr: Some("matched = 'two'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "case3",
                FlowNode {
                    with_expr: Some("matched = 'three'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "default",
                FlowNode {
                    with_expr: Some("matched = 'default'".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("case2").and_then(|v| v.get("matched")),
            Some(&Value::String("two".to_string()))
        );
        // Other cases should not be executed
        assert!(result.get("case1").is_none());
        assert!(result.get("case3").is_none());
        assert!(result.get("default").is_none());
    }

    #[tokio::test]
    async fn test_only_conditional_execution() {
        let flow = create_flow(vec![
            (
                "setup",
                FlowNode {
                    with_expr: Some("skip = true".to_string()),
                    next: Some("maybe".to_string()),
                    ..Default::default()
                },
            ),
            (
                "maybe",
                FlowNode {
                    only: Some("!setup.skip".to_string()),
                    with_expr: Some("ran = true".to_string()),
                    next: Some("final".to_string()),
                    ..Default::default()
                },
            ),
            (
                "final",
                FlowNode {
                    with_expr: Some("done = true".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        // "maybe" should be skipped due to `only` condition
        assert!(result.get("maybe").is_none());
        // "final" should still be executed
        assert_eq!(
            result.get("final").and_then(|v| v.get("done")),
            Some(&Value::Bool(true))
        );
    }

    #[tokio::test]
    async fn test_parallel_independent_nodes() {
        // Two nodes with no dependencies should both be executed
        let flow = create_flow(vec![
            (
                "nodeA",
                FlowNode {
                    with_expr: Some("a = 'A'".to_string()),
                    ..Default::default()
                },
            ),
            (
                "nodeB",
                FlowNode {
                    with_expr: Some("b = 'B'".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("nodeA").and_then(|v| v.get("a")),
            Some(&Value::String("A".to_string()))
        );
        assert_eq!(
            result.get("nodeB").and_then(|v| v.get("b")),
            Some(&Value::String("B".to_string()))
        );
    }

    #[tokio::test]
    async fn test_input_parameters() {
        let flow = create_flow(vec![(
            "greet",
            FlowNode {
                with_expr: Some("message = 'Hello, ' + name".to_string()),
                ..Default::default()
            },
        )]);

        let executor = Executor::new();
        let inputs = Value::object([("name", Value::string("World"))]);
        let result = executor.execute(&flow, inputs).await.unwrap();

        assert_eq!(
            result.get("greet").and_then(|v| v.get("message")),
            Some(&Value::String("Hello, World".to_string()))
        );
    }

    #[tokio::test]
    async fn test_each_node_iteration() {
        let mut sub_nodes = HashMap::new();
        sub_nodes.insert(
            "double".to_string(),
            FlowNode {
                with_expr: Some("value = item * 2".to_string()),
                ..Default::default()
            },
        );

        let flow = create_flow(vec![
            (
                "setup",
                FlowNode {
                    with_expr: Some("numbers = [1, 2, 3]".to_string()),
                    next: Some("iterate".to_string()),
                    ..Default::default()
                },
            ),
            (
                "iterate",
                FlowNode {
                    each: Some("setup.numbers => item, idx".to_string()),
                    node: Some(sub_nodes),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        // After iteration, the last item's value should be stored
        // item = 3, doubled = 6
        assert_eq!(
            result.get("double").and_then(|v| v.get("value")),
            Some(&Value::Int(6))
        );
    }

    #[tokio::test]
    async fn test_loop_node_iteration() {
        let mut sub_nodes = HashMap::new();
        sub_nodes.insert(
            "increment".to_string(),
            FlowNode {
                sets: Some("count = count + 1".to_string()),
                with_expr: Some("step = count".to_string()),
                ..Default::default()
            },
        );

        let flow = create_flow(vec![(
            "counter",
            FlowNode {
                vars: Some("count = 0".to_string()),
                when: Some("count < 5".to_string()),
                node: Some(sub_nodes),
                with_expr: Some("final = count".to_string()),
                ..Default::default()
            },
        )]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        // Loop should run until count reaches 5
        assert_eq!(
            result.get("counter").and_then(|v| v.get("final")),
            Some(&Value::Int(5))
        );
    }

    #[tokio::test]
    async fn test_exec_node_placeholder() {
        // Test that exec nodes work (with placeholder tool execution)
        let flow = create_flow(vec![(
            "call_api",
            FlowNode {
                exec: Some("api://test/endpoint".to_string()),
                args: Some("param = 'value'".to_string()),
                ..Default::default()
            },
        )]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        // Exec node should produce a result with success flag
        let call_result = result.get("call_api").unwrap();
        assert_eq!(call_result.get("success"), Some(&Value::Bool(true)));
        assert_eq!(
            call_result.get("tool"),
            Some(&Value::String("api://test/endpoint".to_string()))
        );
    }

    #[tokio::test]
    async fn test_flow_with_arithmetic() {
        let flow = create_flow(vec![
            (
                "calc1",
                FlowNode {
                    with_expr: Some("value = 10 + 20".to_string()),
                    next: Some("calc2".to_string()),
                    ..Default::default()
                },
            ),
            (
                "calc2",
                FlowNode {
                    with_expr: Some("doubled = calc1.value * 2".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("calc1").and_then(|v| v.get("value")),
            Some(&Value::Int(30))
        );
        assert_eq!(
            result.get("calc2").and_then(|v| v.get("doubled")),
            Some(&Value::Int(60))
        );
    }

    #[tokio::test]
    async fn test_string_concatenation() {
        let flow = create_flow(vec![(
            "greet",
            FlowNode {
                with_expr: Some("result = 'Hello' + ' ' + 'World'".to_string()),
                ..Default::default()
            },
        )]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("greet").and_then(|v| v.get("result")),
            Some(&Value::String("Hello World".to_string()))
        );
    }

    #[tokio::test]
    async fn test_ternary_expression() {
        let flow = create_flow(vec![
            (
                "data",
                FlowNode {
                    with_expr: Some("score = 85".to_string()),
                    next: Some("check".to_string()),
                    ..Default::default()
                },
            ),
            (
                "check",
                FlowNode {
                    with_expr: Some("grade = data.score >= 60 ? 'pass' : 'fail'".to_string()),
                    ..Default::default()
                },
            ),
        ]);

        let executor = Executor::new();
        let result = executor.execute(&flow, Value::Null).await.unwrap();

        assert_eq!(
            result.get("check").and_then(|v| v.get("grade")),
            Some(&Value::String("pass".to_string()))
        );
    }
}
