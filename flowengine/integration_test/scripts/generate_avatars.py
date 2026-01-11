#!/usr/bin/env python3
"""生成头像图片并上传到 MinIO"""

import io
import random
from PIL import Image, ImageDraw, ImageFont
from minio import Minio
from minio.error import S3Error

# MinIO 配置
MINIO_ENDPOINT = "localhost:9000"
MINIO_ACCESS_KEY = "flowengine"
MINIO_SECRET_KEY = "flowengine123"
BUCKET_NAME = "customer-assets"
AVATAR_PATH = "avatars"

# 头像颜色调色板
COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
    "#F8B500", "#00CED1", "#FF69B4", "#32CD32", "#FF7F50",
    "#9370DB", "#20B2AA", "#FFD700", "#87CEEB", "#FA8072",
]


def generate_avatar(number: int, size: int = 200) -> bytes:
    """生成一个圆形头像图片"""
    # 选择颜色
    bg_color = COLORS[(number - 1) % len(COLORS)]

    # 创建图像
    img = Image.new('RGB', (size, size), color='white')
    draw = ImageDraw.Draw(img)

    # 画圆形背景
    margin = 10
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color)

    # 添加数字文本
    text = str(number)

    # 尝试使用系统字体，如果失败则使用默认字体
    font_size = size // 3
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()

    # 计算文本位置（居中）
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    # 绘制文本
    draw.text((x, y), text, fill='white', font=font)

    # 转换为 JPEG bytes
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=90)
    buffer.seek(0)
    return buffer.getvalue()


def main():
    # 创建 MinIO 客户端
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False
    )

    # 确保 bucket 存在
    if not client.bucket_exists(BUCKET_NAME):
        client.make_bucket(BUCKET_NAME)
        print(f"Created bucket: {BUCKET_NAME}")

    # 生成并上传 20 张头像
    print(f"Generating and uploading 20 avatars to {BUCKET_NAME}/{AVATAR_PATH}/...")

    for i in range(1, 21):
        # 生成头像
        avatar_data = generate_avatar(i)

        # 上传到 MinIO
        object_name = f"{AVATAR_PATH}/{i}.jpg"
        client.put_object(
            BUCKET_NAME,
            object_name,
            io.BytesIO(avatar_data),
            length=len(avatar_data),
            content_type="image/jpeg"
        )
        print(f"  Uploaded: {object_name}")

    print(f"\nDone! 20 avatars uploaded to minio://{BUCKET_NAME}/{AVATAR_PATH}/")
    print(f"View at: http://{MINIO_ENDPOINT}/{BUCKET_NAME}/{AVATAR_PATH}/")


if __name__ == "__main__":
    main()
