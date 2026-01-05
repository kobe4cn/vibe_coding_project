//! # FDL-GML
//!
//! GML (Generic Mapping Language) expression engine for FDL.
//!
//! GML is a declarative data mapping language used for transforming
//! source data structures into target data structures.
//!
//! ## Features
//!
//! - Object construction with field assignments
//! - Single value mapping
//! - String template interpolation
//! - CASE WHEN expressions
//! - Array prototype methods (map, filter, sum, etc.)
//! - Object spread operator
//! - Null-safe access

pub mod ast;
pub mod error;
pub mod evaluator;
pub mod functions;
pub mod lexer;
pub mod parser;
pub mod value;

pub use error::{GmlError, GmlResult};
pub use evaluator::Evaluator;
pub use value::Value;

/// Parse and evaluate a GML expression
pub fn evaluate(script: &str, context: &Value) -> GmlResult<Value> {
    let evaluator = Evaluator::new();
    evaluator.evaluate(script, context)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_value() {
        let context = Value::object([("name", Value::string("Alice"))]);
        let result = evaluate("name", &context).unwrap();
        assert_eq!(result, Value::string("Alice"));
    }
}
