//! Delay node

use crate::context::ExecutionContext;
use crate::error::{ExecutorError, ExecutorResult};
use crate::types::FlowNode;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Execute a delay node
pub async fn execute_delay_node(
    _node_id: &str,
    node: &FlowNode,
    _context: Arc<RwLock<ExecutionContext>>,
) -> ExecutorResult<Vec<String>> {
    let wait_str = node.wait.as_ref().unwrap();

    // Parse duration
    let duration = parse_duration(wait_str)?;

    // Wait
    tokio::time::sleep(duration).await;

    // Return next nodes
    let mut next = Vec::new();
    if let Some(n) = &node.next {
        next.extend(n.split(',').map(|s| s.trim().to_string()));
    }
    Ok(next)
}

/// Parse a duration string like "5s", "10m", "1h", or integer milliseconds
fn parse_duration(s: &str) -> ExecutorResult<Duration> {
    let s = s.trim();

    // Try parsing as integer (milliseconds)
    if let Ok(ms) = s.parse::<u64>() {
        return Ok(Duration::from_millis(ms));
    }

    // Parse with unit suffix
    let (num_str, unit) = if s.ends_with(char::is_alphabetic) {
        let unit_start = s.len() - 1;
        (&s[..unit_start], &s[unit_start..])
    } else {
        return Err(ExecutorError::InvalidFlow(format!(
            "Invalid duration format: {}",
            s
        )));
    };

    let num: u64 = num_str
        .parse()
        .map_err(|_| ExecutorError::InvalidFlow(format!("Invalid duration number: {}", num_str)))?;

    let duration = match unit {
        "s" => Duration::from_secs(num),
        "m" => Duration::from_secs(num * 60),
        "h" => Duration::from_secs(num * 3600),
        _ => {
            return Err(ExecutorError::InvalidFlow(format!(
                "Invalid duration unit: {}",
                unit
            )));
        }
    };

    Ok(duration)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_duration() {
        assert_eq!(parse_duration("5000").unwrap(), Duration::from_millis(5000));
        assert_eq!(parse_duration("5s").unwrap(), Duration::from_secs(5));
        assert_eq!(parse_duration("10m").unwrap(), Duration::from_secs(600));
        assert_eq!(parse_duration("1h").unwrap(), Duration::from_secs(3600));
    }
}
