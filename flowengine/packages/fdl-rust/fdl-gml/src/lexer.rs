//! GML Lexer - tokenizes GML source code
//!
//! 词法分析器将 GML 源代码转换为 token 序列，为后续的语法分析做准备。
//! 采用单字符前瞻（lookahead）策略来区分多字符操作符（如 ==, =>, ...）。

use crate::error::{GmlError, GmlResult};

/// Token 类型
///
/// 定义了 GML 语言中所有可能的词法单元，包括字面量、标识符、关键字、操作符和分隔符。
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Literals
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
    Template(String), // Raw template string content

    // Identifiers and keywords
    Ident(String),
    This,
    Return,
    Case,
    When,
    Then,
    Else,
    End,

    // Operators
    Plus,
    Minus,
    Star,
    Slash,
    Percent,
    Eq,
    EqEq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
    And,
    Or,
    Not,
    Question,
    Colon,
    Dot,
    Comma,
    Hash, // #
    Dollar,
    Arrow,  // =>
    Spread, // ...

    // Delimiters
    LParen,
    RParen,
    LBracket,
    RBracket,
    LBrace,
    RBrace,

    // End of file
    Eof,
}

/// Lexer for GML
pub struct Lexer<'a> {
    input: &'a str,
    chars: std::iter::Peekable<std::str::CharIndices<'a>>,
    position: usize,
}

impl<'a> Lexer<'a> {
    /// Create a new lexer
    pub fn new(input: &'a str) -> Self {
        Self {
            input,
            chars: input.char_indices().peekable(),
            position: 0,
        }
    }

    /// Get the next token
    pub fn next_token(&mut self) -> GmlResult<Token> {
        self.skip_whitespace();

        let Some(&(pos, ch)) = self.chars.peek() else {
            return Ok(Token::Eof);
        };

        self.position = pos;

        match ch {
            // Single character tokens
            '+' => self.single(Token::Plus),
            '*' => self.single(Token::Star),
            '/' => self.single(Token::Slash),
            '%' => self.single(Token::Percent),
            '?' => self.single(Token::Question),
            ':' => self.single(Token::Colon),
            ',' => self.single(Token::Comma),
            '#' => self.single(Token::Hash),
            '$' => self.single(Token::Dollar),
            '(' => self.single(Token::LParen),
            ')' => self.single(Token::RParen),
            '[' => self.single(Token::LBracket),
            ']' => self.single(Token::RBracket),
            '{' => self.single(Token::LBrace),
            '}' => self.single(Token::RBrace),

            // Multi-character operators
            '-' => self.minus_or_number(),
            '=' => self.eq_or_arrow(),
            '!' => self.not_or_ne(),
            '<' => self.lt_or_le(),
            '>' => self.gt_or_ge(),
            '&' => self.and(),
            '|' => self.or(),
            '.' => self.dot_or_spread(),

            // Strings
            '\'' => self.string(),
            '`' => self.template(),

            // Numbers
            '0'..='9' => self.number(),

            // Identifiers and keywords
            'a'..='z' | 'A'..='Z' | '_' => self.ident(),

            _ => Err(GmlError::LexerError {
                position: pos,
                message: format!("Unexpected character: '{}'", ch),
            }),
        }
    }

    /// Tokenize the entire input
    pub fn tokenize(&mut self) -> GmlResult<Vec<Token>> {
        let mut tokens = Vec::new();
        loop {
            let token = self.next_token()?;
            if token == Token::Eof {
                tokens.push(token);
                break;
            }
            tokens.push(token);
        }
        Ok(tokens)
    }

    fn advance(&mut self) -> Option<(usize, char)> {
        self.chars.next()
    }

    fn peek(&mut self) -> Option<char> {
        self.chars.peek().map(|&(_, ch)| ch)
    }

    fn skip_whitespace(&mut self) {
        while let Some(&(_, ch)) = self.chars.peek() {
            if ch.is_whitespace() {
                self.advance();
            } else if ch == '#' {
                // Skip comments
                self.advance();
                while let Some(&(_, c)) = self.chars.peek() {
                    if c == '\n' {
                        break;
                    }
                    self.advance();
                }
            } else {
                break;
            }
        }
    }

    fn single(&mut self, token: Token) -> GmlResult<Token> {
        self.advance();
        Ok(token)
    }

