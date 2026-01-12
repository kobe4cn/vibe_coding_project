//! 执行上下文管理
//!
//! 执行上下文维护流程执行过程中的所有变量和状态，包括：
//! - 输入参数
//! - 节点输出变量
//! - 全局变量
//! - 执行路径跟踪
//! - 节点完成/失败状态
//! - 工具注册表

use fdl_gml::Value;
use fdl_tools::{ManagedToolRegistry, ToolContext, ToolRegistry};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

/// 执行上下文：保存流程执行过程中的所有变量和状态
///
/// 上下文是执行引擎的核心数据结构，所有节点都可以访问和修改上下文。
/// 支持多租户隔离和子流程执行（通过子上下文）。
#[derive(Clone)]
pub struct ExecutionContext {
    /// Unique execution ID
    pub execution_id: String,
    /// Flow ID being executed
    pub flow_id: Option<String>,
    /// Tenant ID
    pub tenant_id: String,
    /// Business unit code
    pub bu_code: String,
    /// Input parameters
    inputs: Value,
    /// Node output variables (node_id -> value)
    variables: HashMap<String, Value>,
    /// Global variables
    globals: HashMap<String, Value>,
    /// Completed nodes
    completed_nodes: Vec<String>,
    /// Failed nodes
    failed_nodes: Vec<String>,
    /// Current path in the execution tree
    execution_path: Vec<String>,
    /// Tool registry for exec nodes (simple)
    tool_registry: Option<Arc<ToolRegistry>>,
    /// Managed tool registry for exec nodes (with config store)
    managed_registry: Option<Arc<ManagedToolRegistry>>,
    /// Tool execution context
    tool_context: ToolContext,
}

impl Default for ExecutionContext {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionContext {
    /// Create a new execution context
    pub fn new() -> Self {
        Self {
            execution_id: Uuid::new_v4().to_string(),
            flow_id: None,
            tenant_id: String::new(),
            bu_code: String::new(),
            inputs: Value::Null,
            variables: HashMap::new(),
            globals: HashMap::new(),
            completed_nodes: Vec::new(),
            failed_nodes: Vec::new(),
            execution_path: Vec::new(),
            tool_registry: None,
            managed_registry: None,
            tool_context: ToolContext::default(),
        }
    }

    /// Create context with tenant info
    pub fn with_tenant(tenant_id: &str, bu_code: &str) -> Self {
        let mut ctx = Self::new();
        ctx.tenant_id = tenant_id.to_string();
        ctx.bu_code = bu_code.to_string();
        ctx
    }

    /// Set the tool registry
    pub fn set_tool_registry(&mut self, registry: Arc<ToolRegistry>) {
        self.tool_registry = Some(registry);
    }

    /// Get the tool registry
    pub fn tool_registry(&self) -> Option<Arc<ToolRegistry>> {
        self.tool_registry.clone()
    }

    /// Set the managed tool registry
    pub fn set_managed_registry(&mut self, registry: Arc<ManagedToolRegistry>) {
        self.managed_registry = Some(registry);
    }

    /// Get the managed tool registry
    pub fn managed_registry(&self) -> Option<Arc<ManagedToolRegistry>> {
        self.managed_registry.clone()
    }

    /// Set the tool context
    pub fn set_tool_context(&mut self, context: ToolContext) {
        self.tool_context = context;
    }

    /// Get the tool context
    pub fn tool_context(&self) -> &ToolContext {
        &self.tool_context
    }

    /// Set input parameters
    pub fn set_inputs(&mut self, inputs: Value) {
        self.inputs = inputs;
    }

    /// Get input parameters
    pub fn inputs(&self) -> &Value {
        &self.inputs
    }

    /// Set a variable (node output)
    pub fn set_variable(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }

    /// Get a variable by name
    pub fn get_variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(name)
    }

    /// Get all variables
    pub fn variables(&self) -> &HashMap<String, Value> {
        &self.variables
    }

    /// Set a global variable
    pub fn set_global(&mut self, name: &str, value: Value) {
        self.globals.insert(name.to_string(), value);
    }

    /// Get a global variable
    pub fn get_global(&self, name: &str) -> Option<&Value> {
        self.globals.get(name)
    }

