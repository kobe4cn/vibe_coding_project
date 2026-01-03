# A2UI Frontend

React + Lit 混合架构的 A2UI 前端实现。

## 技术栈

- **React 19** - UI 框架
- **Lit 3** - Web Components 渲染器
- **TanStack Query** - 服务端状态管理
- **React Router 7** - 路由
- **Tailwind CSS 4** - 样式
- **Vite 7** - 构建工具

## 架构

### 混合架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    A2UIProvider                          ││
│  │  ┌─────────────────────┐  ┌────────────────────────────┐││
│  │  │   A2UI Surface      │  │   React Components        │││
│  │  │   (Lit-based)       │  │   - TagSelector           │││
│  │  │   - Text            │  │   - Toast                 │││
│  │  │   - Button          │  │   - AppLayout             │││
│  │  │   - TextField       │  │   - 其他复杂交互组件       │││
│  │  │   - List/Card       │  │                           │││
│  │  │   - 简单 UI 渲染    │  │                           │││
│  │  └─────────────────────┘  └────────────────────────────┘││
│  │              ↕                       ↕                   ││
│  │         DataModel          React Query / useState        ││
│  │              ↕                       ↕                   ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              SSE / REST API (Rust Backend)          │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 页面类型

| 页面 | 类型 | 说明 |
|-----|------|-----|
| TicketsPage | 纯 A2UI | 列表展示，交互简单 |
| TicketDetailPage | 纯 A2UI | 详情展示 |
| TicketCreatePage | 纯 A2UI | 简单表单 |
| TicketEditPage | **混合** | 表单 + TagSelector |
| TagsPage | 纯 A2UI | 标签管理 |

## 快速开始

### 使用 yarn（推荐）

```bash
# 安装依赖
yarn

# 启动开发服务器
yarn dev

# 构建生产版本
yarn build
```

### 使用 npm

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 目录结构

```
src/
├── a2ui/                    # A2UI 核心模块
│   ├── types.ts             # A2UI v0.8 协议类型
│   ├── renderer/            # Lit 渲染器
│   │   ├── data-model.ts    # 数据模型（支持 React 订阅）
│   │   └── renderer.ts      # Lit Web Components
│   └── integration/         # React 集成层
│       ├── A2UIContext.tsx  # 状态桥接上下文
│       ├── A2UISurface.tsx  # React 包装组件
│       └── useA2UI.ts       # SSE 连接 Hook
├── components/              # React 组件
│   ├── common/              # 通用组件
│   │   └── Toast.tsx        # Toast 通知
│   ├── layout/              # 布局组件
│   │   └── AppLayout.tsx    # 应用布局
│   └── tag/                 # 标签相关组件
│       ├── TagBadge.tsx     # 标签徽章
│       └── TagSelector.tsx  # 标签选择器（复杂下拉）
├── pages/                   # 页面组件
│   ├── TicketsPage.tsx      # 工单列表（纯 A2UI）
│   ├── TicketDetailPage.tsx # 工单详情（纯 A2UI）
│   ├── TicketCreatePage.tsx # 创建工单（纯 A2UI）
│   ├── TicketEditPage.tsx   # 编辑工单（混合架构）
│   └── TagsPage.tsx         # 标签管理（纯 A2UI）
├── hooks/                   # 自定义 Hooks
│   └── useTicket.ts         # 工单 API Hooks
├── types/                   # TypeScript 类型
│   └── index.ts             # 业务类型定义
├── lib/                     # 工具函数
│   └── utils.ts             # 通用工具
└── styles/                  # 样式
    └── globals.css          # 全局样式（MotherDuck 主题）
```

## A2UI 使用指南

### 纯 A2UI 页面

```tsx
import { A2UISurface } from '@/a2ui';

function MyPage() {
  const handleAction = (action) => {
    // 处理 A2UI 动作
  };

  return (
    <A2UISurface
      surfaceId="my-surface"
      streamUrl="/api/a2ui/my/stream"
      actionUrl="/api/a2ui/my/action"
      onAction={handleAction}
    />
  );
}
```

### 混合架构页面

```tsx
import { A2UISurface, useA2UIContext, useA2UIValue } from '@/a2ui';
import { TagSelector } from '@/components/tag/TagSelector';

function HybridPage() {
  const { setValue, getValue } = useA2UIContext();
  const formValue = useA2UIValue<string>('/form/field');
  const [tags, setTags] = useState([]);

  return (
    <div>
      {/* A2UI 表单 */}
      <A2UISurface surfaceId="form" ... />

      {/* React 组件 */}
      <TagSelector
        selectedIds={tags}
        onChange={(ids) => {
          setTags(ids);
          setValue('/form/tags', ids.join(','));
        }}
      />
    </div>
  );
}
```

### 数据模型访问

```tsx
import { useA2UIValue, useA2UIState } from '@/a2ui';

function Component() {
  // 只读访问
  const value = useA2UIValue<string>('/path/to/value');

  // 读写访问（类似 useState）
  const [state, setState] = useA2UIState<string>('/path/to/state');
}
```

## 样式规范

### MotherDuck 主题

- **主色**: `#FFD93D` (黄色)
- **深色**: `#1E3A5F` (深蓝)
- **文字**: `#111827` (主) / `#6B7280` (次)
- **边框**: `#E5E7EB`
- **圆角**: 8px (按钮) / 12px (卡片)
- **字体**: Inter (正文) / JetBrains Mono (代码)

## 开发说明

### 添加新页面

1. 如果页面交互简单（列表、详情、简单表单），使用 **纯 A2UI**
2. 如果需要复杂组件（下拉搜索、文件上传等），使用 **混合架构**

### 添加新的 React 组件

只有以下情况需要 React 组件：
- 复杂交互逻辑（多级下拉、拖拽等）
- 需要本地状态管理
- 依赖第三方 React 库
- 复杂动画效果

### SSE 调试

打开浏览器开发者工具 → Network → 过滤 EventSource，查看 A2UI 消息流。

## 许可证

MIT
