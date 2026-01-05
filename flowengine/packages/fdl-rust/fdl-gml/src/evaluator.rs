//! GML Evaluator - evaluates AST to produce values

use crate::ast::*;
use crate::error::{GmlError, GmlResult};
use crate::functions::Functions;
use crate::parser::Parser;
use crate::value::Value;
use std::collections::HashMap;

/// GML Evaluator
pub struct Evaluator {
    functions: Functions,
}

impl Default for Evaluator {
    fn default() -> Self {
        Self::new()
    }
}

impl Evaluator {
    /// Create a new evaluator
    pub fn new() -> Self {
        Self {
            functions: Functions::new(),
        }
    }

    /// Evaluate a GML script
    pub fn evaluate(&self, source: &str, context: &Value) -> GmlResult<Value> {
        let mut parser = Parser::new(source)?;
        let script = parser.parse()?;
        self.eval_script(&script, context)
    }

    fn eval_script(&self, script: &Script, context: &Value) -> GmlResult<Value> {
        let mut result = Value::Null;
        let mut output = HashMap::new();
        let mut has_assignments = false;

        for stmt in &script.statements {
            match stmt {
                Statement::Assignment(assign) => {
                    has_assignments = true;
                    let value = self.eval_expr(&assign.expression, context, &output)?;
                    if !assign.is_temp {
                        output.insert(assign.field.clone(), value);
                    } else {
                        output.insert(assign.field.clone(), value);
                    }
                }
                Statement::Expression(expr) => {
                    result = self.eval_expr(expr, context, &output)?;
                }
                Statement::Return(expr) => {
                    return self.eval_expr(expr, context, &output);
                }
            }
        }

        // Determine output mode
        if has_assignments {
            // Filter out temp variables
            let final_output: HashMap<String, Value> = output
                .into_iter()
                .filter(|(k, _)| !k.starts_with('$'))
                .collect();

            if final_output.is_empty() {
                Ok(result)
            } else {
                Ok(Value::Object(final_output))
            }
        } else {
            Ok(result)
        }
    }