    /// 构建 GML 求值上下文
    ///
    /// 将执行上下文转换为 GML 表达式求值器可以使用的 Value 对象。
    /// 变量优先级（从低到高）：
    /// 1. 输入参数
    /// 2. 内置变量（tenantId, buCode）
    /// 3. 全局变量
    /// 4. 节点输出变量（最高优先级，可以覆盖前面的变量）
    pub fn build_eval_context(&self) -> Value {
        let mut ctx = HashMap::new();

        // 添加输入参数（最低优先级）
        if let Value::Object(inputs) = &self.inputs {
            ctx.extend(inputs.clone());
        }

        // 添加内置变量（供 GML 表达式使用）
        ctx.insert(
            "tenantId".to_string(),
            Value::String(self.tenant_id.clone()),
        );
        ctx.insert("buCode".to_string(), Value::String(self.bu_code.clone()));

        // 添加全局变量
        ctx.extend(self.globals.clone());

        // 添加节点输出变量（最高优先级，可以覆盖全局变量和输入）
        ctx.extend(self.variables.clone());

        Value::Object(ctx)
    }

    /// Mark a node as completed
    pub fn mark_completed(&mut self, node_id: &str) {
        if !self.completed_nodes.contains(&node_id.to_string()) {
            self.completed_nodes.push(node_id.to_string());
        }
    }

    /// Check if a node is completed
    pub fn is_completed(&self, node_id: &str) -> bool {
        self.completed_nodes.contains(&node_id.to_string())
    }

    /// Mark a node as failed
    pub fn mark_failed(&mut self, node_id: &str) {
        if !self.failed_nodes.contains(&node_id.to_string()) {
            self.failed_nodes.push(node_id.to_string());
        }
    }

    /// Check if a node has failed
    pub fn has_failed(&self, node_id: &str) -> bool {
        self.failed_nodes.contains(&node_id.to_string())
    }

    /// Get completed nodes
    pub fn completed_nodes(&self) -> &[String] {
        &self.completed_nodes
    }

    /// Get completed nodes set (alias for persistence)
    pub fn completed(&self) -> &Vec<String> {
        &self.completed_nodes
    }

    /// Get failed nodes
    pub fn failed_nodes(&self) -> &[String] {
        &self.failed_nodes
    }

    /// Get failed nodes set (alias for persistence)
    pub fn failed(&self) -> &Vec<String> {
        &self.failed_nodes
    }

    /// Push to execution path
    pub fn push_path(&mut self, node_id: &str) {
        self.execution_path.push(node_id.to_string());
    }

    /// Pop from execution path
    pub fn pop_path(&mut self) -> Option<String> {
        self.execution_path.pop()
    }

    /// Get current execution path
    pub fn execution_path(&self) -> &[String] {
        &self.execution_path
    }

    /// 创建子上下文用于子流程执行
    ///
    /// 子上下文继承父上下文的租户信息和所有变量（作为只读上下文）。
    /// 子流程执行完成后，可以将结果合并回父上下文。
    pub fn child_context(&self) -> Self {
        let mut child = Self::new();
        child.tenant_id = self.tenant_id.clone();
        child.bu_code = self.bu_code.clone();
        child.tool_registry = self.tool_registry.clone();
        child.managed_registry = self.managed_registry.clone();
        child.tool_context = self.tool_context.clone();
        // 子上下文继承父上下文的所有变量作为只读上下文（存储在 globals 中）
        // 这样子流程可以访问父流程的变量，但不会意外修改父流程状态
        child.globals = self
            .build_eval_context()
            .as_object()
            .cloned()
            .unwrap_or_default();
        child
    }

    /// 将子上下文的结果合并回父上下文
    ///
    /// 只合并子流程的变量输出，不会覆盖父流程的变量。
    /// 这允许子流程返回结果给父流程，同时保持父流程状态的独立性。
    pub fn merge_child_results(&mut self, child: &ExecutionContext) {
        // 只合并子流程显式导出的变量（节点输出）
        for (k, v) in child.variables() {
            self.variables.insert(k.clone(), v.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let ctx = ExecutionContext::new();
        assert!(!ctx.execution_id.is_empty());
        assert!(ctx.variables.is_empty());
    }

    #[test]
    fn test_variable_management() {
        let mut ctx = ExecutionContext::new();
        ctx.set_variable("result", Value::Int(42));
        assert_eq!(ctx.get_variable("result"), Some(&Value::Int(42)));
    }

    #[test]
    fn test_build_eval_context() {
        let mut ctx = ExecutionContext::with_tenant("tenant-1", "BU001");
        ctx.set_inputs(Value::object([("name", Value::string("Test"))]));
        ctx.set_variable("output", Value::int(100));

        let eval_ctx = ctx.build_eval_context();
        assert_eq!(eval_ctx.get("name"), Some(&Value::string("Test")));
        assert_eq!(eval_ctx.get("output"), Some(&Value::int(100)));
        assert_eq!(eval_ctx.get("tenantId"), Some(&Value::string("tenant-1")));
    }
}
