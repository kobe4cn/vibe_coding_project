//! 并行执行调度器
//!
//! 实现基于依赖图的并行执行调度，支持：
//! - 自动检测节点依赖关系
//! - 并行执行独立节点
//! - 顺序执行有依赖的节点
//! - 错误处理和失败节点跟踪

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::nodes;
use crate::types::{Flow, NodeType};
use fdl_gml::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tokio::sync::RwLock;

/// 流程执行调度器
/// 
/// 负责调度流程节点的执行，根据依赖关系决定哪些节点可以并行执行。
/// 使用依赖图算法确保节点按正确顺序执行。
pub struct Scheduler {
    /// 最大并行执行节点数（防止资源耗尽）
    max_parallel: usize,
}

impl Default for Scheduler {
    fn default() -> Self {
        Self::new()
    }
}

impl Scheduler {
    /// Create a new scheduler
    pub fn new() -> Self {
        Self { max_parallel: 100 }
    }

    /// Set maximum parallel executions
    pub fn with_max_parallel(mut self, max: usize) -> Self {
        self.max_parallel = max;
        self
    }

    /// Execute a flow
    pub async fn execute(
        &self,
        flow: &Flow,
        context: Arc<RwLock<ExecutionContext>>,
    ) -> ExecutorResult<Value> {
        // Build dependency graph
        let graph = self.build_dependency_graph(flow)?;

        // Find start nodes (nodes with no incoming edges)
        let start_nodes = self.find_start_nodes(flow, &graph);

        tracing::debug!(
            "Scheduler: {} total nodes, {} start nodes: {:?}",
            flow.nodes.len(),
            start_nodes.len(),
            start_nodes
        );

        if start_nodes.is_empty() {
            tracing::warn!("No start nodes found! Dependency graph: {:?}", graph);
            return Err(ExecutorError::InvalidFlow(
                "No start nodes found".to_string(),
            ));
        }

        // Execute using parallel scheduling
        self.execute_from_nodes(flow, &start_nodes, context.clone())
            .await?;

        // Build output from context
        let ctx = context.read().await;
        Ok(ctx.build_eval_context())
    }

    /// 从流程定义构建依赖图
    /// 
    /// 依赖图表示节点之间的执行顺序关系。图中每个节点存储其依赖的节点列表。
    /// 如果节点 A 依赖节点 B，则 B 必须在 A 之前执行。
    /// 
    /// 依赖关系来源：
    /// - `next`: 顺序执行的下一个节点
    /// - `then`/`else`: 条件节点的分支
    /// - `case`: switch 节点的分支
    /// - `fail`: 错误处理节点
    fn build_dependency_graph(&self, flow: &Flow) -> ExecutorResult<HashMap<String, Vec<String>>> {
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();

        // 初始化所有节点（开始时没有依赖）
        for node_id in flow.nodes.keys() {
            graph.insert(node_id.clone(), Vec::new());
        }

        // 从 `next`、`then`、`else`、`fail` 字段添加边
        for (node_id, node) in &flow.nodes {
            // 处理 next：支持逗号分隔的多个下一个节点
            if let Some(next) = &node.next {
                for target in next.split(',').map(|s| s.trim()) {
                    if let Some(deps) = graph.get_mut(target) {
                        // target 节点依赖当前节点
                        deps.push(node_id.clone());
                    }
                }
            }

            // 处理条件节点的 then/else 分支
            if let Some(then) = &node.then
                && let Some(deps) = graph.get_mut(then)
            {
                deps.push(node_id.clone());
            }
            if let Some(else_branch) = &node.else_branch
                && let Some(deps) = graph.get_mut(else_branch)
            {
                deps.push(node_id.clone());
            }

            // 处理 switch 节点的 case 分支
            if let Some(cases) = &node.case {
                for case in cases {
                    if let Some(deps) = graph.get_mut(&case.then) {
                        deps.push(node_id.clone());
                    }
                }
            }
        }

        Ok(graph)
    }

    /// Find start nodes (nodes with no dependencies)
    fn find_start_nodes(&self, flow: &Flow, graph: &HashMap<String, Vec<String>>) -> Vec<String> {
        graph
            .iter()
            .filter(|(node_id, deps)| deps.is_empty() && flow.nodes.contains_key(*node_id))
            .map(|(node_id, _)| node_id.clone())
            .collect()
    }