    fn minus_or_number(&mut self) -> GmlResult<Token> {
        self.advance(); // 消费 '-'
        // 注意：即使后面是数字，也返回 Minus token，让解析器处理负数的优先级
        // 这样可以正确处理表达式如 "a - 5" 和 "-5"，避免词法分析器需要理解语法上下文
        if let Some(ch) = self.peek()
            && ch.is_ascii_digit()
        {
            // 负数情况：返回 Minus token，由解析器处理一元负号
            return Ok(Token::Minus);
        }
        Ok(Token::Minus)
    }

    fn eq_or_arrow(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '='
        if self.peek() == Some('=') {
            self.advance();
            Ok(Token::EqEq)
        } else if self.peek() == Some('>') {
            self.advance();
            Ok(Token::Arrow)
        } else {
            Ok(Token::Eq)
        }
    }

    fn not_or_ne(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '!'
        if self.peek() == Some('=') {
            self.advance();
            Ok(Token::Ne)
        } else {
            Ok(Token::Not)
        }
    }

    fn lt_or_le(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '<'
        if self.peek() == Some('=') {
            self.advance();
            Ok(Token::Le)
        } else {
            Ok(Token::Lt)
        }
    }

    fn gt_or_ge(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '>'
        if self.peek() == Some('=') {
            self.advance();
            Ok(Token::Ge)
        } else {
            Ok(Token::Gt)
        }
    }

    fn and(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '&'
        if self.peek() == Some('&') {
            self.advance();
            Ok(Token::And)
        } else {
            Err(GmlError::LexerError {
                position: self.position,
                message: "Expected '&&'".to_string(),
            })
        }
    }

    fn or(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '|'
        if self.peek() == Some('|') {
            self.advance();
            Ok(Token::Or)
        } else {
            Err(GmlError::LexerError {
                position: self.position,
                message: "Expected '||'".to_string(),
            })
        }
    }

    fn dot_or_spread(&mut self) -> GmlResult<Token> {
        self.advance(); // consume '.'
        if self.peek() == Some('.') {
            self.advance();
            if self.peek() == Some('.') {
                self.advance();
                Ok(Token::Spread)
            } else {
                Err(GmlError::LexerError {
                    position: self.position,
                    message: "Expected '...'".to_string(),
                })
            }
        } else {
            Ok(Token::Dot)
        }
    }

    fn string(&mut self) -> GmlResult<Token> {
        self.advance(); // consume opening quote
        let mut value = String::new();

        loop {
            match self.advance() {
                Some((_, '\'')) => break,
                Some((_, '\\')) => {
                    // Escape sequence
                    match self.advance() {
                        Some((_, 'n')) => value.push('\n'),
                        Some((_, 't')) => value.push('\t'),
                        Some((_, 'r')) => value.push('\r'),
                        Some((_, '\\')) => value.push('\\'),
                        Some((_, '\'')) => value.push('\''),
                        Some((_, ch)) => value.push(ch),
                        None => {
                            return Err(GmlError::LexerError {
                                position: self.position,
                                message: "Unexpected end of input in string".to_string(),
                            });
                        }
                    }
                }
                Some((_, ch)) => value.push(ch),
                None => {
                    return Err(GmlError::LexerError {
                        position: self.position,
                        message: "Unterminated string".to_string(),
                    });
                }
            }
        }

        Ok(Token::String(value))
    }

    fn template(&mut self) -> GmlResult<Token> {
        self.advance(); // consume opening backtick
        let mut value = String::new();

        loop {
            match self.advance() {
                Some((_, '`')) => break,
                Some((_, '\\')) => {
                    // Escape sequence
                    match self.advance() {
                        Some((_, ch)) => {
                            value.push('\\');
                            value.push(ch);
                        }
                        None => {
                            return Err(GmlError::LexerError {
                                position: self.position,
                                message: "Unexpected end of input in template".to_string(),
                            });
                        }
                    }
                }
                Some((_, ch)) => value.push(ch),
                None => {
                    return Err(GmlError::LexerError {
                        position: self.position,
                        message: "Unterminated template string".to_string(),
                    });
                }
            }
        }

        Ok(Token::Template(value))
    }