    fn eval_expr(
        &self,
        expr: &Expression,
        context: &Value,
        scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        match expr {
            Expression::Literal(v) => Ok(v.clone()),

            Expression::Variable(path) => {
                // First check scope, then context
                if let Some(first) = path.first() {
                    if let Some(value) = scope.get(first) {
                        return self.resolve_path(value, &path[1..]);
                    }
                }
                self.resolve_path(context, path)
            }

            Expression::This(path) => {
                let this_context = Value::Object(scope.clone());
                self.resolve_path(&this_context, path)
            }

            Expression::Index { target, index } => {
                let target_val = self.eval_expr(target, context, scope)?;
                match (target_val, index) {
                    (Value::Array(arr), IndexType::Number(i)) => {
                        let idx = if *i < 0 {
                            (arr.len() as i64 + *i) as usize
                        } else {
                            *i as usize
                        };
                        arr.get(idx).cloned().ok_or(GmlError::IndexOutOfBounds {
                            index: *i,
                            length: arr.len(),
                        })
                    }
                    (Value::Array(arr), IndexType::Last) => {
                        arr.last().cloned().ok_or(GmlError::IndexOutOfBounds {
                            index: -1,
                            length: arr.len(),
                        })
                    }
                    (Value::Array(arr), IndexType::Expression(idx_expr)) => {
                        let idx_val = self.eval_expr(idx_expr, context, scope)?;
                        let idx = idx_val.as_int().ok_or(GmlError::TypeError {
                            expected: "int".to_string(),
                            actual: idx_val.type_name().to_string(),
                        })?;
                        arr.get(idx as usize).cloned().ok_or(GmlError::IndexOutOfBounds {
                            index: idx,
                            length: arr.len(),
                        })
                    }
                    (Value::Object(obj), IndexType::Expression(key_expr)) => {
                        let key_val = self.eval_expr(key_expr, context, scope)?;
                        let key = key_val.as_str().ok_or(GmlError::TypeError {
                            expected: "string".to_string(),
                            actual: key_val.type_name().to_string(),
                        })?;
                        Ok(obj.get(key).cloned().unwrap_or(Value::Null))
                    }
                    (Value::Null, _) => Ok(Value::Null),
                    (v, _) => Err(GmlError::TypeError {
                        expected: "array or object".to_string(),
                        actual: v.type_name().to_string(),
                    }),
                }
            }

            Expression::Binary { left, op, right } => {
                let left_val = self.eval_expr(left, context, scope)?;

                // Short-circuit evaluation for && and ||
                match op {
                    BinaryOp::And => {
                        if !left_val.is_truthy() {
                            return Ok(Value::Bool(false));
                        }
                        let right_val = self.eval_expr(right, context, scope)?;
                        return Ok(Value::Bool(right_val.is_truthy()));
                    }
                    BinaryOp::Or => {
                        if left_val.is_truthy() {
                            return Ok(left_val);
                        }
                        return self.eval_expr(right, context, scope);
                    }
                    _ => {}
                }

                let right_val = self.eval_expr(right, context, scope)?;
                self.eval_binary_op(&left_val, *op, &right_val)
            }

            Expression::Unary { op, operand } => {
                let val = self.eval_expr(operand, context, scope)?;
                match op {
                    UnaryOp::Not => Ok(Value::Bool(!val.is_truthy())),
                    UnaryOp::Neg => match val {
                        Value::Int(i) => Ok(Value::Int(-i)),
                        Value::Float(f) => Ok(Value::Float(-f)),
                        _ => Err(GmlError::TypeError {
                            expected: "number".to_string(),
                            actual: val.type_name().to_string(),
                        }),
                    },
                }
            }

            Expression::Ternary {
                condition,
                then_branch,
                else_branch,
            } => {
                let cond = self.eval_expr(condition, context, scope)?;
                if cond.is_truthy() {
                    self.eval_expr(then_branch, context, scope)
                } else {
                    self.eval_expr(else_branch, context, scope)
                }
            }

            Expression::Case {
                branches,
                else_branch,
            } => {
                for branch in branches {
                    let cond = self.eval_expr(&branch.when, context, scope)?;
                    if cond.is_truthy() {
                        return self.eval_expr(&branch.then, context, scope);
                    }
                }
                if let Some(else_expr) = else_branch {
                    self.eval_expr(else_expr, context, scope)
                } else {
                    Ok(Value::Null)
                }
            }

            Expression::FunctionCall { name, args } => {
                let evaluated_args: Vec<Value> = args
                    .iter()
                    .map(|a| self.eval_expr(a, context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                self.functions.call(name, &evaluated_args)
            }

            Expression::MethodCall {
                target,
                method,
                args,
            } => {
                let target_val = self.eval_expr(target, context, scope)?;
                if target_val.is_null() {
                    return Ok(Value::Null);
                }
                let evaluated_args: Vec<Value> = args
                    .iter()
                    .map(|a| self.eval_expr(a, context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                self.eval_method(&target_val, method, &evaluated_args, context, scope)
            }

            Expression::Lambda { .. } => {
                // Lambdas are evaluated when used in method calls
                Err(GmlError::EvaluationError(
                    "Lambda cannot be evaluated directly".to_string(),
                ))
            }

            Expression::ObjectLiteral(fields) => {
                let mut obj = HashMap::new();
                for field in fields {
                    match field {
                        ObjectField::Named { name, value } => {
                            let val = self.eval_expr(value, context, scope)?;
                            obj.insert(name.clone(), val);
                        }
                        ObjectField::Shorthand(name) => {
                            let val = scope
                                .get(name)
                                .or_else(|| context.get(name))
                                .cloned()
                                .unwrap_or(Value::Null);
                            obj.insert(name.clone(), val);
                        }
                        ObjectField::Spread(expr) => {
                            let val = self.eval_expr(expr, context, scope)?;
                            if let Value::Object(spread_obj) = val {
                                obj.extend(spread_obj);
                            }
                        }
                    }
                }
                Ok(Value::Object(obj))
            }

            Expression::ArrayLiteral(elements) => {
                let arr: Vec<Value> = elements
                    .iter()
                    .map(|e| self.eval_expr(e, context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                Ok(Value::Array(arr))
            }

            Expression::Spread(expr) => {
                // Spread is handled in ObjectLiteral
                self.eval_expr(expr, context, scope)
            }

            Expression::Template(parts) => {
                let mut result = String::new();
                for part in parts {
                    match part {
                        TemplatePart::Literal(s) => result.push_str(s),
                        TemplatePart::Expression(e) => {
                            let val = self.eval_expr(e, context, scope)?;
                            result.push_str(&self.value_to_string(&val));
                        }
                    }
                }
                Ok(Value::String(result))
            }
        }
    }

    fn resolve_path(&self, value: &Value, path: &[String]) -> GmlResult<Value> {
        let mut current = value.clone();
        for key in path {
            current = match current {
                Value::Object(ref obj) => obj.get(key).cloned().unwrap_or(Value::Null),
                Value::Null => return Ok(Value::Null),
                _ => {
                    return Err(GmlError::TypeError {
                        expected: "object".to_string(),
                        actual: current.type_name().to_string(),
                    })
                }
            };
        }
        Ok(current)
    }

    fn eval_binary_op(&self, left: &Value, op: BinaryOp, right: &Value) -> GmlResult<Value> {
        match op {
            BinaryOp::Add => match (left, right) {
                (Value::Int(a), Value::Int(b)) => Ok(Value::Int(a + b)),
                (Value::Float(a), Value::Float(b)) => Ok(Value::Float(a + b)),
                (Value::Int(a), Value::Float(b)) => Ok(Value::Float(*a as f64 + b)),
                (Value::Float(a), Value::Int(b)) => Ok(Value::Float(a + *b as f64)),
                (Value::String(a), Value::String(b)) => Ok(Value::String(format!("{}{}", a, b))),
                _ => Err(GmlError::TypeError {
                    expected: "number or string".to_string(),
                    actual: format!("{} and {}", left.type_name(), right.type_name()),
                }),
            },
            BinaryOp::Sub => self.numeric_op(left, right, |a, b| a - b, |a, b| a - b),
            BinaryOp::Mul => self.numeric_op(left, right, |a, b| a * b, |a, b| a * b),
            BinaryOp::Div => {
                if let Some(0) = right.as_int() {
                    return Err(GmlError::DivisionByZero);
                }
                self.numeric_op(left, right, |a, b| a / b, |a, b| a / b)
            }
            BinaryOp::Mod => self.numeric_op(left, right, |a, b| a % b, |a, b| a % b),
            BinaryOp::Eq => Ok(Value::Bool(self.values_equal(left, right))),
            BinaryOp::Ne => Ok(Value::Bool(!self.values_equal(left, right))),
            BinaryOp::Lt => self.compare_op(left, right, |ord| ord.is_lt()),
            BinaryOp::Le => self.compare_op(left, right, |ord| ord.is_le()),
            BinaryOp::Gt => self.compare_op(left, right, |ord| ord.is_gt()),
            BinaryOp::Ge => self.compare_op(left, right, |ord| ord.is_ge()),
            BinaryOp::And | BinaryOp::Or | BinaryOp::NullCoalesce => {
                // Handled in eval_expr for short-circuit
                unreachable!()
            }
        }
    }

    fn numeric_op<F1, F2>(
        &self,
        left: &Value,
        right: &Value,
        int_op: F1,
        float_op: F2,
    ) -> GmlResult<Value>
    where
        F1: Fn(i64, i64) -> i64,
        F2: Fn(f64, f64) -> f64,
    {
        match (left, right) {
            (Value::Int(a), Value::Int(b)) => Ok(Value::Int(int_op(*a, *b))),
            (Value::Float(a), Value::Float(b)) => Ok(Value::Float(float_op(*a, *b))),
            (Value::Int(a), Value::Float(b)) => Ok(Value::Float(float_op(*a as f64, *b))),
            (Value::Float(a), Value::Int(b)) => Ok(Value::Float(float_op(*a, *b as f64))),
            _ => Err(GmlError::TypeError {
                expected: "number".to_string(),
                actual: format!("{} and {}", left.type_name(), right.type_name()),
            }),
        }
    }

    fn compare_op<F>(&self, left: &Value, right: &Value, f: F) -> GmlResult<Value>
    where
        F: Fn(std::cmp::Ordering) -> bool,
    {
        let ord = match (left, right) {
            (Value::Int(a), Value::Int(b)) => a.cmp(b),
            (Value::Float(a), Value::Float(b)) => a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal),
            (Value::Int(a), Value::Float(b)) => (*a as f64).partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal),
            (Value::Float(a), Value::Int(b)) => a.partial_cmp(&(*b as f64)).unwrap_or(std::cmp::Ordering::Equal),
            (Value::String(a), Value::String(b)) => a.cmp(b),
            _ => {
                return Err(GmlError::TypeError {
                    expected: "comparable types".to_string(),
                    actual: format!("{} and {}", left.type_name(), right.type_name()),
                })
            }
        };
        Ok(Value::Bool(f(ord)))
    }

    fn values_equal(&self, left: &Value, right: &Value) -> bool {
        match (left, right) {
            (Value::Null, Value::Null) => true,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::Int(a), Value::Int(b)) => a == b,
            (Value::Float(a), Value::Float(b)) => (a - b).abs() < f64::EPSILON,
            (Value::Int(a), Value::Float(b)) => (*a as f64 - b).abs() < f64::EPSILON,
            (Value::Float(a), Value::Int(b)) => (a - *b as f64).abs() < f64::EPSILON,
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Array(a), Value::Array(b)) => {
                a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| self.values_equal(x, y))
            }
            _ => false,
        }
    }

    fn eval_method(
        &self,
        target: &Value,
        method: &str,
        args: &[Value],
        context: &Value,
        scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        match target {
            Value::Array(arr) => self.eval_array_method(arr, method, args, context, scope),
            Value::Object(obj) => self.eval_object_method(obj, method, args),
            Value::String(s) => self.eval_string_method(s, method, args),
            _ => Err(GmlError::EvaluationError(format!(
                "Cannot call method '{}' on {}",
                method,
                target.type_name()
            ))),
        }
    }

    fn eval_array_method(
        &self,
        arr: &[Value],
        method: &str,
        args: &[Value],
        _context: &Value,
        _scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        match method {
            "length" => Ok(Value::Int(arr.len() as i64)),

            "sum" => {
                let field = args.first().and_then(|v| v.as_str());
                let sum: f64 = arr
                    .iter()
                    .map(|item| {
                        if let Some(f) = field {
                            item.get(f).and_then(|v| v.as_float()).unwrap_or(0.0)
                        } else {
                            item.as_float().unwrap_or(0.0)
                        }
                    })
                    .sum();
                Ok(Value::Float(sum))
            }

            "avg" => {
                if arr.is_empty() {
                    return Ok(Value::Null);
                }
                let field = args.first().and_then(|v| v.as_str());
                let sum: f64 = arr
                    .iter()
                    .map(|item| {
                        if let Some(f) = field {
                            item.get(f).and_then(|v| v.as_float()).unwrap_or(0.0)
                        } else {
                            item.as_float().unwrap_or(0.0)
                        }
                    })
                    .sum();
                Ok(Value::Float(sum / arr.len() as f64))
            }

            "min" | "max" => {
                if arr.is_empty() {
                    return Ok(Value::Null);
                }
                let field = args.first().and_then(|v| v.as_str());
                let values: Vec<f64> = arr
                    .iter()
                    .filter_map(|item| {
                        if let Some(f) = field {
                            item.get(f).and_then(|v| v.as_float())
                        } else {
                            item.as_float()
                        }
                    })
                    .collect();
                let result = if method == "min" {
                    values.into_iter().min_by(|a, b| a.partial_cmp(b).unwrap())
                } else {
                    values.into_iter().max_by(|a, b| a.partial_cmp(b).unwrap())
                };
                Ok(result.map(Value::Float).unwrap_or(Value::Null))
            }

            "first" => Ok(arr.first().cloned().unwrap_or(Value::Null)),

            "last" => Ok(arr.last().cloned().unwrap_or(Value::Null)),

            "reverse" => Ok(Value::Array(arr.iter().rev().cloned().collect())),

            "distinct" => {
                let mut seen = Vec::new();
                let mut result = Vec::new();
                for item in arr {
                    if !seen.iter().any(|s| self.values_equal(s, item)) {
                        seen.push(item.clone());
                        result.push(item.clone());
                    }
                }
                Ok(Value::Array(result))
            }

            "join" => {
                let sep = args.first().and_then(|v| v.as_str()).unwrap_or(",");
                let strings: Vec<String> = arr.iter().map(|v| self.value_to_string(v)).collect();
                Ok(Value::String(strings.join(sep)))
            }

            "flat" => {
                let mut result = Vec::new();
                for item in arr {
                    if let Value::Array(inner) = item {
                        result.extend(inner.clone());
                    } else {
                        result.push(item.clone());
                    }
                }
                Ok(Value::Array(result))
            }

            "includes" => {
                let search = args.first().ok_or(GmlError::InvalidArgument(
                    "includes requires an argument".to_string(),
                ))?;
                Ok(Value::Bool(arr.iter().any(|item| self.values_equal(item, search))))
            }

            "push" | "add" => {
                let mut result = arr.to_vec();
                result.extend(args.iter().cloned());
                Ok(Value::Array(result))
            }

            "concat" | "addAll" => {
                let mut result = arr.to_vec();
                if let Some(Value::Array(other)) = args.first() {
                    result.extend(other.clone());
                }
                Ok(Value::Array(result))
            }

            _ => Err(GmlError::EvaluationError(format!(
                "Unknown array method: {}",
                method
            ))),
        }
    }

    fn eval_object_method(
        &self,
        obj: &HashMap<String, Value>,
        method: &str,
        args: &[Value],
    ) -> GmlResult<Value> {
        match method {
            "proj" => {
                let fields = args
                    .first()
                    .and_then(|v| v.as_str())
                    .ok_or(GmlError::InvalidArgument(
                        "proj requires field names".to_string(),
                    ))?;
                let field_list: Vec<&str> = fields.split(',').map(|s| s.trim()).collect();
                let mut result = HashMap::new();
                for field in field_list {
                    if let Some(value) = obj.get(field) {
                        result.insert(field.to_string(), value.clone());
                    }
                }
                Ok(Value::Object(result))
            }
            _ => Err(GmlError::EvaluationError(format!(
                "Unknown object method: {}",
                method
            ))),
        }
    }

    fn eval_string_method(&self, s: &str, method: &str, _args: &[Value]) -> GmlResult<Value> {
        match method {
            "length" => Ok(Value::Int(s.chars().count() as i64)),
            "toLowerCase" | "lower" => Ok(Value::String(s.to_lowercase())),
            "toUpperCase" | "upper" => Ok(Value::String(s.to_uppercase())),
            "trim" => Ok(Value::String(s.trim().to_string())),
            "split" => {
                let sep = _args.first().and_then(|v| v.as_str()).unwrap_or(",");
                let parts: Vec<Value> = s.split(sep).map(|p| Value::String(p.to_string())).collect();
                Ok(Value::Array(parts))
            }
            "startsWith" => {
                let prefix = _args.first().and_then(|v| v.as_str()).unwrap_or("");
                Ok(Value::Bool(s.starts_with(prefix)))
            }
            "endsWith" => {
                let suffix = _args.first().and_then(|v| v.as_str()).unwrap_or("");
                Ok(Value::Bool(s.ends_with(suffix)))
            }
            "contains" => {
                let search = _args.first().and_then(|v| v.as_str()).unwrap_or("");
                Ok(Value::Bool(s.contains(search)))
            }
            _ => Err(GmlError::EvaluationError(format!(
                "Unknown string method: {}",
                method
            ))),
        }
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::Null => "null".to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Int(i) => i.to_string(),
            Value::Float(f) => f.to_string(),
            Value::String(s) => s.clone(),
            Value::Array(_) => serde_json::to_string(value).unwrap_or_default(),
            Value::Object(_) => serde_json::to_string(value).unwrap_or_default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_expression() {
        let evaluator = Evaluator::new();
        let context = Value::object([("x", Value::int(10))]);
        let result = evaluator.evaluate("x + 5", &context).unwrap();
        assert_eq!(result, Value::Int(15));
    }

    #[test]
    fn test_object_construction() {
        let evaluator = Evaluator::new();
        let context = Value::object([("name", Value::string("Alice"))]);
        let result = evaluator.evaluate("greeting = 'Hello', user = name", &context).unwrap();
        assert!(result.get("greeting").is_some());
        assert!(result.get("user").is_some());
    }

    #[test]
    fn test_ternary() {
        let evaluator = Evaluator::new();
        let context = Value::object([("score", Value::int(85))]);
        let result = evaluator
            .evaluate("score >= 60 ? 'pass' : 'fail'", &context)
            .unwrap();
        assert_eq!(result, Value::string("pass"));
    }

    #[test]
    fn test_array_methods() {
        let evaluator = Evaluator::new();
        let context = Value::object([("nums", Value::array(vec![Value::int(1), Value::int(2), Value::int(3)]))]);
        let result = evaluator.evaluate("nums.sum()", &context).unwrap();
        assert_eq!(result, Value::Float(6.0));
    }

    #[test]
    fn test_array_avg() {
        let evaluator = Evaluator::new();
        let context = Value::object([("nums", Value::array(vec![Value::int(2), Value::int(4), Value::int(6)]))]);
        let result = evaluator.evaluate("nums.avg()", &context).unwrap();
        assert_eq!(result, Value::Float(4.0));
    }

    #[test]
    fn test_array_length() {
        let evaluator = Evaluator::new();
        let context = Value::object([("items", Value::array(vec![Value::int(1), Value::int(2)]))]);
        let result = evaluator.evaluate("items.length()", &context).unwrap();
        assert_eq!(result, Value::Int(2));
    }

    #[test]
    fn test_binary_ops() {
        let evaluator = Evaluator::new();
        let context = Value::Object(HashMap::new());

        // Arithmetic
        assert_eq!(evaluator.evaluate("2 + 3", &context).unwrap(), Value::Int(5));
        assert_eq!(evaluator.evaluate("10 - 4", &context).unwrap(), Value::Int(6));
        assert_eq!(evaluator.evaluate("3 * 4", &context).unwrap(), Value::Int(12));
        assert_eq!(evaluator.evaluate("15 / 3", &context).unwrap(), Value::Int(5));
        assert_eq!(evaluator.evaluate("17 % 5", &context).unwrap(), Value::Int(2));
    }

    #[test]
    fn test_comparison_ops() {
        let evaluator = Evaluator::new();
        let context = Value::object([("a", Value::int(5)), ("b", Value::int(3))]);

        assert_eq!(evaluator.evaluate("a > b", &context).unwrap(), Value::Bool(true));
        assert_eq!(evaluator.evaluate("a < b", &context).unwrap(), Value::Bool(false));
        assert_eq!(evaluator.evaluate("a == 5", &context).unwrap(), Value::Bool(true));
        assert_eq!(evaluator.evaluate("a != b", &context).unwrap(), Value::Bool(true));
    }

    #[test]
    fn test_logical_ops() {
        let evaluator = Evaluator::new();
        let context = Value::Object(HashMap::new());

        assert_eq!(evaluator.evaluate("true && true", &context).unwrap(), Value::Bool(true));
        assert_eq!(evaluator.evaluate("true && false", &context).unwrap(), Value::Bool(false));
        assert_eq!(evaluator.evaluate("false || true", &context).unwrap(), Value::Bool(true));
    }

    #[test]
    fn test_null_coalesce() {
        let evaluator = Evaluator::new();
        let context = Value::object([("name", Value::Null)]);

        let result = evaluator.evaluate("name || 'default'", &context).unwrap();
        assert_eq!(result, Value::string("default"));
    }

    #[test]
    fn test_string_methods() {
        let evaluator = Evaluator::new();
        let context = Value::object([("text", Value::string("hello"))]);

        let result = evaluator.evaluate("text.upper()", &context).unwrap();
        assert_eq!(result, Value::string("HELLO"));
    }

    #[test]
    fn test_template_string() {
        let evaluator = Evaluator::new();
        let context = Value::object([("name", Value::string("World"))]);

        let result = evaluator.evaluate("`Hello ${name}!`", &context).unwrap();
        assert_eq!(result, Value::string("Hello World!"));
    }

    #[test]
    fn test_case_expression() {
        let evaluator = Evaluator::new();
        let context = Value::object([("score", Value::int(75))]);

        let result = evaluator.evaluate(
            "CASE WHEN score >= 90 THEN 'A' WHEN score >= 80 THEN 'B' WHEN score >= 70 THEN 'C' ELSE 'F' END",
            &context
        ).unwrap();
        assert_eq!(result, Value::string("C"));
    }
}
