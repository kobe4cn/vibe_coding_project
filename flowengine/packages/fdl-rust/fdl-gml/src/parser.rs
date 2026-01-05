//! GML Parser - parses tokens into AST

use crate::ast::*;
use crate::error::{GmlError, GmlResult};
use crate::lexer::{Lexer, Token};
use crate::value::Value;

/// GML Parser
pub struct Parser {
    tokens: Vec<Token>,
    position: usize,
}

impl Parser {
    /// Create a new parser from source code
    pub fn new(source: &str) -> GmlResult<Self> {
        let mut lexer = Lexer::new(source);
        let tokens = lexer.tokenize()?;
        Ok(Self {
            tokens,
            position: 0,
        })
    }

    /// Parse the entire script
    pub fn parse(&mut self) -> GmlResult<Script> {
        let mut statements = Vec::new();

        while !self.is_at_end() {
            let stmt = self.parse_statement()?;
            statements.push(stmt);

            // Consume optional comma between statements
            if self.check(&Token::Comma) {
                self.advance();
            }
        }

        Ok(Script { statements })
    }

    fn parse_statement(&mut self) -> GmlResult<Statement> {
        // Check for return statement
        if self.check(&Token::Return) {
            self.advance();
            let expr = self.parse_expression()?;
            return Ok(Statement::Return(expr));
        }

        // Check if this looks like an assignment
        if let Some(Token::Ident(name)) = self.peek().cloned() {
            // Check for $temp variable
            let (field, is_temp) = if self.check(&Token::Dollar) {
                self.advance();
                if let Some(Token::Ident(n)) = self.peek().cloned() {
                    self.advance();
                    (format!("${}", n), true)
                } else {
                    return Err(self.error("Expected identifier after $"));
                }
            } else {
                self.advance();
                (name, false)
            };

            // Check for assignment
            if self.check(&Token::Eq) {
                self.advance();
                let expr = self.parse_expression()?;
                return Ok(Statement::Assignment(Assignment {
                    field,
                    is_temp,
                    expression: expr,
                }));
            } else {
                // Not an assignment, backtrack
                self.position -= 1;
                if is_temp {
                    self.position -= 1;
                }
            }
        }

        // Parse as expression
        let expr = self.parse_expression()?;
        Ok(Statement::Expression(expr))
    }

    fn parse_expression(&mut self) -> GmlResult<Expression> {
        self.parse_ternary()
    }

    fn parse_ternary(&mut self) -> GmlResult<Expression> {
        let expr = self.parse_or()?;

        if self.check(&Token::Question) {
            self.advance();
            let then_branch = self.parse_expression()?;
            self.expect(&Token::Colon)?;
            let else_branch = self.parse_expression()?;
            return Ok(Expression::Ternary {
                condition: Box::new(expr),
                then_branch: Box::new(then_branch),
                else_branch: Box::new(else_branch),
            });
        }

        Ok(expr)
    }

