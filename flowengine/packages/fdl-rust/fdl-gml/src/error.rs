//! GML error types

use thiserror::Error;

/// GML error type
#[derive(Debug, Error)]
pub enum GmlError {
    #[error("Lexer error at position {position}: {message}")]
    LexerError { position: usize, message: String },

    #[error("Parser error at position {position}: {message}")]
    ParserError { position: usize, message: String },

    #[error("Evaluation error: {0}")]
    EvaluationError(String),

    #[error("Type error: expected {expected}, got {actual}")]
    TypeError { expected: String, actual: String },

    #[error("Undefined variable: {0}")]
    UndefinedVariable(String),

    #[error("Undefined function: {0}")]
    UndefinedFunction(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Index out of bounds: {index} (length: {length})")]
    IndexOutOfBounds { index: i64, length: usize },

    #[error("Division by zero")]
    DivisionByZero,
}

/// GML result type
pub type GmlResult<T> = Result<T, GmlError>;
