use axum::extract::Multipart;
use sqlx::PgPool;
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

use crate::{
    config::Config,
    error::{AppError, Result},
    models::{Attachment, AttachmentResponse},
};

const ALLOWED_CONTENT_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_ATTACHMENTS_PER_TICKET: i64 = 20;

pub async fn list_attachments(pool: &PgPool, ticket_id: Uuid) -> Result<Vec<AttachmentResponse>> {
    let attachments = sqlx::query_as::<_, Attachment>(
        "SELECT * FROM attachments WHERE ticket_id = $1 ORDER BY created_at DESC",
    )
    .bind(ticket_id)
    .fetch_all(pool)
    .await?;

    Ok(attachments.into_iter().map(Into::into).collect())
}

pub async fn upload_attachment(
    pool: &PgPool,
    config: &Config,
    ticket_id: Uuid,
    mut multipart: Multipart,
) -> Result<AttachmentResponse> {
    // Verify ticket exists
    sqlx::query("SELECT id FROM tickets WHERE id = $1")
        .bind(ticket_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Ticket {} not found", ticket_id)))?;

    // Check attachment count
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM attachments WHERE ticket_id = $1")
        .bind(ticket_id)
        .fetch_one(pool)
        .await?;

    if count.0 >= MAX_ATTACHMENTS_PER_TICKET {
        return Err(AppError::BadRequest(format!(
            "Maximum {} attachments per ticket exceeded",
            MAX_ATTACHMENTS_PER_TICKET
        )));
    }

    // Process multipart upload
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read upload: {}", e)))?
        .ok_or_else(|| AppError::BadRequest("No file provided".into()))?;

    let filename = field
        .file_name()
        .map(String::from)
        .unwrap_or_else(|| "unknown".into());

    let content_type = field
        .content_type()
        .map(String::from)
        .unwrap_or_else(|| "application/octet-stream".into());

    // Validate content type
    if !ALLOWED_CONTENT_TYPES.contains(&content_type.as_str()) {
        return Err(AppError::UnsupportedMediaType(format!(
            "Content type '{}' not allowed",
            content_type
        )));
    }

    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to read file data: {}", e)))?;

    // Validate file size
    if data.len() > config.max_file_size {
        return Err(AppError::FileTooLarge);
    }

    // Create storage directory
    let storage_dir = PathBuf::from(&config.upload_dir)
        .join("attachments")
        .join(ticket_id.to_string());

    fs::create_dir_all(&storage_dir).await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to create upload directory: {}", e))
    })?;

    // Generate unique filename
    let file_id = Uuid::new_v4();
    let storage_filename = format!("{}_{}", file_id, filename);
    let storage_path = storage_dir.join(&storage_filename);

    // Write file
    let mut file = fs::File::create(&storage_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to create file: {}", e)))?;

    file.write_all(&data)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to write file: {}", e)))?;

    // Create database record
    let attachment = sqlx::query_as::<_, Attachment>(
        r#"
        INSERT INTO attachments (ticket_id, filename, storage_path, content_type, size_bytes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(ticket_id)
    .bind(&filename)
    .bind(storage_path.to_string_lossy().to_string())
    .bind(&content_type)
    .bind(data.len() as i64)
    .fetch_one(pool)
    .await?;

    Ok(attachment.into())
}

/// 获取附件文件内容
///
/// 根据附件 ID 从数据库中查询附件元数据，然后从文件系统中读取实际文件内容。
/// 返回附件元数据和文件的二进制数据。
///
/// # 参数
/// * `pool` - 数据库连接池
/// * `config` - 应用配置（当前未使用，保留用于未来扩展）
/// * `id` - 附件的 UUID
///
/// # 返回
/// * `Ok((Attachment, Vec<u8>))` - 附件元数据和文件二进制数据的元组
/// * `Err(AppError::NotFound)` - 附件不存在
/// * `Err(AppError::Internal)` - 文件读取失败
pub async fn get_attachment_file(
    pool: &PgPool,
    _config: &Config,
    id: Uuid,
) -> Result<(Attachment, Vec<u8>)> {
    // 从数据库查询附件元数据，如果不存在则返回 NotFound 错误
    let attachment = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Attachment {} not found", id)))?;

    // 根据存储路径从文件系统读取文件内容
    // 如果文件不存在或读取失败，返回 Internal 错误
    let file_bytes = fs::read(&attachment.storage_path)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to read file: {}", e)))?;

    Ok((attachment, file_bytes))
}

/// 删除附件
///
/// 删除指定 ID 的附件，包括：
/// 1. 从文件系统中删除物理文件
/// 2. 从数据库中删除附件记录
///
/// 注意：如果文件删除失败（例如文件已被手动删除），会记录警告但不会阻止
/// 数据库记录的删除，确保数据库和文件系统的一致性。
///
/// # 参数
/// * `pool` - 数据库连接池
/// * `config` - 应用配置（当前未使用，保留用于未来扩展）
/// * `id` - 要删除的附件 UUID
///
/// # 返回
/// * `Ok(())` - 删除成功
/// * `Err(AppError::NotFound)` - 附件不存在
pub async fn delete_attachment(pool: &PgPool, _config: &Config, id: Uuid) -> Result<()> {
    // 查询附件信息以获取文件存储路径
    // 如果附件不存在，直接返回 NotFound 错误
    let attachment = sqlx::query_as::<_, Attachment>("SELECT * FROM attachments WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Attachment {} not found", id)))?;

    // 尝试从文件系统删除物理文件
    // 如果删除失败（例如文件已被手动删除），记录警告但不中断流程
    // 这样可以确保即使文件系统出现问题，数据库记录也能被清理
    if let Err(e) = fs::remove_file(&attachment.storage_path).await {
        tracing::warn!("Failed to delete file {}: {}", attachment.storage_path, e);
    }

    // 从数据库中删除附件记录
    // 无论文件删除是否成功，都会执行数据库删除操作
    sqlx::query("DELETE FROM attachments WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    Ok(())
}
