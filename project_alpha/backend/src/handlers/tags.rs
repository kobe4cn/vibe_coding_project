use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    models::{CreateTagRequest, Tag, UpdateTagRequest},
};

pub async fn list_tags(pool: &PgPool) -> Result<Vec<Tag>> {
    let tags = sqlx::query_as::<_, Tag>("SELECT * FROM tags ORDER BY name")
        .fetch_all(pool)
        .await?;

    Ok(tags)
}

pub async fn create_tag(pool: &PgPool, req: CreateTagRequest) -> Result<Tag> {
    if req.name.trim().is_empty() {
        return Err(AppError::Validation("Tag name cannot be empty".into()));
    }

    // Validate color format
    let color = req.color.as_deref().unwrap_or("#6B7280");
    if !is_valid_hex_color(color) {
        return Err(AppError::Validation(format!(
            "Invalid color format: {}",
            color
        )));
    }

    // Check for duplicate name
    let existing = sqlx::query("SELECT id FROM tags WHERE name = $1")
        .bind(&req.name)
        .fetch_optional(pool)
        .await?;

    if existing.is_some() {
        return Err(AppError::Conflict(format!(
            "Tag with name '{}' already exists",
            req.name
        )));
    }

    let tag = sqlx::query_as::<_, Tag>(
        r#"
        INSERT INTO tags (name, color, icon, is_predefined)
        VALUES ($1, $2, $3, FALSE)
        RETURNING *
        "#,
    )
    .bind(&req.name)
    .bind(color)
    .bind(&req.icon)
    .fetch_one(pool)
    .await?;

    Ok(tag)
}

pub async fn get_tag(pool: &PgPool, id: Uuid) -> Result<Tag> {
    let tag = sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Tag {} not found", id)))?;

    Ok(tag)
}

/// 更新标签信息
///
/// 根据提供的 ID 更新标签的名称、颜色和图标。只更新请求中提供的字段，
/// 未提供的字段保持原值不变。
///
/// # 参数
/// * `pool` - 数据库连接池
/// * `id` - 要更新的标签 ID
/// * `req` - 包含更新字段的请求对象（所有字段都是可选的）
///
/// # 返回
/// * `Ok(Tag)` - 更新后的标签对象
/// * `Err(AppError::NotFound)` - 标签不存在
/// * `Err(AppError::Validation)` - 颜色格式无效
/// * `Err(AppError::Conflict)` - 标签名称已存在
pub async fn update_tag(pool: &PgPool, id: Uuid, req: UpdateTagRequest) -> Result<Tag> {
    // 验证标签是否存在，如果不存在则返回 NotFound 错误
    let _current = get_tag(pool, id).await?;

    // 如果提供了颜色值，验证颜色格式（必须是 #RRGGBB 格式的十六进制颜色）
    if let Some(ref color) = req.color {
        if !is_valid_hex_color(color) {
            return Err(AppError::Validation(format!(
                "Invalid color format: {}",
                color
            )));
        }
    }

    // 如果提供了名称，检查是否存在同名标签（排除当前标签）
    // 这确保标签名称的唯一性约束
    if let Some(ref name) = req.name {
        let existing = sqlx::query("SELECT id FROM tags WHERE name = $1 AND id != $2")
            .bind(name)
            .bind(id)
            .fetch_optional(pool)
            .await?;

        if existing.is_some() {
            return Err(AppError::Conflict(format!(
                "Tag with name '{}' already exists",
                name
            )));
        }
    }

    // 使用 COALESCE 函数实现部分更新：
    // - 如果请求中提供了值，则使用新值
    // - 如果请求中为 None，则保持数据库中的原值不变
    let tag = sqlx::query_as::<_, Tag>(
        r#"
        UPDATE tags
        SET name = COALESCE($2, name),
            color = COALESCE($3, color),
            icon = COALESCE($4, icon)
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&req.name)
    .bind(&req.color)
    .bind(&req.icon)
    .fetch_one(pool)
    .await?;

    Ok(tag)
}

pub async fn delete_tag(pool: &PgPool, id: Uuid) -> Result<()> {
    let tag = get_tag(pool, id).await?;

    if tag.is_predefined {
        return Err(AppError::BadRequest("Cannot delete predefined tags".into()));
    }

    sqlx::query("DELETE FROM tags WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}

fn is_valid_hex_color(color: &str) -> bool {
    if color.len() != 7 || !color.starts_with('#') {
        return false;
    }
    color[1..].chars().all(|c| c.is_ascii_hexdigit())
}
