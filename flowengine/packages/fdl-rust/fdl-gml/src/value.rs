//! GML 值类型
//!
//! 定义了 GML 语言中所有可能的值类型，支持 JSON 序列化/反序列化。
//! 使用 untagged 枚举实现，确保 JSON 格式的兼容性。

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// GML 值类型，表示 GML 中所有可能的值
/// 
/// 使用 untagged 枚举确保序列化为标准 JSON 格式（无类型标签）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(untagged)]
pub enum Value {
    /// Null value
    #[default]
    Null,
    /// Boolean value
    Bool(bool),
    /// Integer value (i64)
    Int(i64),
    /// Float value (f64)
    Float(f64),
    /// String value
    String(String),
    /// Array value
    Array(Vec<Value>),
    /// Object value
    Object(HashMap<String, Value>),
}

impl Value {
    /// Create a null value
    pub fn null() -> Self {
        Value::Null
    }

    /// Create a boolean value
    pub fn bool(b: bool) -> Self {
        Value::Bool(b)
    }

    /// Create an integer value
    pub fn int(i: i64) -> Self {
        Value::Int(i)
    }

    /// Create a float value
    pub fn float(f: f64) -> Self {
        Value::Float(f)
    }

    /// Create a string value
    pub fn string(s: impl Into<String>) -> Self {
        Value::String(s.into())
    }

    /// Create an array value
    pub fn array(arr: impl IntoIterator<Item = Value>) -> Self {
        Value::Array(arr.into_iter().collect())
    }

    /// Create an object value from key-value pairs
    pub fn object<K, V>(pairs: impl IntoIterator<Item = (K, V)>) -> Self
    where
        K: Into<String>,
        V: Into<Value>,
    {
        Value::Object(
            pairs
                .into_iter()
                .map(|(k, v)| (k.into(), v.into()))
                .collect(),
        )
    }

    /// Check if value is null
    pub fn is_null(&self) -> bool {
        matches!(self, Value::Null)
    }

    /// 检查值是否为真值（truthy）
    /// 
    /// GML 的真值规则：
    /// - Null: false
    /// - Bool: 直接使用布尔值
    /// - 数字: 0 为 false，非 0 为 true
    /// - 字符串: 空字符串为 false，非空为 true
    /// - 数组/对象: 空集合为 false，非空为 true
    pub fn is_truthy(&self) -> bool {
        match self {
            Value::Null => false,
            Value::Bool(b) => *b,
            Value::Int(i) => *i != 0,
            Value::Float(f) => *f != 0.0,
            Value::String(s) => !s.is_empty(),
            Value::Array(arr) => !arr.is_empty(),
            Value::Object(obj) => !obj.is_empty(),
        }
    }

    /// Get value as bool
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Value::Bool(b) => Some(*b),
            _ => None,
        }
    }

    /// Get value as i64
    pub fn as_int(&self) -> Option<i64> {
        match self {
            Value::Int(i) => Some(*i),
            Value::Float(f) => Some(*f as i64),
            _ => None,
        }
    }

    /// Get value as f64
    pub fn as_float(&self) -> Option<f64> {
        match self {
            Value::Int(i) => Some(*i as f64),
            Value::Float(f) => Some(*f),
            _ => None,
        }
    }

    /// Get value as string
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s),
            _ => None,
        }
    }

    /// Get value as array
    pub fn as_array(&self) -> Option<&Vec<Value>> {
        match self {
            Value::Array(arr) => Some(arr),
            _ => None,
        }
    }

    /// Get value as mutable array
    pub fn as_array_mut(&mut self) -> Option<&mut Vec<Value>> {
        match self {
            Value::Array(arr) => Some(arr),
            _ => None,
        }
    }

    /// Get value as object
    pub fn as_object(&self) -> Option<&HashMap<String, Value>> {
        match self {
            Value::Object(obj) => Some(obj),
            _ => None,
        }
    }

    /// Get value as mutable object
    pub fn as_object_mut(&mut self) -> Option<&mut HashMap<String, Value>> {
        match self {
            Value::Object(obj) => Some(obj),
            _ => None,
        }
    }

    /// Get a field from an object
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.as_object().and_then(|obj| obj.get(key))
    }

    /// Get an element from an array by index
    pub fn get_index(&self, index: usize) -> Option<&Value> {
        self.as_array().and_then(|arr| arr.get(index))
    }

    /// Get type name as string
    pub fn type_name(&self) -> &'static str {
        match self {
            Value::Null => "null",
            Value::Bool(_) => "bool",
            Value::Int(_) => "int",
            Value::Float(_) => "float",
            Value::String(_) => "string",
            Value::Array(_) => "array",
            Value::Object(_) => "object",
        }
    }
}

impl From<bool> for Value {
    fn from(b: bool) -> Self {
        Value::Bool(b)
    }
}

impl From<i32> for Value {
    fn from(i: i32) -> Self {
        Value::Int(i as i64)
    }
}

impl From<i64> for Value {
    fn from(i: i64) -> Self {
        Value::Int(i)
    }
}

impl From<f64> for Value {
    fn from(f: f64) -> Self {
        Value::Float(f)
    }
}

impl From<&str> for Value {
    fn from(s: &str) -> Self {
        Value::String(s.to_string())
    }
}

impl From<String> for Value {
    fn from(s: String) -> Self {
        Value::String(s)
    }
}

impl<T: Into<Value>> From<Vec<T>> for Value {
    fn from(arr: Vec<T>) -> Self {
        Value::Array(arr.into_iter().map(Into::into).collect())
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(opt: Option<T>) -> Self {
        match opt {
            Some(v) => v.into(),
            None => Value::Null,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_value_creation() {
        assert!(Value::null().is_null());
        assert_eq!(Value::bool(true).as_bool(), Some(true));
        assert_eq!(Value::int(42).as_int(), Some(42));
        assert_eq!(Value::float(3.14).as_float(), Some(3.14));
        assert_eq!(Value::string("hello").as_str(), Some("hello"));
    }

    #[test]
    fn test_value_truthy() {
        assert!(!Value::Null.is_truthy());
        assert!(!Value::Bool(false).is_truthy());
        assert!(Value::Bool(true).is_truthy());
        assert!(!Value::Int(0).is_truthy());
        assert!(Value::Int(1).is_truthy());
        assert!(!Value::String(String::new()).is_truthy());
        assert!(Value::String("hello".to_string()).is_truthy());
    }

    #[test]
    fn test_object_access() {
        let obj = Value::object([("name", Value::string("Alice")), ("age", Value::int(30))]);

        assert_eq!(obj.get("name"), Some(&Value::string("Alice")));
        assert_eq!(obj.get("age"), Some(&Value::int(30)));
        assert_eq!(obj.get("unknown"), None);
    }
}
