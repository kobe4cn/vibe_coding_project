# 主题定制指南

## MotherDuck 风格

本项目采用 MotherDuck 风格主题，特点：

- **品牌黄**为主色调
- **深蓝**作为辅助色
- 温暖专业的整体感觉
- 现代简洁的设计语言

## 配色方案

### 主要颜色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--color-primary` | `#FFD93D` | 主按钮、高亮、品牌色 |
| `--color-primary-hover` | `#FFE566` | 主按钮悬停 |
| `--color-secondary` | `#1E3A5F` | 深色文字、导航 |
| `--color-accent` | `#D5E8F0` | 天蓝色装饰 |

### 功能颜色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--color-success` | `#10B981` | 成功状态、已完成 |
| `--color-warning` | `#F59E0B` | 警告、处理中 |
| `--color-error` | `#EF4444` | 错误、紧急 |
| `--color-info` | `#3B82F6` | 信息、待处理 |

### 中性色

| 变量 | 值 | 用途 |
|------|-----|------|
| `--color-white` | `#FFFFFF` | 卡片背景 |
| `--color-gray-50` | `#F9FAFB` | 页面背景 |
| `--color-gray-100` | `#F3F4F6` | 次要背景 |
| `--color-gray-200` | `#E5E7EB` | 边框 |
| `--color-gray-300` | `#D1D5DB` | 输入框边框 |
| `--color-gray-500` | `#6B7280` | 次要文字 |
| `--color-gray-700` | `#374151` | 主要文字 |
| `--color-gray-900` | `#111827` | 标题 |

## 字体

```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
```

### 字号层级

| 变量 | 值 | 用途 |
|------|-----|------|
| `--text-xs` | `12px` | 说明文字 |
| `--text-sm` | `14px` | 小号正文 |
| `--text-base` | `16px` | 正文 |
| `--text-lg` | `18px` | 大号正文 |
| `--text-xl` | `20px` | 小标题 |
| `--text-2xl` | `24px` | 二级标题 |
| `--text-3xl` | `30px` | 一级标题 |
| `--text-4xl` | `36px` | 页面标题 |

## 间距

基于 8px 网格系统：

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

## 圆角

```css
--radius-sm: 4px;     /* 小元件 */
--radius-md: 8px;     /* 按钮、输入框 */
--radius-lg: 12px;    /* 卡片 */
--radius-xl: 16px;    /* 大区块 */
--radius-full: 9999px; /* 胶囊、头像 */
```

## 阴影

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
```

## 状态徽章

### 票据状态

```css
[data-status="open"] {
  background: var(--color-info);  /* 蓝色 */
}

[data-status="in_progress"] {
  background: var(--color-warning);  /* 黄色 */
}

[data-status="completed"] {
  background: var(--color-success);  /* 绿色 */
}

[data-status="cancelled"] {
  background: var(--color-gray-400);  /* 灰色 */
}
```

### 优先级

```css
[data-priority="low"] {
  background: var(--color-gray-200);
}

[data-priority="medium"] {
  background: var(--color-info);
}

[data-priority="high"] {
  background: var(--color-warning);
}

[data-priority="urgent"] {
  background: var(--color-error);
}
```

## 自定义主题

修改 `client/index.html` 中的 CSS 变量：

```css
:root {
  /* 修改主色 */
  --color-primary: #YOUR_COLOR;

  /* 修改字体 */
  --font-sans: 'Your Font', sans-serif;

  /* 修改圆角 */
  --radius-md: 4px;  /* 更方正 */
}
```

## 深色模式

可通过媒体查询添加深色模式：

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-white: #1F2937;
    --color-gray-50: #111827;
    --color-gray-900: #F9FAFB;
    /* ... 其他颜色反转 */
  }
}
```

## 响应式设计

断点：

```css
@media (max-width: 768px) {
  :root {
    --text-4xl: 28px;
    --text-3xl: 24px;
    --text-2xl: 20px;
  }

  .main-content {
    padding: var(--space-4);
  }
}
```
