//! GML 内置函数（UDF）
//!
//! 提供数学、字符串、日期、数组等常用操作的内置函数。
//! 函数注册表使用函数指针实现，支持运行时动态调用。

use crate::error::{GmlError, GmlResult};
use crate::value::Value;
use chrono::{DateTime, Duration, Local, NaiveDate, Utc};
use std::collections::HashMap;

/// 函数实现类型：接受参数数组，返回结果或错误
type FunctionImpl = fn(&[Value]) -> GmlResult<Value>;

/// 内置函数注册表
/// 
/// 在初始化时注册所有内置函数，提供统一的函数调用接口。
pub struct Functions {
    registry: HashMap<String, FunctionImpl>,
}

impl Default for Functions {
    fn default() -> Self {
        Self::new()
    }
}

impl Functions {
    /// Create a new functions registry with built-in functions
    pub fn new() -> Self {
        let mut registry: HashMap<String, FunctionImpl> = HashMap::new();

        // Math functions
        registry.insert("SUM".to_string(), fn_sum);
        registry.insert("AVG".to_string(), fn_avg);
        registry.insert("MIN".to_string(), fn_min);
        registry.insert("MAX".to_string(), fn_max);
        registry.insert("ROUND".to_string(), fn_round);
        registry.insert("FLOOR".to_string(), fn_floor);
        registry.insert("CEIL".to_string(), fn_ceil);
        registry.insert("ABS".to_string(), fn_abs);

        // String functions
        registry.insert("CONCAT".to_string(), fn_concat);
        registry.insert("UPPER".to_string(), fn_upper);
        registry.insert("LOWER".to_string(), fn_lower);
        registry.insert("TRIM".to_string(), fn_trim);
        registry.insert("LENGTH".to_string(), fn_length);
        registry.insert("SUBSTRING".to_string(), fn_substring);
        registry.insert("REPLACE".to_string(), fn_replace);
        registry.insert("SPLIT".to_string(), fn_split);

        // Date functions
        registry.insert("DATE".to_string(), fn_date);
        registry.insert("NOW".to_string(), fn_now);
        registry.insert("TIME".to_string(), fn_time);
        registry.insert("FORMAT_DATE".to_string(), fn_format_date);

        // Array functions
        registry.insert("COUNT".to_string(), fn_count);
        registry.insert("FIRST".to_string(), fn_first);
        registry.insert("LAST".to_string(), fn_last);

        // Type conversion
        registry.insert("INT".to_string(), fn_int);
        registry.insert("FLOAT".to_string(), fn_float);
        registry.insert("STRING".to_string(), fn_string);
        registry.insert("BOOL".to_string(), fn_bool);

        // Utility functions
        registry.insert("COALESCE".to_string(), fn_coalesce);
        registry.insert("IF".to_string(), fn_if);
        registry.insert("MD5".to_string(), fn_md5);

        Self { registry }
    }

    /// Call a function by name
    pub fn call(&self, name: &str, args: &[Value]) -> GmlResult<Value> {
        self.registry
            .get(name)
            .ok_or_else(|| GmlError::UndefinedFunction(name.to_string()))
            .and_then(|f| f(args))
    }
}

// Math functions

fn fn_sum(args: &[Value]) -> GmlResult<Value> {
    // SUM 函数支持两种模式：
    // 1. SUM(array, 'field') - 对数组中对象的指定字段求和
    // 2. SUM(a, b, c, ...) - 对多个数值求和
    if args.is_empty() {
        return Ok(Value::Float(0.0));
    }
    if let Some(Value::Array(arr)) = args.first() {
        // 数组模式：支持按字段求和，如 SUM(orders, 'amount')
        let field = args.get(1).and_then(|v| v.as_str());
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
    } else {
        // 多参数模式：直接对参数求和
        let sum: f64 = args.iter().filter_map(|v| v.as_float()).sum();
        Ok(Value::Float(sum))
    }
}

fn fn_avg(args: &[Value]) -> GmlResult<Value> {
    if let Some(Value::Array(arr)) = args.first() {
        if arr.is_empty() {
            return Ok(Value::Null);
        }
        let field = args.get(1).and_then(|v| v.as_str());
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
        if values.is_empty() {
            return Ok(Value::Null);
        }
        let avg = values.iter().sum::<f64>() / values.len() as f64;
        Ok(Value::Float(avg))
    } else {
        Err(GmlError::InvalidArgument(
            "AVG requires an array".to_string(),
        ))
    }
}

