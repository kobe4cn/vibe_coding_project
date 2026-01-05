//! Execution context management

use fdl_gml::Value;
use std::collections::HashMap;
use uuid::Uuid;

/// Execution context holds all variables and state during flow execution
#[derive(Debug, Clone)]
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
        }
    }

    /// Create context with tenant info
    pub fn with_tenant(tenant_id: &str, bu_code: &str) -> Self {
        let mut ctx = Self::new();
        ctx.tenant_id = tenant_id.to_string();
        ctx.bu_code = bu_code.to_string();
        ctx
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

    /// Build the evaluation context for GML
    pub fn build_eval_context(&self) -> Value {
        let mut ctx = HashMap::new();

        // Add inputs
        if let Value::Object(inputs) = &self.inputs {
            ctx.extend(inputs.clone());
        }

        // Add built-in variables
        ctx.insert("tenantId".to_string(), Value::String(self.tenant_id.clone()));
        ctx.insert("buCode".to_string(), Value::String(self.bu_code.clone()));

        // Add globals
        ctx.extend(self.globals.clone());

        // Add node outputs (node outputs override globals)
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

    /// Create a child context for sub-flow execution
    pub fn child_context(&self) -> Self {
        let mut child = Self::new();
        child.tenant_id = self.tenant_id.clone();
        child.bu_code = self.bu_code.clone();
        // Child inherits parent's variables as read-only context
        child.globals = self.build_eval_context().as_object().cloned().unwrap_or_default();
        child
    }

    /// Merge results from child context back to parent
    pub fn merge_child_results(&mut self, child: &ExecutionContext) {
        // Only merge explicitly exported variables
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