    fn parse_or(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_and()?;

        while self.check(&Token::Or) {
            self.advance();
            let right = self.parse_and()?;
            left = Expression::Binary {
                left: Box::new(left),
                op: BinaryOp::Or,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_and(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_equality()?;

        while self.check(&Token::And) {
            self.advance();
            let right = self.parse_equality()?;
            left = Expression::Binary {
                left: Box::new(left),
                op: BinaryOp::And,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_equality(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_comparison()?;

        loop {
            let op = match self.peek() {
                Some(Token::EqEq) => BinaryOp::Eq,
                Some(Token::Ne) => BinaryOp::Ne,
                _ => break,
            };
            self.advance();
            let right = self.parse_comparison()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_comparison(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_additive()?;

        loop {
            let op = match self.peek() {
                Some(Token::Lt) => BinaryOp::Lt,
                Some(Token::Le) => BinaryOp::Le,
                Some(Token::Gt) => BinaryOp::Gt,
                Some(Token::Ge) => BinaryOp::Ge,
                _ => break,
            };
            self.advance();
            let right = self.parse_additive()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_additive(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_multiplicative()?;

        loop {
            let op = match self.peek() {
                Some(Token::Plus) => BinaryOp::Add,
                Some(Token::Minus) => BinaryOp::Sub,
                _ => break,
            };
            self.advance();
            let right = self.parse_multiplicative()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> GmlResult<Expression> {
        let mut left = self.parse_unary()?;

        loop {
            let op = match self.peek() {
                Some(Token::Star) => BinaryOp::Mul,
                Some(Token::Slash) => BinaryOp::Div,
                Some(Token::Percent) => BinaryOp::Mod,
                _ => break,
            };
            self.advance();
            let right = self.parse_unary()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }

        Ok(left)
    }

    fn parse_unary(&mut self) -> GmlResult<Expression> {
        match self.peek() {
            Some(Token::Not) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    op: UnaryOp::Not,
                    operand: Box::new(operand),
                })
            }
            Some(Token::Minus) => {
                self.advance();
                let operand = self.parse_unary()?;
                Ok(Expression::Unary {
                    op: UnaryOp::Neg,
                    operand: Box::new(operand),
                })
            }
            _ => self.parse_postfix(),
        }
    }

    fn parse_postfix(&mut self) -> GmlResult<Expression> {
        let mut expr = self.parse_primary()?;

        loop {
            if self.check(&Token::Dot) {
                self.advance();
                if let Some(Token::Ident(method)) = self.peek().cloned() {
                    self.advance();
                    if self.check(&Token::LParen) {
                        // Method call
                        self.advance();
                        let args = self.parse_args()?;
                        self.expect(&Token::RParen)?;
                        expr = Expression::MethodCall {
                            target: Box::new(expr),
                            method,
                            args,
                        };
                    } else {
                        // Property access - convert to variable path
                        expr = match expr {
                            Expression::Variable(mut path) => {
                                path.push(method);
                                Expression::Variable(path)
                            }
                            _ => Expression::MethodCall {
                                target: Box::new(expr),
                                method,
                                args: vec![],
                            },
                        };
                    }
                } else {
                    return Err(self.error("Expected identifier after '.'"));
                }
            } else if self.check(&Token::LBracket) {
                self.advance();
                let index = if self.check(&Token::Hash) {
                    self.advance();
                    IndexType::Last
                } else {
                    let idx_expr = self.parse_expression()?;
                    match idx_expr {
                        Expression::Literal(Value::Int(i)) => IndexType::Number(i),
                        _ => IndexType::Expression(Box::new(idx_expr)),
                    }
                };
                self.expect(&Token::RBracket)?;
                expr = Expression::Index {
                    target: Box::new(expr),
                    index,
                };
            } else {
                break;
            }
        }

        Ok(expr)
    }

    fn parse_primary(&mut self) -> GmlResult<Expression> {
        match self.peek().cloned() {
            // Literals
            Some(Token::Null) => {
                self.advance();
                Ok(Expression::Literal(Value::Null))
            }
            Some(Token::Bool(b)) => {
                self.advance();
                Ok(Expression::Literal(Value::Bool(b)))
            }
            Some(Token::Int(i)) => {
                self.advance();
                Ok(Expression::Literal(Value::Int(i)))
            }
            Some(Token::Float(f)) => {
                self.advance();
                Ok(Expression::Literal(Value::Float(f)))
            }
            Some(Token::String(s)) => {
                self.advance();
                Ok(Expression::Literal(Value::String(s)))
            }

            // Template string
            Some(Token::Template(t)) => {
                self.advance();
                self.parse_template_parts(&t)
            }

            // This reference
            Some(Token::This) => {
                self.advance();
                let mut path = Vec::new();
                while self.check(&Token::Dot) {
                    self.advance();
                    if let Some(Token::Ident(name)) = self.peek().cloned() {
                        self.advance();
                        path.push(name);
                    } else {
                        return Err(self.error("Expected identifier after 'this.'"));
                    }
                }
                Ok(Expression::This(path))
            }

            // Spread operator
            Some(Token::Spread) => {
                self.advance();
                let expr = self.parse_postfix()?;
                Ok(Expression::Spread(Box::new(expr)))
            }

            // CASE expression
            Some(Token::Case) => self.parse_case(),

            // Identifier (variable or function call)
            Some(Token::Ident(name)) => {
                self.advance();
                if self.check(&Token::LParen) {
                    // Function call
                    self.advance();
                    let args = self.parse_args()?;
                    self.expect(&Token::RParen)?;
                    Ok(Expression::FunctionCall { name, args })
                } else if self.check(&Token::Arrow) {
                    // Lambda: `item => expr`
                    self.advance();
                    let body = self.parse_expression()?;
                    Ok(Expression::Lambda {
                        params: vec![name],
                        body: Box::new(body),
                    })
                } else {
                    // Variable - only parse simple property access here
                    // Method calls (with parentheses) are handled by parse_postfix
                    let mut path = vec![name];
                    while self.check(&Token::Dot) {
                        // Peek ahead to see if this is a method call
                        let dot_pos = self.position;
                        self.advance(); // consume '.'
                        if let Some(Token::Ident(n)) = self.peek().cloned() {
                            // Look one more ahead to check for method call
                            self.advance(); // consume identifier
                            if self.check(&Token::LParen) {
                                // This is a method call - backtrack and let parse_postfix handle it
                                self.position = dot_pos;
                                break;
                            }
                            // Not a method call, add to path
                            path.push(n);
                        } else {
                            return Err(self.error("Expected identifier after '.'"));
                        }
                    }
                    Ok(Expression::Variable(path))
                }
            }

            // Grouped expression or lambda
            Some(Token::LParen) => {
                self.advance();
                // Check for lambda: `(a, b) => expr`
                if let Some(Token::Ident(_)) = self.peek() {
                    let mut params = Vec::new();
                    loop {
                        if let Some(Token::Ident(name)) = self.peek().cloned() {
                            self.advance();
                            params.push(name);
                            if self.check(&Token::Comma) {
                                self.advance();
                            } else {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    if self.check(&Token::RParen) {
                        self.advance();
                        if self.check(&Token::Arrow) {
                            self.advance();
                            let body = self.parse_expression()?;
                            return Ok(Expression::Lambda {
                                params,
                                body: Box::new(body),
                            });
                        }
                    }
                    // Not a lambda, backtrack
                    self.position -= params.len();
                    if params.len() > 1 {
                        self.position -= params.len() - 1; // commas
                    }
                }
                let expr = self.parse_expression()?;
                self.expect(&Token::RParen)?;
                Ok(expr)
            }

            // Array literal
            Some(Token::LBracket) => {
                self.advance();
                let mut elements = Vec::new();
                while !self.check(&Token::RBracket) && !self.is_at_end() {
                    elements.push(self.parse_expression()?);
                    if !self.check(&Token::RBracket) {
                        self.expect(&Token::Comma)?;
                    }
                }
                self.expect(&Token::RBracket)?;
                Ok(Expression::ArrayLiteral(elements))
            }

            // Object literal
            Some(Token::LBrace) => {
                self.advance();
                let mut fields = Vec::new();
                while !self.check(&Token::RBrace) && !self.is_at_end() {
                    let field = self.parse_object_field()?;
                    fields.push(field);
                    if !self.check(&Token::RBrace) {
                        if self.check(&Token::Comma) {
                            self.advance();
                        }
                    }
                }
                self.expect(&Token::RBrace)?;
                Ok(Expression::ObjectLiteral(fields))
            }

            Some(Token::Eof) => Err(self.error("Unexpected end of input")),
            _ => Err(self.error("Unexpected token")),
        }
    }

    fn parse_case(&mut self) -> GmlResult<Expression> {
        self.expect(&Token::Case)?;
        let mut branches = Vec::new();
        let mut else_branch = None;

        loop {
            if self.check(&Token::When) {
                self.advance();
                let when = self.parse_expression()?;
                self.expect(&Token::Then)?;
                let then = self.parse_expression()?;
                branches.push(CaseBranch { when, then });
            } else if self.check(&Token::Else) {
                self.advance();
                else_branch = Some(Box::new(self.parse_expression()?));
                break;
            } else if self.check(&Token::End) {
                break;
            } else {
                return Err(self.error("Expected WHEN, ELSE, or END in CASE expression"));
            }
        }

        self.expect(&Token::End)?;
        Ok(Expression::Case {
            branches,
            else_branch,
        })
    }

    fn parse_object_field(&mut self) -> GmlResult<ObjectField> {
        // Spread: `...expr`
        if self.check(&Token::Spread) {
            self.advance();
            let expr = self.parse_postfix()?;
            return Ok(ObjectField::Spread(expr));
        }

        // Named field or shorthand
        if let Some(Token::Ident(name)) = self.peek().cloned() {
            self.advance();
            if self.check(&Token::Eq) {
                self.advance();
                let value = self.parse_expression()?;
                Ok(ObjectField::Named { name, value })
            } else {
                Ok(ObjectField::Shorthand(name))
            }
        } else {
            Err(self.error("Expected field name in object literal"))
        }
    }

    fn parse_args(&mut self) -> GmlResult<Vec<Expression>> {
        let mut args = Vec::new();
        while !self.check(&Token::RParen) && !self.is_at_end() {
            args.push(self.parse_expression()?);
            if !self.check(&Token::RParen) {
                self.expect(&Token::Comma)?;
            }
        }
        Ok(args)
    }

    fn parse_template_parts(&mut self, template: &str) -> GmlResult<Expression> {
        let mut parts = Vec::new();
        let mut current = String::new();
        let mut chars = template.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '$' && chars.peek() == Some(&'{') {
                chars.next(); // consume '{'
                if !current.is_empty() {
                    parts.push(TemplatePart::Literal(std::mem::take(&mut current)));
                }

                // Collect expression
                let mut expr_str = String::new();
                let mut brace_count = 1;
                while let Some(c) = chars.next() {
                    if c == '{' {
                        brace_count += 1;
                        expr_str.push(c);
                    } else if c == '}' {
                        brace_count -= 1;
                        if brace_count == 0 {
                            break;
                        }
                        expr_str.push(c);
                    } else {
                        expr_str.push(c);
                    }
                }

                // Parse the expression
                let mut parser = Parser::new(&expr_str)?;
                let script = parser.parse()?;
                if let Some(Statement::Expression(expr)) = script.statements.into_iter().next() {
                    parts.push(TemplatePart::Expression(expr));
                }
            } else if ch == '\\' {
                // Handle escape sequences
                if let Some(next) = chars.next() {
                    match next {
                        'n' => current.push('\n'),
                        't' => current.push('\t'),
                        'r' => current.push('\r'),
                        _ => current.push(next),
                    }
                }
            } else {
                current.push(ch);
            }
        }

        if !current.is_empty() {
            parts.push(TemplatePart::Literal(current));
        }

        Ok(Expression::Template(parts))
    }

    // Helper methods

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.position)
    }

    fn advance(&mut self) -> Option<&Token> {
        if !self.is_at_end() {
            self.position += 1;
        }
        self.tokens.get(self.position - 1)
    }

    fn check(&self, token: &Token) -> bool {
        self.peek()
            .map(|t| std::mem::discriminant(t) == std::mem::discriminant(token))
            .unwrap_or(false)
    }

    fn expect(&mut self, token: &Token) -> GmlResult<()> {
        if self.check(token) {
            self.advance();
            Ok(())
        } else {
            Err(self.error(&format!("Expected {:?}", token)))
        }
    }

    fn is_at_end(&self) -> bool {
        matches!(self.peek(), Some(Token::Eof) | None)
    }

    fn error(&self, message: &str) -> GmlError {
        GmlError::ParserError {
            position: self.position,
            message: message.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_assignment() {
        let mut parser = Parser::new("name = user.name").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_multiple_assignments() {
        let mut parser = Parser::new("a = 1, b = 2, c = 3").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 3);
    }

    #[test]
    fn test_parse_ternary() {
        let mut parser = Parser::new("x > 0 ? 'positive' : 'negative'").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_function_call() {
        let mut parser = Parser::new("SUM(items, 'amount')").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_method_call() {
        let mut parser = Parser::new("items.filter(i => i.active)").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_chained_methods() {
        let mut parser = Parser::new("items.filter(x => x.active).map(x => x.name)").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_array_literal() {
        let mut parser = Parser::new("[1, 2, 3]").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_object_literal() {
        let mut parser = Parser::new("{ name = 'test', value = 42 }").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }

    #[test]
    fn test_parse_spread() {
        let mut parser = Parser::new("{ ...source, extra = 1 }").unwrap();
        let script = parser.parse().unwrap();
        assert_eq!(script.statements.len(), 1);
    }
}