fn fn_min(args: &[Value]) -> GmlResult<Value> {
    if let Some(Value::Array(arr)) = args.first() {
        let field = args.get(1).and_then(|v| v.as_str());
        let min = arr
            .iter()
            .filter_map(|item| {
                if let Some(f) = field {
                    item.get(f).and_then(|v| v.as_float())
                } else {
                    item.as_float()
                }
            })
            .min_by(|a, b| a.partial_cmp(b).unwrap());
        Ok(min.map(Value::Float).unwrap_or(Value::Null))
    } else {
        let min = args
            .iter()
            .filter_map(|v| v.as_float())
            .min_by(|a, b| a.partial_cmp(b).unwrap());
        Ok(min.map(Value::Float).unwrap_or(Value::Null))
    }
}

fn fn_max(args: &[Value]) -> GmlResult<Value> {
    if let Some(Value::Array(arr)) = args.first() {
        let field = args.get(1).and_then(|v| v.as_str());
        let max = arr
            .iter()
            .filter_map(|item| {
                if let Some(f) = field {
                    item.get(f).and_then(|v| v.as_float())
                } else {
                    item.as_float()
                }
            })
            .max_by(|a, b| a.partial_cmp(b).unwrap());
        Ok(max.map(Value::Float).unwrap_or(Value::Null))
    } else {
        let max = args
            .iter()
            .filter_map(|v| v.as_float())
            .max_by(|a, b| a.partial_cmp(b).unwrap());
        Ok(max.map(Value::Float).unwrap_or(Value::Null))
    }
}

fn fn_round(args: &[Value]) -> GmlResult<Value> {
    let num = args
        .first()
        .and_then(|v| v.as_float())
        .ok_or(GmlError::InvalidArgument(
            "ROUND requires a number".to_string(),
        ))?;
    let decimals = args.get(1).and_then(|v| v.as_int()).unwrap_or(0);
    let factor = 10_f64.powi(decimals as i32);
    Ok(Value::Float((num * factor).round() / factor))
}

fn fn_floor(args: &[Value]) -> GmlResult<Value> {
    let num = args
        .first()
        .and_then(|v| v.as_float())
        .ok_or(GmlError::InvalidArgument(
            "FLOOR requires a number".to_string(),
        ))?;
    Ok(Value::Float(num.floor()))
}

fn fn_ceil(args: &[Value]) -> GmlResult<Value> {
    let num = args
        .first()
        .and_then(|v| v.as_float())
        .ok_or(GmlError::InvalidArgument(
            "CEIL requires a number".to_string(),
        ))?;
    Ok(Value::Float(num.ceil()))
}

fn fn_abs(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "ABS requires a number".to_string(),
    ))?;
    match val {
        Value::Int(i) => Ok(Value::Int(i.abs())),
        Value::Float(f) => Ok(Value::Float(f.abs())),
        _ => Err(GmlError::TypeError {
            expected: "number".to_string(),
            actual: val.type_name().to_string(),
        }),
    }
}

// String functions

fn fn_concat(args: &[Value]) -> GmlResult<Value> {
    let result: String = args
        .iter()
        .map(|v| match v {
            Value::String(s) => s.clone(),
            Value::Int(i) => i.to_string(),
            Value::Float(f) => f.to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Null => String::new(),
            _ => serde_json::to_string(v).unwrap_or_default(),
        })
        .collect();
    Ok(Value::String(result))
}

fn fn_upper(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "UPPER requires a string".to_string(),
        ))?;
    Ok(Value::String(s.to_uppercase()))
}

fn fn_lower(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "LOWER requires a string".to_string(),
        ))?;
    Ok(Value::String(s.to_lowercase()))
}

fn fn_trim(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "TRIM requires a string".to_string(),
        ))?;
    Ok(Value::String(s.trim().to_string()))
}

fn fn_length(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "LENGTH requires an argument".to_string(),
    ))?;
    match val {
        Value::String(s) => Ok(Value::Int(s.chars().count() as i64)),
        Value::Array(arr) => Ok(Value::Int(arr.len() as i64)),
        _ => Err(GmlError::TypeError {
            expected: "string or array".to_string(),
            actual: val.type_name().to_string(),
        }),
    }
}

fn fn_substring(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "SUBSTRING requires a string".to_string(),
        ))?;
    let start = args.get(1).and_then(|v| v.as_int()).unwrap_or(0) as usize;
    let len = args.get(2).and_then(|v| v.as_int());

    let chars: Vec<char> = s.chars().collect();
    let end = len.map(|l| start + l as usize).unwrap_or(chars.len());
    let result: String = chars
        .get(start..end.min(chars.len()))
        .unwrap_or(&[])
        .iter()
        .collect();
    Ok(Value::String(result))
}

