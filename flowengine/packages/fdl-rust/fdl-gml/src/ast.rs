//! GML 抽象语法树（AST）定义
//!
//! 定义了 GML 语言的语法结构，包括语句、表达式、操作符等。
//! AST 是解析器的输出，也是求值器的输入。

use crate::value::Value;

/// GML 脚本：一系列语句的集合
/// 
/// 脚本可以包含多个语句，语句之间用逗号分隔（可选）。
#[derive(Debug, Clone, PartialEq)]
pub struct Script {
    pub statements: Vec<Statement>,
}

/// A statement in GML
#[derive(Debug, Clone, PartialEq)]
pub enum Statement {
    /// Assignment statement: `field = expr`
    Assignment(Assignment),
    /// Expression statement (for single value mapping)
    Expression(Expression),
    /// Return statement: `return expr`
    Return(Expression),
}

/// 赋值语句
/// 
/// 用于在 GML 脚本中创建变量，支持临时变量（$ 前缀）用于中间计算。
#[derive(Debug, Clone, PartialEq)]
pub struct Assignment {
    /// 字段名（可能以 $ 开头表示临时变量）
    pub field: String,
    /// 是否为临时变量（$ 前缀）
    /// 临时变量在最终输出时会被过滤，仅用于中间计算
    pub is_temp: bool,
    /// 要赋值的表达式
    pub expression: Expression,
}

/// Expression types
#[derive(Debug, Clone, PartialEq)]
pub enum Expression {
    /// Literal value
    Literal(Value),

    /// Variable reference: `name` or `user.profile.name`
    Variable(Vec<String>),

    /// This reference: `this.field`
    This(Vec<String>),

    /// 数组/对象索引访问：`arr[0]`、`arr[#]` 或 `obj[key]`
    /// 
    /// 支持三种索引类型：
    /// - 数字索引：`arr[0]`
    /// - 最后元素：`arr[#]`
    /// - 表达式索引：`arr[i]` 或 `obj[key]`
    Index {
        target: Box<Expression>,
        index: IndexType,
    },

    /// Binary operation: `a + b`, `a && b`
    Binary {
        left: Box<Expression>,
        op: BinaryOp,
        right: Box<Expression>,
    },

    /// Unary operation: `!a`, `-a`
    Unary {
        op: UnaryOp,
        operand: Box<Expression>,
    },

    /// Ternary conditional: `cond ? then : else`
    Ternary {
        condition: Box<Expression>,
        then_branch: Box<Expression>,
        else_branch: Box<Expression>,
    },

    /// CASE expression
    Case {
        branches: Vec<CaseBranch>,
        else_branch: Option<Box<Expression>>,
    },

    /// Function call: `FUNC(args...)`
    FunctionCall { name: String, args: Vec<Expression> },

    /// Method call: `expr.method(args...)`
    MethodCall {
        target: Box<Expression>,
        method: String,
        args: Vec<Expression>,
    },

    /// Lambda expression: `item => item.field`
    Lambda {
        params: Vec<String>,
        body: Box<Expression>,
    },

    /// Object literal: `{ field = expr, ... }`
    ObjectLiteral(Vec<ObjectField>),

    /// Array literal: `[expr, ...]`
    ArrayLiteral(Vec<Expression>),

    /// Spread operator: `...obj`
    Spread(Box<Expression>),

    /// Template string: `` `Hello ${name}` ``
    Template(Vec<TemplatePart>),
}

/// 索引类型
/// 
/// 区分不同类型的索引，以便求值器进行优化处理。
#[derive(Debug, Clone, PartialEq)]
pub enum IndexType {
    /// 数字索引：编译时已知的整数索引，可直接访问
    Number(i64),
    /// 最后元素：使用 # 符号，如 `arr[#]`
    Last,
    /// 表达式索引：运行时计算的索引，需要先求值表达式
    Expression(Box<Expression>),
}

/// Binary operators
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BinaryOp {
    // Arithmetic
    Add,
    Sub,
    Mul,
    Div,
    Mod,

    // Comparison
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,

    // Logical
    And,
    Or,

    // Null coalescing
    NullCoalesce, // ||
}

/// Unary operators
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UnaryOp {
    Not,
    Neg,
}

/// CASE branch
#[derive(Debug, Clone, PartialEq)]
pub struct CaseBranch {
    pub when: Expression,
    pub then: Expression,
}

/// Object field in object literal
#[derive(Debug, Clone, PartialEq)]
pub enum ObjectField {
    /// Named field: `field = expr`
    Named { name: String, value: Expression },
    /// Shorthand: `field` (equivalent to `field = field`)
    Shorthand(String),
    /// Spread: `...expr`
    Spread(Expression),
}

/// Part of a template string
#[derive(Debug, Clone, PartialEq)]
pub enum TemplatePart {
    /// Literal string part
    Literal(String),
    /// Interpolated expression: `${expr}`
    Expression(Expression),
}