    fn number(&mut self) -> GmlResult<Token> {
        let start = self.position;
        let mut has_dot = false;

        while let Some(&(pos, ch)) = self.chars.peek() {
            if ch.is_ascii_digit() {
                self.advance();
            } else if ch == '.' && !has_dot {
                // 需要区分小数点和方法调用：如果 '.' 后面是数字，则是浮点数；否则是方法调用
                // 例如 "3.14" 是浮点数，而 "arr.length()" 中的 '.' 是方法调用
                let next_pos = pos + 1;
                if next_pos < self.input.len() {
                    let next_ch = self.input[next_pos..].chars().next();
                    if let Some(c) = next_ch
                        && c.is_ascii_digit()
                    {
                        has_dot = true;
                        self.advance();
                        continue;
                    }
                }
                break;
            } else {
                break;
            }
        }

        let end = self
            .chars
            .peek()
            .map(|&(pos, _)| pos)
            .unwrap_or(self.input.len());
        let text = &self.input[start..end];

        if has_dot {
            let f: f64 = text.parse().map_err(|_| GmlError::LexerError {
                position: start,
                message: format!("Invalid float: {}", text),
            })?;
            Ok(Token::Float(f))
        } else {
            let i: i64 = text.parse().map_err(|_| GmlError::LexerError {
                position: start,
                message: format!("Invalid integer: {}", text),
            })?;
            Ok(Token::Int(i))
        }
    }

    fn ident(&mut self) -> GmlResult<Token> {
        let start = self.position;

        while let Some(&(_, ch)) = self.chars.peek() {
            if ch.is_alphanumeric() || ch == '_' {
                self.advance();
            } else {
                break;
            }
        }

        let end = self
            .chars
            .peek()
            .map(|&(pos, _)| pos)
            .unwrap_or(self.input.len());
        let text = &self.input[start..end];

        let token = match text {
            "null" => Token::Null,
            "true" => Token::Bool(true),
            "false" => Token::Bool(false),
            "this" => Token::This,
            "return" => Token::Return,
            "CASE" => Token::Case,
            "WHEN" => Token::When,
            "THEN" => Token::Then,
            "ELSE" => Token::Else,
            "END" => Token::End,
            _ => Token::Ident(text.to_string()),
        };

        Ok(token)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_tokens() {
        let mut lexer = Lexer::new("+ - * / = == != < <= > >=");
        assert_eq!(lexer.next_token().unwrap(), Token::Plus);
        assert_eq!(lexer.next_token().unwrap(), Token::Minus);
        assert_eq!(lexer.next_token().unwrap(), Token::Star);
        assert_eq!(lexer.next_token().unwrap(), Token::Slash);
        assert_eq!(lexer.next_token().unwrap(), Token::Eq);
        assert_eq!(lexer.next_token().unwrap(), Token::EqEq);
        assert_eq!(lexer.next_token().unwrap(), Token::Ne);
        assert_eq!(lexer.next_token().unwrap(), Token::Lt);
        assert_eq!(lexer.next_token().unwrap(), Token::Le);
        assert_eq!(lexer.next_token().unwrap(), Token::Gt);
        assert_eq!(lexer.next_token().unwrap(), Token::Ge);
    }

    #[test]
    fn test_literals() {
        let mut lexer = Lexer::new("42 3.14 'hello' true false null");
        assert_eq!(lexer.next_token().unwrap(), Token::Int(42));
        assert_eq!(lexer.next_token().unwrap(), Token::Float(3.14));
        assert_eq!(lexer.next_token().unwrap(), Token::String("hello".into()));
        assert_eq!(lexer.next_token().unwrap(), Token::Bool(true));
        assert_eq!(lexer.next_token().unwrap(), Token::Bool(false));
        assert_eq!(lexer.next_token().unwrap(), Token::Null);
    }

    #[test]
    fn test_identifiers() {
        let mut lexer = Lexer::new("name user_id this CASE WHEN THEN ELSE END");
        assert_eq!(lexer.next_token().unwrap(), Token::Ident("name".into()));
        assert_eq!(lexer.next_token().unwrap(), Token::Ident("user_id".into()));
        assert_eq!(lexer.next_token().unwrap(), Token::This);
        assert_eq!(lexer.next_token().unwrap(), Token::Case);
        assert_eq!(lexer.next_token().unwrap(), Token::When);
        assert_eq!(lexer.next_token().unwrap(), Token::Then);
        assert_eq!(lexer.next_token().unwrap(), Token::Else);
        assert_eq!(lexer.next_token().unwrap(), Token::End);
    }

    #[test]
    fn test_arrow_and_spread() {
        let mut lexer = Lexer::new("=> ...");
        assert_eq!(lexer.next_token().unwrap(), Token::Arrow);
        assert_eq!(lexer.next_token().unwrap(), Token::Spread);
    }

    #[test]
    fn test_template() {
        let mut lexer = Lexer::new("`Hello ${name}`");
        assert_eq!(
            lexer.next_token().unwrap(),
            Token::Template("Hello ${name}".into())
        );
    }
}
