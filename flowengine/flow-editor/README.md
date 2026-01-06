# Flow Editor

基于 React 的可视化流程编辑器前端应用，用于设计和管理 FDL (Flow Definition Language) 工作流。

## 技术栈

### 核心框架

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 19.2.0 | UI 框架 |
| TypeScript | 5.9.x | 类型安全 |
| Vite | 7.2.4 | 构建工具，支持 HMR |
| Tailwind CSS | 4.1.x | 原子化 CSS 框架 |

### 主要依赖库

| 库 | 版本 | 用途 |
|---|------|------|
| @xyflow/react | 12.10.0 | 流程图画布和节点渲染 |
| @monaco-editor/react | 4.7.0 | YAML 代码编辑器 |
| zustand | 5.0.9 | 轻量级状态管理 |
| immer | 11.1.3 | 不可变数据更新 |
| react-router-dom | 7.11.0 | 路由管理 |
| dagre | 0.8.5 | 图布局自动排列算法 |
| js-yaml | 4.1.1 | YAML 解析和序列化 |
| idb-keyval | 6.2.2 | IndexedDB 本地存储 |
| uuid | 13.0.0 | UUID 生成 |

### 开发工具

| 工具 | 用途 |
|------|------|
| ESLint | 代码质量检查 |
| Prettier | 代码格式化 |
| Vitest | 单元测试框架 |
| Testing Library | React 组件测试 |

## 项目结构

```
src/
├── components/           # 组件目录
│   ├── canvas/          # 流程画布组件
│   │   └── FlowCanvas.tsx
│   ├── dialogs/         # 对话框组件
│   │   ├── InputsDialog.tsx    # 执行输入参数对话框
│   │   └── PublishDialog.tsx   # 流程发布对话框
│   ├── editor/          # 编辑器组件
│   │   └── YamlEditor.tsx      # Monaco YAML 编辑器
│   ├── nodes/           # 流程节点组件
│   │   └── index.tsx           # 节点类型注册
│   ├── panels/          # 侧边面板
│   │   ├── NodePalette.tsx     # 节点工具箱
│   │   └── PropertyPanel.tsx   # 属性编辑面板
│   ├── settings/        # 设置组件
│   ├── sync/            # 同步状态组件
│   └── ui/              # 基础 UI 组件
├── lib/                 # 工具库
│   ├── flowYamlConverter.ts    # Flow ↔ YAML 双向转换
│   ├── flowExport.ts           # 流程导出
│   ├── flowImport.ts           # 流程导入
│   ├── flowTemplates.ts        # 流程模板
│   ├── thumbnailGenerator.ts   # 缩略图生成
│   ├── versionHistory.ts       # 版本历史
│   └── storage/                # 存储层抽象
│       ├── backend-provider.ts # 后端 API 调用
│       └── types.ts            # 类型定义
├── pages/               # 页面组件
│   ├── FlowEditorPage.tsx      # 流程编辑器页面
│   ├── FlowListPage.tsx        # 流程列表页面
│   └── ToolsPage.tsx           # 工具/数据源管理页面
├── stores/              # Zustand 状态管理
│   ├── flowStore.ts            # 当前流程状态
│   ├── flowListStore.ts        # 流程列表状态
│   ├── editorStore.ts          # 编辑器状态（YAML、主题等）
│   ├── executeStore.ts         # 流程执行状态
│   └── debugStore.ts           # 调试状态
├── types/               # TypeScript 类型定义
│   └── flow.ts                 # 流程相关类型
├── hooks/               # 自定义 Hooks
├── services/            # 服务层
├── utils/               # 工具函数
├── App.tsx              # 应用入口
├── main.tsx             # React 挂载点
└── index.css            # 全局样式和主题变量
```

## 设计系统

### Material Design 3 主题

项目采用 Material Design 3 设计规范，支持亮色/暗色主题切换：

- **Surface 层级**：5 级表面颜色（container-lowest → container-highest）
- **色彩系统**：Primary、Secondary、Tertiary、Error 完整色板
- **间距系统**：基于 8px 网格（xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px）
- **圆角设计**：xs(4px) → full(圆形) 多级圆角
- **阴影层级**：5 级 Material 标准阴影

### 节点类型配色

| 节点类型 | 颜色 | 用途 |
|---------|------|------|
| exec | #b4a7ff | 执行节点 |
| mapping | #c9b6ff | 数据映射 |
| condition | #ffb77c | 条件判断 |
| switch | #ffa570 | 多分支选择 |
| delay | #a8c7fa | 延时等待 |
| each | #7dd3fc | 循环遍历 |
| loop | #5eead4 | 循环控制 |
| agent | #f9a8d4 | AI Agent |
| guard | #fca5a5 | 守卫节点 |
| approval | #86efac | 审批节点 |
| mcp | #93c5fd | MCP 调用 |
| handoff | #c4b5fd | 流程切换 |

### 图标

项目使用内联 SVG 图标，遵循 Material Design 图标规范：
- 24x24 标准尺寸
- 2px 描边粗细
- currentColor 继承颜色

## 功能特性

### 流程编辑器
- **可视化画布**：基于 @xyflow/react 的拖拽式节点编辑
- **YAML 编辑器**：Monaco Editor 支持语法高亮、自动补全、错误提示
- **双向同步**：画布和 YAML 实时双向同步
- **自动保存**：afterDelay 模式，编辑后 1.5 秒自动保存
- **自动布局**：Dagre 算法自动排列节点

### 流程管理
- **版本控制**：支持版本历史和回滚
- **导入导出**：支持 YAML/JSON 格式导入导出
- **流程模板**：内置常用流程模板
- **缩略图预览**：自动生成流程缩略图

### 执行功能
- **参数输入**：支持流程输入参数配置
- **实时结果**：显示执行状态和节点结果
- **输出过滤**：根据 args.out 定义过滤输出字段

## 环境配置

### 环境变量

创建 `.env` 或 `.env.local` 文件：

```bash
# 后端 API 地址
VITE_API_URL=http://localhost:3001/api
```

### 路径别名

项目配置了以下路径别名（vite.config.ts）：

```typescript
{
  '@': './src',
  '@fdl-parser': './packages/fdl-parser/src',
  '@fdl-runtime': './packages/fdl-runtime/src'
}
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

### 运行测试

```bash
# 交互式测试
npm run test

# 单次运行
npm run test:run

# 覆盖率报告
npm run test:coverage
```

### 代码检查

```bash
npm run lint
```

## 部署

### 静态部署

构建后的 `dist/` 目录可部署到任意静态文件服务器：

- Nginx
- Apache
- Vercel
- Netlify
- AWS S3 + CloudFront

### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name flow-editor.example.com;
    root /var/www/flow-editor/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker 部署

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 浏览器支持

- Chrome >= 90
- Firefox >= 90
- Safari >= 14
- Edge >= 90

## License

MIT