fn fn_replace(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "REPLACE requires a string".to_string(),
        ))?;
    let from = args
        .get(1)
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "REPLACE requires search pattern".to_string(),
        ))?;
    let to = args.get(2).and_then(|v| v.as_str()).unwrap_or("");
    Ok(Value::String(s.replace(from, to)))
}

fn fn_split(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "SPLIT requires a string".to_string(),
        ))?;
    let sep = args.get(1).and_then(|v| v.as_str()).unwrap_or(",");
    let parts: Vec<Value> = s.split(sep).map(|p| Value::String(p.to_string())).collect();
    Ok(Value::Array(parts))
}

// Date functions

fn fn_date(args: &[Value]) -> GmlResult<Value> {
    if args.is_empty() {
        return Ok(Value::String(Local::now().to_rfc3339()));
    }

    let offset = args.first().and_then(|v| v.as_str()).unwrap_or("0d");
    let now = Local::now();
    let result = apply_date_offset(now, offset)?;
    Ok(Value::String(result.to_rfc3339()))
}

fn fn_now(_args: &[Value]) -> GmlResult<Value> {
    Ok(Value::String(Utc::now().to_rfc3339()))
}

fn fn_time(args: &[Value]) -> GmlResult<Value> {
    fn_date(args)
}

fn fn_format_date(args: &[Value]) -> GmlResult<Value> {
    let date_str = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "FORMAT_DATE requires a date".to_string(),
        ))?;
    let format = args.get(1).and_then(|v| v.as_str()).unwrap_or("%Y-%m-%d");

    // Try to parse as RFC3339 first
    if let Ok(dt) = DateTime::parse_from_rfc3339(date_str) {
        return Ok(Value::String(dt.format(format).to_string()));
    }

    // Try other common formats
    if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Ok(Value::String(date.format(format).to_string()));
    }

    Err(GmlError::InvalidArgument(format!(
        "Invalid date format: {}",
        date_str
    )))
}

fn apply_date_offset(dt: DateTime<Local>, offset: &str) -> GmlResult<DateTime<Local>> {
    // 解析日期偏移量字符串，格式如 "1d", "2w", "-3M" 等
    // 支持单位：s(秒), m(分钟), h(小时), d(天), w(周), M(月), y(年)
    let offset = offset.trim();
    if offset.is_empty() || offset == "0" {
        return Ok(dt);
    }

    // 分离数字和单位：如果以字母结尾，则最后一个是单位；否则默认为天
    let (num_str, unit) = if offset.ends_with(|c: char| c.is_alphabetic()) {
        let unit_start = offset.len() - 1;
        (&offset[..unit_start], &offset[unit_start..])
    } else {
        (offset, "d")
    };

    let num: i64 = num_str
        .parse()
        .map_err(|_| GmlError::InvalidArgument(format!("Invalid offset number: {}", num_str)))?;

    let duration = match unit {
        "s" => Duration::seconds(num),
        "m" => Duration::minutes(num),
        "h" => Duration::hours(num),
        "d" => Duration::days(num),
        "w" => Duration::weeks(num),
        // 注意：月和年使用近似值，因为月份和年份长度不固定
        "M" => Duration::days(num * 30),  // 近似月份（30天）
        "y" => Duration::days(num * 365), // 近似年份（365天）
        _ => {
            return Err(GmlError::InvalidArgument(format!(
                "Invalid offset unit: {}",
                unit
            )));
        }
    };

    Ok(dt + duration)
}

// Array functions

fn fn_count(args: &[Value]) -> GmlResult<Value> {
    let arr = args.first().ok_or(GmlError::InvalidArgument(
        "COUNT requires an argument".to_string(),
    ))?;
    match arr {
        Value::Array(a) => Ok(Value::Int(a.len() as i64)),
        _ => Ok(Value::Int(1)),
    }
}

fn fn_first(args: &[Value]) -> GmlResult<Value> {
    if let Some(Value::Array(arr)) = args.first() {
        Ok(arr.first().cloned().unwrap_or(Value::Null))
    } else {
        Ok(args.first().cloned().unwrap_or(Value::Null))
    }
}

fn fn_last(args: &[Value]) -> GmlResult<Value> {
    if let Some(Value::Array(arr)) = args.first() {
        Ok(arr.last().cloned().unwrap_or(Value::Null))
    } else {
        Ok(args.last().cloned().unwrap_or(Value::Null))
    }
}

// Type conversion functions

