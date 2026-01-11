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

        // 按顺序执行所有语句，赋值语句的结果可以在后续表达式中使用
        for stmt in &script.statements {
            match stmt {
                Statement::Assignment(assign) => {
                    has_assignments = true;
                    let value = self.eval_expr(&assign.expression, context, &output)?;
                    // 将临时变量和普通变量都存储在 output 中，供后续表达式使用
                    // 临时变量（$ 前缀）在最终输出时会被过滤掉
                    output.insert(assign.field.clone(), value);
                }
                Statement::Expression(expr) => {
                    // 特殊处理展开运算符：将对象属性展开到输出中
                    // 这允许 `...data` 作为独立语句使用，将 data 的属性合并到输出
                    if let Expression::Spread(inner) = expr {
                        let spread_val = self.eval_expr(inner, context, &output)?;
                        if let Value::Object(spread_obj) = spread_val {
                            has_assignments = true; // 展开操作视为赋值
                            output.extend(spread_obj);
                        }
                    } else {
                        // 表达式语句：计算表达式值作为结果（用于单值映射场景）
                        result = self.eval_expr(expr, context, &output)?;
                    }
                }
                Statement::Return(expr) => {
                    // return 语句：立即返回，不执行后续语句
                    return self.eval_expr(expr, context, &output);
                }
            }
        }

        // 根据是否有赋值语句决定输出模式
        if has_assignments {
            // 有赋值语句：返回对象，过滤掉临时变量（$ 前缀）
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
            // 无赋值语句：返回最后一个表达式的值（单值映射模式）
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
                // 变量解析优先级：先检查作用域（赋值语句创建的变量），再检查上下文
                // 这允许赋值语句的结果覆盖上下文中的同名变量
                if let Some(first) = path.first()
                    && let Some(value) = scope.get(first)
                {
                    return self.resolve_path(value, &path[1..]);
                }

                self.resolve_path(context, path)
            }

            Expression::This(path) => {
                // $ 引用当前节点的输入上下文（context），而不是脚本内部的累积结果（scope）
                // 这样 toJson($) 可以获取到 merge 节点的完整输出
                // 如果需要引用当前脚本的内部变量，使用普通变量名即可
                self.resolve_path(context, path)
            }

            Expression::Index { target, index } => {
                let target_val = self.eval_expr(target, context, scope)?;
                match (target_val, index) {
                    (Value::Array(arr), IndexType::Number(i)) => {
                        // 支持负索引：-1 表示最后一个元素，-2 表示倒数第二个，以此类推
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
                        // # 索引：获取最后一个元素
                        arr.last().cloned().ok_or(GmlError::IndexOutOfBounds {
                            index: -1,
                            length: arr.len(),
                        })
                    }
                    (Value::Array(arr), IndexType::Expression(idx_expr)) => {
                        // 表达式索引：运行时计算索引值
                        let idx_val = self.eval_expr(idx_expr, context, scope)?;
                        let idx = idx_val.as_int().ok_or(GmlError::TypeError {
                            expected: "int".to_string(),
                            actual: idx_val.type_name().to_string(),
                        })?;
                        arr.get(idx as usize)
                            .cloned()
                            .ok_or(GmlError::IndexOutOfBounds {
                                index: idx,
                                length: arr.len(),
                            })
                    }
                    (Value::Object(obj), IndexType::Expression(key_expr)) => {
                        // 对象动态键访问：使用表达式计算键名
                        let key_val = self.eval_expr(key_expr, context, scope)?;
                        let key = key_val.as_str().ok_or(GmlError::TypeError {
                            expected: "string".to_string(),
                            actual: key_val.type_name().to_string(),
                        })?;
                        // 键不存在时返回 Null，而不是错误（空值安全设计）
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

                // 短路求值：对于 && 和 ||，如果左操作数已能确定结果，则不计算右操作数
                // 这提高了性能，也允许安全的空值检查，如 "obj && obj.field"
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
                // 对于需要 Lambda 的数组方法，传递原始表达式而非求值结果
                self.eval_method_with_exprs(&target_val, method, args, context, scope)
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
                    });
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
                // 除零检查：防止运行时错误
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
            (Value::Float(a), Value::Float(b)) => {
                a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal)
            }
            (Value::Int(a), Value::Float(b)) => (*a as f64)
                .partial_cmp(b)
                .unwrap_or(std::cmp::Ordering::Equal),
            (Value::Float(a), Value::Int(b)) => a
                .partial_cmp(&(*b as f64))
                .unwrap_or(std::cmp::Ordering::Equal),
            (Value::String(a), Value::String(b)) => a.cmp(b),
            _ => {
                return Err(GmlError::TypeError {
                    expected: "comparable types".to_string(),
                    actual: format!("{} and {}", left.type_name(), right.type_name()),
                });
            }
        };
        Ok(Value::Bool(f(ord)))
    }

    fn values_equal(&self, left: &Value, right: &Value) -> bool {
        // 值相等性比较：支持类型转换和浮点数精度处理
        match (left, right) {
            (Value::Null, Value::Null) => true,
            (Value::Bool(a), Value::Bool(b)) => a == b,
            (Value::Int(a), Value::Int(b)) => a == b,
            // 浮点数比较使用 epsilon 处理精度问题，避免 0.1 + 0.2 != 0.3 的问题
            (Value::Float(a), Value::Float(b)) => (a - b).abs() < f64::EPSILON,
            // 整数和浮点数可以比较（类型提升）
            (Value::Int(a), Value::Float(b)) => (*a as f64 - b).abs() < f64::EPSILON,
            (Value::Float(a), Value::Int(b)) => (a - *b as f64).abs() < f64::EPSILON,
            (Value::String(a), Value::String(b)) => a == b,
            // 数组深度比较：递归比较每个元素
            (Value::Array(a), Value::Array(b)) => {
                a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| self.values_equal(x, y))
            }
            _ => false,
        }
    }

    /// 带表达式参数的方法调用
    ///
    /// 某些数组方法（如 map、filter）需要接收 Lambda 表达式，
    /// 而不是已求值的值。这个方法允许我们传递原始的表达式参数。
    fn eval_method_with_exprs(
        &self,
        target: &Value,
        method: &str,
        args: &[Expression],
        context: &Value,
        scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        match target {
            Value::Array(arr) => self.eval_array_method_with_exprs(arr, method, args, context, scope),
            Value::Object(obj) => {
                // 对象方法不需要 Lambda，先求值参数
                let evaluated_args: Vec<Value> = args
                    .iter()
                    .map(|a| self.eval_expr(a, context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                self.eval_object_method(obj, method, &evaluated_args)
            }
            Value::String(s) => {
                // 字符串方法不需要 Lambda，先求值参数
                let evaluated_args: Vec<Value> = args
                    .iter()
                    .map(|a| self.eval_expr(a, context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                self.eval_string_method(s, method, &evaluated_args)
            }
            _ => Err(GmlError::EvaluationError(format!(
                "Cannot call method '{}' on {}",
                method,
                target.type_name()
            ))),
        }
    }

    /// 评估 Lambda 表达式
    ///
    /// 创建一个新的作用域，将 Lambda 参数绑定到给定值，然后求值 Lambda 体
    fn eval_lambda(
        &self,
        lambda: &Expression,
        arg_values: &[Value],
        context: &Value,
        scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        if let Expression::Lambda { params, body } = lambda {
            let mut new_scope = scope.clone();
            for (param, value) in params.iter().zip(arg_values.iter()) {
                new_scope.insert(param.clone(), value.clone());
            }
            self.eval_expr(body, context, &new_scope)
        } else {
            Err(GmlError::EvaluationError(
                "Expected lambda expression".to_string(),
            ))
        }
    }

    /// 带表达式参数的数组方法求值
    ///
    /// 支持 Lambda 表达式的数组方法（map、filter 等）
    fn eval_array_method_with_exprs(
        &self,
        arr: &[Value],
        method: &str,
        args: &[Expression],
        context: &Value,
        scope: &HashMap<String, Value>,
    ) -> GmlResult<Value> {
        match method {
            // ==================== 需要 Lambda 的方法 ====================

            "map" => {
                // map(item => expr) - 对每个元素应用转换
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "map requires a lambda expression".to_string(),
                ))?;
                let result: Vec<Value> = arr
                    .iter()
                    .map(|item| self.eval_lambda(lambda, &[item.clone()], context, scope))
                    .collect::<GmlResult<Vec<_>>>()?;
                Ok(Value::Array(result))
            }

            "filter" => {
                // filter(item => condition) - 过滤满足条件的元素
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "filter requires a lambda expression".to_string(),
                ))?;
                let mut result = Vec::new();
                for item in arr {
                    let condition = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    if condition.is_truthy() {
                        result.push(item.clone());
                    }
                }
                Ok(Value::Array(result))
            }

            "some" => {
                // some(item => condition) - 任一元素满足条件则返回 true
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "some requires a lambda expression".to_string(),
                ))?;
                for item in arr {
                    let condition = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    if condition.is_truthy() {
                        return Ok(Value::Bool(true));
                    }
                }
                Ok(Value::Bool(false))
            }

            "every" => {
                // every(item => condition) - 所有元素满足条件则返回 true
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "every requires a lambda expression".to_string(),
                ))?;
                for item in arr {
                    let condition = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    if !condition.is_truthy() {
                        return Ok(Value::Bool(false));
                    }
                }
                Ok(Value::Bool(true))
            }

            "find" => {
                // find(item => condition) - 返回第一个满足条件的元素
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "find requires a lambda expression".to_string(),
                ))?;
                for item in arr {
                    let condition = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    if condition.is_truthy() {
                        return Ok(item.clone());
                    }
                }
                Ok(Value::Null)
            }

            "findIndex" => {
                // findIndex(item => condition) - 返回第一个满足条件的元素索引
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "findIndex requires a lambda expression".to_string(),
                ))?;
                for (i, item) in arr.iter().enumerate() {
                    let condition = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    if condition.is_truthy() {
                        return Ok(Value::Int(i as i64));
                    }
                }
                Ok(Value::Int(-1))
            }

            "sort" => {
                // sort() - 按值排序（可选 Lambda 指定比较键）
                let mut result = arr.to_vec();
                if let Some(lambda) = args.first() {
                    // 使用 Lambda 计算排序键
                    let mut keyed: Vec<(Value, Value)> = result
                        .into_iter()
                        .map(|item| {
                            let key = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                            Ok((item, key))
                        })
                        .collect::<GmlResult<Vec<_>>>()?;
                    keyed.sort_by(|a, b| self.compare_values(&a.1, &b.1));
                    result = keyed.into_iter().map(|(item, _)| item).collect();
                } else {
                    // 直接按值排序
                    result.sort_by(|a, b| self.compare_values(a, b));
                }
                Ok(Value::Array(result))
            }

            "group" => {
                // group(item => key) - 按键分组
                let lambda = args.first().ok_or(GmlError::InvalidArgument(
                    "group requires a lambda expression".to_string(),
                ))?;
                let mut groups: HashMap<String, Vec<Value>> = HashMap::new();
                for item in arr {
                    let key = self.eval_lambda(lambda, &[item.clone()], context, scope)?;
                    let key_str = self.value_to_string(&key);
                    groups.entry(key_str).or_default().push(item.clone());
                }
                // 返回对象，每个键对应一个数组
                let result: HashMap<String, Value> = groups
                    .into_iter()
                    .map(|(k, v)| (k, Value::Array(v)))
                    .collect();
                Ok(Value::Object(result))
            }

            "proj" | "pluck" => {
                // proj('field1,field2') 或 proj(item => { field1: item.a, field2: item.b })
                // 从每个对象中提取指定字段
                if let Some(first_arg) = args.first() {
                    let first_val = self.eval_expr(first_arg, context, scope)?;
                    if let Some(fields_str) = first_val.as_str() {
                        // 字符串参数：提取指定字段
                        let field_list: Vec<&str> = fields_str.split(',').map(|s| s.trim()).collect();
                        let result: Vec<Value> = arr
                            .iter()
                            .map(|item| {
                                if let Value::Object(obj) = item {
                                    let projected: HashMap<String, Value> = field_list
                                        .iter()
                                        .filter_map(|&f| obj.get(f).map(|v| (f.to_string(), v.clone())))
                                        .collect();
                                    Value::Object(projected)
                                } else {
                                    Value::Null
                                }
                            })
                            .collect();
                        Ok(Value::Array(result))
                    } else {
                        // Lambda 参数：对每个元素应用转换
                        let result: Vec<Value> = arr
                            .iter()
                            .map(|item| self.eval_lambda(first_arg, &[item.clone()], context, scope))
                            .collect::<GmlResult<Vec<_>>>()?;
                        Ok(Value::Array(result))
                    }
                } else {
                    Err(GmlError::InvalidArgument(
                        "proj requires a field list or lambda".to_string(),
                    ))
                }
            }

            // ==================== 不需要 Lambda 的方法（先求值参数） ====================

            "length" => Ok(Value::Int(arr.len() as i64)),

            "sum" => {
                let field = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_str().map(|s| s.to_string()));
                let sum: f64 = arr
                    .iter()
                    .map(|item| {
                        if let Some(ref f) = field {
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
                let field = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_str().map(|s| s.to_string()));
                let sum: f64 = arr
                    .iter()
                    .map(|item| {
                        if let Some(ref f) = field {
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
                let field = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_str().map(|s| s.to_string()));
                let values: Vec<f64> = arr
                    .iter()
                    .filter_map(|item| {
                        if let Some(ref f) = field {
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
                let sep = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| ",".to_string());
                let strings: Vec<String> = arr.iter().map(|v| self.value_to_string(v)).collect();
                Ok(Value::String(strings.join(&sep)))
            }

            "flat" => {
                let depth = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(1);
                Ok(Value::Array(self.flatten_array(arr, depth as usize)))
            }

            "includes" => {
                let search = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .ok_or(GmlError::InvalidArgument(
                        "includes requires an argument".to_string(),
                    ))?;
                Ok(Value::Bool(
                    arr.iter().any(|item| self.values_equal(item, &search)),
                ))
            }

            "push" | "add" => {
                let mut result = arr.to_vec();
                for arg in args {
                    let val = self.eval_expr(arg, context, scope)?;
                    result.push(val);
                }
                Ok(Value::Array(result))
            }

            "concat" | "addAll" => {
                let mut result = arr.to_vec();
                if let Some(arg) = args.first() {
                    let val = self.eval_expr(arg, context, scope)?;
                    if let Value::Array(other) = val {
                        result.extend(other);
                    }
                }
                Ok(Value::Array(result))
            }

            "slice" => {
                // slice(start, end?) - 获取切片
                let start = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(0) as usize;
                let end = args.get(1)
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .map(|e| e as usize)
                    .unwrap_or(arr.len());
                let start = start.min(arr.len());
                let end = end.min(arr.len());
                Ok(Value::Array(arr[start..end].to_vec()))
            }

            "chunk" => {
                // chunk(size) - 分块
                let size = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(1) as usize;
                let size = size.max(1);
                let chunks: Vec<Value> = arr
                    .chunks(size)
                    .map(|chunk| Value::Array(chunk.to_vec()))
                    .collect();
                Ok(Value::Array(chunks))
            }

            "take" => {
                // take(n) - 获取前 n 个元素
                let n = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(1) as usize;
                Ok(Value::Array(arr.iter().take(n).cloned().collect()))
            }

            "skip" | "drop" => {
                // skip(n) - 跳过前 n 个元素
                let n = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(0) as usize;
                Ok(Value::Array(arr.iter().skip(n).cloned().collect()))
            }

            "at" => {
                // at(index) - 获取指定位置的元素，支持负索引
                let idx = args.first()
                    .map(|a| self.eval_expr(a, context, scope))
                    .transpose()?
                    .and_then(|v| v.as_int())
                    .unwrap_or(0);
                let actual_idx = if idx < 0 {
                    (arr.len() as i64 + idx) as usize
                } else {
                    idx as usize
                };
                Ok(arr.get(actual_idx).cloned().unwrap_or(Value::Null))
            }

            _ => Err(GmlError::EvaluationError(format!(
                "Unknown array method: {}",
                method
            ))),
        }
    }

    /// 递归扁平化数组
    fn flatten_array(&self, arr: &[Value], depth: usize) -> Vec<Value> {
        if depth == 0 {
            return arr.to_vec();
        }
        let mut result = Vec::new();
        for item in arr {
            if let Value::Array(inner) = item {
                result.extend(self.flatten_array(inner, depth - 1));
            } else {
                result.push(item.clone());
            }
        }
        result
    }

    /// 值比较（用于排序）
    fn compare_values(&self, a: &Value, b: &Value) -> std::cmp::Ordering {
        match (a, b) {
            (Value::Int(x), Value::Int(y)) => x.cmp(y),
            (Value::Float(x), Value::Float(y)) => x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal),
            (Value::Int(x), Value::Float(y)) => (*x as f64).partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal),
            (Value::Float(x), Value::Int(y)) => x.partial_cmp(&(*y as f64)).unwrap_or(std::cmp::Ordering::Equal),
            (Value::String(x), Value::String(y)) => x.cmp(y),
            (Value::Bool(x), Value::Bool(y)) => x.cmp(y),
            _ => std::cmp::Ordering::Equal,
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
                let fields =
                    args.first()
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
                let parts: Vec<Value> =
                    s.split(sep).map(|p| Value::String(p.to_string())).collect();
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
        let result = evaluator
            .evaluate("greeting = 'Hello', user = name", &context)
            .unwrap();
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
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3)]),
        )]);
        let result = evaluator.evaluate("nums.sum()", &context).unwrap();
        assert_eq!(result, Value::Float(6.0));
    }

    #[test]
    fn test_array_avg() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(2), Value::int(4), Value::int(6)]),
        )]);
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
        assert_eq!(
            evaluator.evaluate("2 + 3", &context).unwrap(),
            Value::Int(5)
        );
        assert_eq!(
            evaluator.evaluate("10 - 4", &context).unwrap(),
            Value::Int(6)
        );
        assert_eq!(
            evaluator.evaluate("3 * 4", &context).unwrap(),
            Value::Int(12)
        );
        assert_eq!(
            evaluator.evaluate("15 / 3", &context).unwrap(),
            Value::Int(5)
        );
        assert_eq!(
            evaluator.evaluate("17 % 5", &context).unwrap(),
            Value::Int(2)
        );
    }

    #[test]
    fn test_comparison_ops() {
        let evaluator = Evaluator::new();
        let context = Value::object([("a", Value::int(5)), ("b", Value::int(3))]);

        assert_eq!(
            evaluator.evaluate("a > b", &context).unwrap(),
            Value::Bool(true)
        );
        assert_eq!(
            evaluator.evaluate("a < b", &context).unwrap(),
            Value::Bool(false)
        );
        assert_eq!(
            evaluator.evaluate("a == 5", &context).unwrap(),
            Value::Bool(true)
        );
        assert_eq!(
            evaluator.evaluate("a != b", &context).unwrap(),
            Value::Bool(true)
        );
    }

    #[test]
    fn test_logical_ops() {
        let evaluator = Evaluator::new();
        let context = Value::Object(HashMap::new());

        assert_eq!(
            evaluator.evaluate("true && true", &context).unwrap(),
            Value::Bool(true)
        );
        assert_eq!(
            evaluator.evaluate("true && false", &context).unwrap(),
            Value::Bool(false)
        );
        assert_eq!(
            evaluator.evaluate("false || true", &context).unwrap(),
            Value::Bool(true)
        );
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

    #[test]
    fn test_array_map() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3)]),
        )]);
        let result = evaluator.evaluate("nums.map(x => x * 2)", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(2), Value::Int(4), Value::Int(6)])
        );
    }

    #[test]
    fn test_array_filter() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3), Value::int(4)]),
        )]);
        let result = evaluator.evaluate("nums.filter(x => x > 2)", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(3), Value::Int(4)])
        );
    }

    #[test]
    fn test_array_some_every() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3)]),
        )]);

        let result = evaluator.evaluate("nums.some(x => x > 2)", &context).unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = evaluator.evaluate("nums.every(x => x > 0)", &context).unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = evaluator.evaluate("nums.every(x => x > 2)", &context).unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_array_find() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "users",
            Value::array(vec![
                Value::object([("name", Value::string("Alice")), ("age", Value::int(25))]),
                Value::object([("name", Value::string("Bob")), ("age", Value::int(30))]),
            ]),
        )]);
        let result = evaluator.evaluate("users.find(u => u.age > 28)", &context).unwrap();
        assert_eq!(result.get("name"), Some(&Value::string("Bob")));
    }

    #[test]
    fn test_array_sort() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(3), Value::int(1), Value::int(2)]),
        )]);
        let result = evaluator.evaluate("nums.sort()", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(1), Value::Int(2), Value::Int(3)])
        );
    }

    #[test]
    fn test_array_slice() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3), Value::int(4), Value::int(5)]),
        )]);
        let result = evaluator.evaluate("nums.slice(1, 4)", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(2), Value::Int(3), Value::Int(4)])
        );
    }

    #[test]
    fn test_array_chunk() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3), Value::int(4), Value::int(5)]),
        )]);
        let result = evaluator.evaluate("nums.chunk(2)", &context).unwrap();
        if let Value::Array(chunks) = result {
            assert_eq!(chunks.len(), 3);
            assert_eq!(chunks[0], Value::array(vec![Value::Int(1), Value::Int(2)]));
            assert_eq!(chunks[1], Value::array(vec![Value::Int(3), Value::Int(4)]));
            assert_eq!(chunks[2], Value::array(vec![Value::Int(5)]));
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_array_take_skip() {
        let evaluator = Evaluator::new();
        let context = Value::object([(
            "nums",
            Value::array(vec![Value::int(1), Value::int(2), Value::int(3), Value::int(4), Value::int(5)]),
        )]);

        let result = evaluator.evaluate("nums.take(3)", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(1), Value::Int(2), Value::Int(3)])
        );

        let result = evaluator.evaluate("nums.skip(2)", &context).unwrap();
        assert_eq!(
            result,
            Value::array(vec![Value::Int(3), Value::Int(4), Value::Int(5)])
        );
    }
}
