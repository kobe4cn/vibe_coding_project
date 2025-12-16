# Instructions

## project alpha 需求和设计文档

构建一个简单，使用标签分类和管理 ticket 的工具。
它基于 Postgres 数据库，使用 Rust 作为后端。
Rust 使用以下组件：
 - Axum 作为 web 框架。
 - Tokio 作为异步运行时。
 - Serde 作为 JSON 序列化器。
 - Sqlx 作为数据库客户端。
 - Tracing 作为追踪记录器。
 - Health 作为健康检查器。

使用 Typescript/Vite/Tailwind/Shadcn 作为前端。

整个管理工具目前暂时不需要用户登录和用户认证等权限管理。

当前用户可以：
 - 创建/编辑/删除/完成/取消完成 ticket
 - 添加/删除 ticket 的标签
 - 按照不同的标签查看 ticket 列表
 - 按 title 搜索 ticket