fn fn_int(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "INT requires an argument".to_string(),
    ))?;
    match val {
        Value::Int(i) => Ok(Value::Int(*i)),
        Value::Float(f) => Ok(Value::Int(*f as i64)),
        Value::String(s) => s
            .parse::<i64>()
            .map(Value::Int)
            .map_err(|_| GmlError::InvalidArgument(format!("Cannot convert '{}' to int", s))),
        Value::Bool(b) => Ok(Value::Int(if *b { 1 } else { 0 })),
        _ => Err(GmlError::TypeError {
            expected: "convertible to int".to_string(),
            actual: val.type_name().to_string(),
        }),
    }
}

fn fn_float(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "FLOAT requires an argument".to_string(),
    ))?;
    match val {
        Value::Int(i) => Ok(Value::Float(*i as f64)),
        Value::Float(f) => Ok(Value::Float(*f)),
        Value::String(s) => s
            .parse::<f64>()
            .map(Value::Float)
            .map_err(|_| GmlError::InvalidArgument(format!("Cannot convert '{}' to float", s))),
        _ => Err(GmlError::TypeError {
            expected: "convertible to float".to_string(),
            actual: val.type_name().to_string(),
        }),
    }
}

fn fn_string(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "STRING requires an argument".to_string(),
    ))?;
    let s = match val {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Int(i) => i.to_string(),
        Value::Float(f) => f.to_string(),
        Value::String(s) => s.clone(),
        _ => serde_json::to_string(val).unwrap_or_default(),
    };
    Ok(Value::String(s))
}

fn fn_bool(args: &[Value]) -> GmlResult<Value> {
    let val = args.first().ok_or(GmlError::InvalidArgument(
        "BOOL requires an argument".to_string(),
    ))?;
    Ok(Value::Bool(val.is_truthy()))
}

// Utility functions

fn fn_coalesce(args: &[Value]) -> GmlResult<Value> {
    for arg in args {
        if !arg.is_null() {
            return Ok(arg.clone());
        }
    }
    Ok(Value::Null)
}

fn fn_if(args: &[Value]) -> GmlResult<Value> {
    if args.len() < 3 {
        return Err(GmlError::InvalidArgument(
            "IF requires 3 arguments: condition, then, else".to_string(),
        ));
    }
    let condition = &args[0];
    let then_val = &args[1];
    let else_val = &args[2];

    if condition.is_truthy() {
        Ok(then_val.clone())
    } else {
        Ok(else_val.clone())
    }
}

fn fn_md5(args: &[Value]) -> GmlResult<Value> {
    let s = args
        .first()
        .and_then(|v| v.as_str())
        .ok_or(GmlError::InvalidArgument(
            "MD5 requires a string".to_string(),
        ))?;
    // 注意：这是简化的 MD5 实现，仅用于演示
    // 生产环境应使用标准的加密库（如 md5 crate）以确保安全性和正确性
    let hash = format!("{:x}", md5_hash(s.as_bytes()));
    Ok(Value::String(hash))
}

// 简化的 MD5 哈希实现（仅用于演示）
// 
// 警告：这不是真正的 MD5 算法，仅用于演示目的。
// 生产环境必须使用标准的 MD5 实现（如 md5 crate）。
fn md5_hash(data: &[u8]) -> u128 {
    // 这是占位符实现 - 生产环境应使用 md5 crate
    let mut hash: u128 = 0;
    for (i, &byte) in data.iter().enumerate() {
        hash = hash.wrapping_add((byte as u128).wrapping_mul((i as u128).wrapping_add(1)));
    }
    hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sum() {
        let result = fn_sum(&[Value::Int(1), Value::Int(2), Value::Int(3)]).unwrap();
        assert_eq!(result, Value::Float(6.0));
    }

    #[test]
    fn test_concat() {
        let result = fn_concat(&[
            Value::String("Hello".to_string()),
            Value::String(" ".to_string()),
            Value::String("World".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::String("Hello World".to_string()));
    }

    #[test]
    fn test_upper_lower() {
        let result = fn_upper(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result, Value::String("HELLO".to_string()));

        let result = fn_lower(&[Value::String("HELLO".to_string())]).unwrap();
        assert_eq!(result, Value::String("hello".to_string()));
    }

    #[test]
    fn test_coalesce() {
        let result = fn_coalesce(&[Value::Null, Value::String("default".to_string())]).unwrap();
        assert_eq!(result, Value::String("default".to_string()));

        let result = fn_coalesce(&[
            Value::String("first".to_string()),
            Value::String("second".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::String("first".to_string()));
    }
}
