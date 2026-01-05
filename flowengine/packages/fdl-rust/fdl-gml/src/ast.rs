//! GML Abstract Syntax Tree definitions

use crate::value::Value;

/// GML script - a sequence of statements
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

/// Assignment statement
#[derive(Debug, Clone, PartialEq)]
pub struct Assignment {
    /// Field name (may start with $ for temp variables)
    pub field: String,
    /// Whether this is a temporary variable ($prefix)
    pub is_temp: bool,
    /// The expression to assign
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

    /// Array index access: `arr[0]` or `arr[#]`
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
    FunctionCall {
        name: String,
        args: Vec<Expression>,
    },

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

/// Index type for array access
#[derive(Debug, Clone, PartialEq)]
pub enum IndexType {
    /// Numeric index
    Number(i64),
    /// Last element (#)
    Last,
    /// Expression index
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
