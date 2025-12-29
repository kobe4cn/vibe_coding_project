# A2UI Ticket System Frontend

基于 A2UI v0.8 协议重构的票据管理系统前端，采用服务端驱动的 UI 渲染模式。

## 架构概述

```
┌─────────────────────────────────────────────────────────────┐
│                     a2ui_frontend                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Lit Renderer      │◄───│    A2UI Agent Server        │ │
│  │   (Browser Client)  │    │    (Python FastAPI)         │ │
│  │                     │    │                             │ │
│  │  - Surface 渲染     │    │  - JSONL 消息生成           │ │
│  │  - DataModel 管理   │    │  - userAction 处理          │ │
│  │  - userAction 发送  │    │  - 后端 API 代理            │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│            ▲                            │                   │
│            │ A2UI JSONL (SSE)           │                   │
│            └────────────────────────────┘                   │
│                                         │                   │
│                                         ▼ REST API          │
│                            ┌─────────────────────────────┐  │
│                            │    Existing Backend         │  │
│                            │    (Rust/Axum)              │  │
│                            └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 前置条件

- Python 3.11+
- Node.js 18+
- 后端服务运行在 `http://localhost:3000`

### 安装依赖

**服务端：**

```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**客户端：**

```bash
cd client
npm install
```

### 启动服务

**1. 启动后端服务（如尚未运行）：**

```bash
cd ../backend
cargo run
```

**2. 启动 A2UI Agent Server：**

```bash
cd server
python main.py
```

服务将在 `http://localhost:8080` 启动。

**3. 启动客户端开发服务器：**

```bash
cd client
npm run dev
```

客户端将在 `http://localhost:5173` 启动，自动代理 API 请求到 Agent Server。

### 生产构建

```bash
cd client
npm run build
```

构建产物会输出到 `client/dist`，Agent Server 会自动提供静态文件服务。

## 目录结构

```
a2ui_frontend/
├── server/                    # A2UI Agent Server
│   ├── main.py               # 主入口
│   ├── config.py             # 配置
│   ├── models.py             # 数据模型
│   ├── api_client.py         # 后端 API 客户端
│   ├── a2ui_builder.py       # A2UI 消息构建器
│   ├── pages/                # 页面构建器
│   │   ├── layout.py         # 布局组件
│   │   ├── tickets.py        # 票据页面
│   │   ├── tags.py           # 标签页面
│   │   └── error.py          # 错误页面
│   └── requirements.txt
│
├── client/                    # Lit Renderer Client
│   ├── src/
│   │   ├── main.ts           # 客户端入口
│   │   ├── renderer.ts       # A2UI 组件渲染器
│   │   ├── data-model.ts     # 数据模型管理
│   │   └── types.ts          # TypeScript 类型
│   ├── index.html            # HTML 模板 & 主题样式
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── docs/                      # 文档
│   ├── architecture.md       # 架构说明
│   ├── components.md         # 组件指南
│   ├── actions.md            # userAction 参考
│   └── theming.md            # 主题定制
│
└── README.md                  # 本文件
```

## 功能清单

- ✅ 票据列表（分页、搜索、状态/优先级筛选）
- ✅ 票据详情（查看、状态切换、删除确认）
- ✅ 票据创建/编辑
- ✅ 附件查看与下载
- ✅ 变更历史查看
- ✅ 标签管理（列表、创建、删除）
- ✅ MotherDuck 风格主题

## 配置

### 环境变量

创建 `server/.env` 文件：

```env
# 服务器配置
HOST=0.0.0.0
PORT=8080

# 后端 API 地址
BACKEND_URL=http://localhost:3000

# CORS 允许的源
CORS_ORIGINS=["http://localhost:5173","http://localhost:8080"]
```

## API 端点

### SSE 流式消息

- `GET /api/a2ui/stream?path=<page_path>` - 获取页面的 A2UI JSONL 消息流

### userAction 处理

- `POST /api/a2ui/action` - 处理用户交互事件

### 健康检查

- `GET /health` - 服务健康检查

## 主题

采用 MotherDuck 风格：

- **主色**: `#FFD93D` (品牌黄)
- **深蓝**: `#1E3A5F`
- **天蓝**: `#D5E8F0`
- **字体**: Inter (正文), JetBrains Mono (代码)
- **圆角**: 8-16px
- **网格**: 8px 基础间距

详见 `docs/theming.md`。

## 开发指南

### 添加新页面

1. 在 `server/pages/` 创建页面构建器
2. 在 `server/main.py` 添加路由
3. 定义相应的 userAction 处理逻辑

### 添加新组件

1. 在 `client/src/renderer.ts` 添加组件渲染逻辑
2. 在 `server/a2ui_builder.py` 添加构建器方法
3. 在 `client/index.html` 添加样式

## License

MIT