    /// 从一组节点开始执行
    /// 
    /// 使用工作队列模式并行执行节点：
    /// 1. 维护待执行节点集合（pending）和正在执行节点集合（executing）
    /// 2. 每次选择可执行的节点（不超过最大并行数）进行并行执行
    /// 3. 节点完成后，将其后续节点加入待执行队列
    /// 4. 如果节点失败，检查是否有 fail 处理器，否则返回错误
    async fn execute_from_nodes(
        &self,
        flow: &Flow,
        node_ids: &[String],
        context: Arc<RwLock<ExecutionContext>>,
    ) -> ExecutorResult<()> {
        let mut pending: HashSet<String> = node_ids.iter().cloned().collect();
        let mut executing: HashSet<String> = HashSet::new();

        // 主调度循环：持续执行直到所有节点完成
        while !pending.is_empty() || !executing.is_empty() {
            // 获取可执行节点（未在执行中，且不超过最大并行数）
            let ready: Vec<String> = pending
                .iter()
                .filter(|id| !executing.contains(*id))
                .take(self.max_parallel - executing.len())
                .cloned()
                .collect();

            if ready.is_empty() && !executing.is_empty() {
                // 没有可执行节点，但还有节点在执行中，等待它们完成
                tokio::task::yield_now().await;
                continue;
            }

            // 并行执行就绪节点
            let mut handles = Vec::new();
            for node_id in ready {
                pending.remove(&node_id);
                executing.insert(node_id.clone());

                let flow_clone = flow.clone();
                let ctx_clone = context.clone();
                let node_id_clone = node_id.clone();

                // 为每个节点创建异步任务
                let handle = tokio::spawn(async move {
                    let result =
                        execute_single_node(&flow_clone, &node_id_clone, ctx_clone.clone()).await;
                    (node_id_clone, result)
                });
                handles.push(handle);
            }

            // 等待所有任务完成
            for handle in handles {
                let (node_id, result) =
                    handle
                        .await
                        .map_err(|e| ExecutorError::NodeExecutionError {
                            node: "scheduler".to_string(),
                            message: e.to_string(),
                        })?;

                executing.remove(&node_id);

                match result {
                    Ok(next_nodes) => {
                        // 节点成功：将后续节点加入待执行队列
                        for next in next_nodes {
                            // 避免重复执行已完成的节点
                            if !context.read().await.is_completed(&next) {
                                pending.insert(next);
                            }
                        }
                    }
                    Err(e) => {
                        // 节点失败：检查是否有 fail 处理器
                        let node = flow.nodes.get(&node_id);
                        if let Some(fail_node) = node.and_then(|n| n.fail.as_ref()) {
                            // 有错误处理节点，加入待执行队列
                            pending.insert(fail_node.clone());
                        } else {
                            // 没有错误处理，返回错误
                            return Err(e);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

/// 执行单个节点
/// 
/// 返回该节点的后续节点列表，供调度器继续调度。
async fn execute_single_node(
    flow: &Flow,
    node_id: &str,
    context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let node = flow
        .nodes
        .get(node_id)
        .ok_or_else(|| ExecutorError::NodeNotFound(node_id.to_string()))?;

    // 检查 `only` 条件：如果条件不满足，跳过节点执行
    // 这允许条件性执行节点，类似于 if 语句
    if let Some(only_expr) = &node.only {
        let should_skip = {
            let ctx = context.read().await;
            let eval_ctx = ctx.build_eval_context();
            let only_result = fdl_gml::evaluate(only_expr, &eval_ctx)?;
            !only_result.is_truthy()
        }; // 释放读锁，避免死锁

        if should_skip {
            // 跳过节点：标记为已完成，但返回后续节点继续执行
            context.write().await.mark_completed(node_id);
            return Ok(get_next_nodes(node));
        }
    }

    // Execute based on node type
    let node_type = node.node_type();
    tracing::debug!("Executing node '{}': type={:?}", node_id, node_type);

    let result = match node_type {
        NodeType::Exec => nodes::execute_exec_node(node_id, node, context.clone()).await,
        NodeType::Mapping => nodes::execute_mapping_node(node_id, node, context.clone()).await,
        NodeType::Condition => nodes::execute_condition_node(node_id, node, context.clone()).await,
        NodeType::Switch => nodes::execute_switch_node(node_id, node, context.clone()).await,
        NodeType::Delay => nodes::execute_delay_node(node_id, node, context.clone()).await,
        NodeType::Each => nodes::execute_each_node(flow, node_id, node, context.clone()).await,
        NodeType::Loop => nodes::execute_loop_node(flow, node_id, node, context.clone()).await,
        NodeType::Agent => nodes::execute_agent_node(node_id, node, context.clone()).await,
        NodeType::Mcp => nodes::execute_mcp_node(node_id, node, context.clone()).await,
        NodeType::Unknown => {
            tracing::warn!("Unknown node type for '{}'", node_id);
            Err(ExecutorError::InvalidFlow(format!(
                "Unknown node type: {}",
                node_id
            )))
        }
    };

    match result {
        Ok(next) => {
            context.write().await.mark_completed(node_id);
            Ok(next)
        }
        Err(e) => {
            context.write().await.mark_failed(node_id);
            Err(e)
        }
    }
}

/// Get next nodes from a node definition
fn get_next_nodes(node: &crate::types::FlowNode) -> Vec<String> {
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    next
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scheduler_creation() {
        let scheduler = Scheduler::new().with_max_parallel(50);
        assert_eq!(scheduler.max_parallel, 50);
    }
}
