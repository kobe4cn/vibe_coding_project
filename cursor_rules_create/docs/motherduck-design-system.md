# MotherDuck 网站设计风格指南

## Design System Overview

MotherDuck 的设计风格融合了科技专业感与俏皮可爱的品牌个性，以鸭子 (Duck) 为核心品牌元素，创造出既现代又亲和的视觉体验。

---

## 1. 色彩系统 (Color Palette)

### 主色调 (Primary Colors)

| 名称 | HEX | RGB | 用途 |
|------|-----|-----|------|
| **MotherDuck Yellow** | `#FFD93D` | 255, 217, 61 | 品牌主色、CTA 按钮、强调元素 |
| **MotherDuck Blue** | `#1E3A5F` | 30, 58, 95 | 深色背景、标题、导航 |
| **Sky Blue** | `#D5E8F0` | 213, 232, 240 | 表格头部、浅色卡片背景 |

### 中性色 (Neutral Colors)

| 名称 | HEX | 用途 |
|------|-----|------|
| **Pure White** | `#FFFFFF` | 主背景 |
| **Off White** | `#FAFAFA` | 卡片背景、区块分隔 |
| **Light Gray** | `#F5F5F5` | 次要背景 |
| **Border Gray** | `#E5E5E5` | 边框、分隔线 |
| **Text Gray** | `#6B7280` | 次要文字 |
| **Dark Gray** | `#374151` | 正文文字 |
| **Near Black** | `#111827` | 标题、重要文字 |

### 功能色 (Functional Colors)

| 名称 | HEX | 用途 |
|------|-----|------|
| **Success Green** | `#10B981` | 成功状态、勾选图标 |
| **Warning Orange** | `#F59E0B` | 警告提示 |
| **Error Red** | `#EF4444` | 错误状态 |
| **Info Blue** | `#3B82F6` | 链接、信息提示 |

### 渐变 (Gradients)

```css
/* Hero 区域背景渐变 */
.hero-gradient {
  background: linear-gradient(135deg, #1E3A5F 0%, #2D4A6F 50%, #3D5A7F 100%);
}

/* CTA 按钮悬停渐变 */
.cta-gradient {
  background: linear-gradient(135deg, #FFD93D 0%, #FFEA80 100%);
}

/* 卡片光泽效果 */
.card-shine {
  background: linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
}
```

---

## 2. 字体排版 (Typography)

### 字体家族 (Font Family)

```css
:root {
  /* 主字体 - 无衬线体 */
  --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  
  /* 代码字体 */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
}
```

### 字体大小比例 (Type Scale)

| 级别 | 桌面端 | 移动端 | 行高 | 字重 | 用途 |
|------|--------|--------|------|------|------|
| **H1 / Hero** | 56px / 3.5rem | 36px / 2.25rem | 1.1 | 700 | 页面主标题 |
| **H2 / Section** | 40px / 2.5rem | 28px / 1.75rem | 1.2 | 600 | 章节标题 |
| **H3 / Card** | 28px / 1.75rem | 22px / 1.375rem | 1.3 | 600 | 卡片标题 |
| **H4 / Subtitle** | 22px / 1.375rem | 18px / 1.125rem | 1.4 | 600 | 小标题 |
| **Body Large** | 18px / 1.125rem | 16px / 1rem | 1.6 | 400 | 特色段落 |
| **Body** | 16px / 1rem | 16px / 1rem | 1.7 | 400 | 正文 |
| **Body Small** | 14px / 0.875rem | 14px / 0.875rem | 1.6 | 400 | 辅助文字 |
| **Caption** | 12px / 0.75rem | 12px / 0.75rem | 1.5 | 400 | 注释、标签 |

### 字体样式类 (Typography Classes)

```css
/* 标题样式 */
.heading-hero {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #111827;
}

.heading-section {
  font-size: 2.5rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: #111827;
}

/* 正文样式 */
.body-text {
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.7;
  color: #374151;
}

/* 强调文本 */
.text-emphasis {
  font-weight: 600;
  color: #111827;
}

/* 链接样式 */
.text-link {
  color: #3B82F6;
  text-decoration: none;
  transition: color 0.2s ease;
}

.text-link:hover {
  color: #1E40AF;
  text-decoration: underline;
}
```

---

## 3. 间距系统 (Spacing System)

### 基础间距单位

采用 8px 网格系统，所有间距值都是 8 的倍数。

```css
:root {
  --space-1: 4px;    /* 0.25rem - 微小间距 */
  --space-2: 8px;    /* 0.5rem  - 极小间距 */
  --space-3: 12px;   /* 0.75rem - 小间距 */
  --space-4: 16px;   /* 1rem    - 基础间距 */
  --space-5: 20px;   /* 1.25rem */
  --space-6: 24px;   /* 1.5rem  - 中等间距 */
  --space-8: 32px;   /* 2rem    - 大间距 */
  --space-10: 40px;  /* 2.5rem */
  --space-12: 48px;  /* 3rem    - 区块间距 */
  --space-16: 64px;  /* 4rem    - 章节间距 */
  --space-20: 80px;  /* 5rem    - 大区块 */
  --space-24: 96px;  /* 6rem    - 页面区块 */
  --space-32: 128px; /* 8rem    - 超大区块 */
}
```

### 组件内部间距 (Padding)

| 组件类型 | Padding | 示例 |
|---------|---------|------|
| **按钮 (小)** | 8px 16px | `.btn-sm { padding: 0.5rem 1rem; }` |
| **按钮 (中)** | 12px 24px | `.btn-md { padding: 0.75rem 1.5rem; }` |
| **按钮 (大)** | 16px 32px | `.btn-lg { padding: 1rem 2rem; }` |
| **卡片** | 24px - 32px | `.card { padding: 1.5rem; }` |
| **输入框** | 12px 16px | `.input { padding: 0.75rem 1rem; }` |
| **表格单元格** | 16px 24px | `.td { padding: 1rem 1.5rem; }` |
| **导航项** | 8px 16px | `.nav-item { padding: 0.5rem 1rem; }` |

### 组件外部间距 (Margin)

| 场景 | 间距值 | CSS |
|------|--------|-----|
| **段落间距** | 16px - 24px | `margin-bottom: 1rem;` |
| **标题与内容** | 24px | `margin-bottom: 1.5rem;` |
| **卡片之间** | 24px - 32px | `gap: 1.5rem;` |
| **章节之间** | 64px - 96px | `margin-bottom: 4rem;` |
| **页面顶部** | 80px - 120px | `padding-top: 5rem;` |

---

## 4. 边框与圆角 (Border & Radius)

### 边框样式

```css
:root {
  /* 边框宽度 */
  --border-width-thin: 1px;
  --border-width-medium: 2px;
  --border-width-thick: 3px;

  /* 边框颜色 */
  --border-color-light: #E5E5E5;
  --border-color-medium: #D1D5DB;
  --border-color-dark: #9CA3AF;
  --border-color-focus: #FFD93D;
}

/* 常用边框样式 */
.border-default {
  border: 1px solid #E5E5E5;
}

.border-card {
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.border-input {
  border: 1px solid #D1D5DB;
}

.border-input:focus {
  border-color: #FFD93D;
  box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
}
```

### 圆角系统

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;      /* 小按钮、标签 */
  --radius-md: 8px;      /* 输入框、小卡片 */
  --radius-lg: 12px;     /* 卡片、模态框 */
  --radius-xl: 16px;     /* 大卡片、弹窗 */
  --radius-2xl: 24px;    /* 特色区块 */
  --radius-full: 9999px; /* 圆形、胶囊按钮 */
}

/* 组件圆角应用 */
.btn { border-radius: var(--radius-md); }
.card { border-radius: var(--radius-lg); }
.avatar { border-radius: var(--radius-full); }
.input { border-radius: var(--radius-md); }
.modal { border-radius: var(--radius-xl); }
.tag { border-radius: var(--radius-full); }
```

---

## 5. 阴影系统 (Shadow System)

```css
:root {
  /* 微妙阴影 - 卡片悬停前 */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  
  /* 轻阴影 - 按钮、输入框 */
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
               0 1px 2px -1px rgba(0, 0, 0, 0.1);
  
  /* 中等阴影 - 卡片默认 */
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
               0 2px 4px -2px rgba(0, 0, 0, 0.1);
  
  /* 明显阴影 - 卡片悬停 */
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
               0 4px 6px -4px rgba(0, 0, 0, 0.1);
  
  /* 强阴影 - 弹窗、下拉菜单 */
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
               0 8px 10px -6px rgba(0, 0, 0, 0.1);
  
  /* 超强阴影 - 模态框 */
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

  /* 品牌色阴影 */
  --shadow-yellow: 0 4px 14px 0 rgba(255, 217, 61, 0.3);
  --shadow-blue: 0 4px 14px 0 rgba(30, 58, 95, 0.2);
}

/* 卡片悬停效果 */
.card {
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-4px);
}
```

---

## 6. 组件设计 (Components)

### 6.1 按钮 (Buttons)

```css
/* 主要按钮 - CTA */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  background: #FFD93D;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: #FFEA80;
  box-shadow: var(--shadow-yellow);
  transform: translateY(-2px);
}

/* 次要按钮 */
.btn-secondary {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  background: transparent;
  border: 2px solid #E5E5E5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  border-color: #FFD93D;
  background: rgba(255, 217, 61, 0.1);
}

/* 幽灵按钮 */
.btn-ghost {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 500;
  color: #374151;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn-ghost:hover {
  background: #F5F5F5;
  color: #111827;
}

/* 链接按钮 */
.btn-link {
  padding: 0;
  font-size: 16px;
  font-weight: 500;
  color: #3B82F6;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: none;
}

.btn-link:hover {
  text-decoration: underline;
}
```

### 6.2 卡片 (Cards)

```css
/* 基础卡片 */
.card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

/* 特色卡片 - 带插图 */
.card-featured {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.card-featured:hover {
  transform: translateY(-8px);
  box-shadow: var(--shadow-xl);
}

/* 定价卡片 */
.card-pricing {
  background: #FFFFFF;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  border: 2px solid #E5E5E5;
  transition: all 0.3s ease;
}

.card-pricing.featured {
  border-color: #FFD93D;
  box-shadow: var(--shadow-yellow);
}

/* 深色卡片 */
.card-dark {
  background: #1E3A5F;
  border-radius: 16px;
  padding: 32px;
  color: #FFFFFF;
}
```

### 6.3 导航栏 (Navigation)

```css
/* 顶部导航 */
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 72px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  z-index: 1000;
}

/* 导航链接 */
.nav-link {
  padding: 8px 16px;
  font-size: 15px;
  font-weight: 500;
  color: #374151;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #111827;
  background: #F5F5F5;
}

/* 导航 CTA */
.nav-cta {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  background: #FFD93D;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.nav-cta:hover {
  background: #FFEA80;
}
```

### 6.4 输入框 (Inputs)

```css
/* 文本输入 */
.input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  color: #111827;
  background: #FFFFFF;
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.input::placeholder {
  color: #9CA3AF;
}

.input:focus {
  outline: none;
  border-color: #FFD93D;
  box-shadow: 0 0 0 3px rgba(255, 217, 61, 0.2);
}

/* 搜索输入 */
.input-search {
  padding-left: 44px;
  background-image: url("data:image/svg+xml,..."); /* 搜索图标 */
  background-repeat: no-repeat;
  background-position: 16px center;
}
```

### 6.5 表格 (Tables)

```css
.table {
  width: 100%;
  border-collapse: collapse;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.table th {
  padding: 16px 24px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  background: #D5E8F0;
  text-align: left;
  border-bottom: 1px solid #E5E5E5;
}

.table td {
  padding: 16px 24px;
  font-size: 14px;
  color: #374151;
  background: #FFFFFF;
  border-bottom: 1px solid #F3F4F6;
}

.table tr:hover td {
  background: #FAFAFA;
}

/* 比较表格 */
.table-compare th:first-child,
.table-compare td:first-child {
  position: sticky;
  left: 0;
  background: #FFFFFF;
  z-index: 1;
}
```

### 6.6 徽章与标签 (Badges & Tags)

```css
/* 徽章 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 9999px;
}

.badge-primary {
  color: #111827;
  background: #FFD93D;
}

.badge-secondary {
  color: #374151;
  background: #F3F4F6;
}

.badge-success {
  color: #065F46;
  background: #D1FAE5;
}

/* 标签 */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  background: #F3F4F6;
  border-radius: 6px;
}
```

### 6.7 FAQ 折叠面板 (Accordion)

```css
.accordion-item {
  border-bottom: 1px solid #E5E5E5;
}

.accordion-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.accordion-trigger:hover {
  color: #1E3A5F;
}

.accordion-content {
  padding: 0 0 20px;
  font-size: 16px;
  line-height: 1.7;
  color: #374151;
}
```

---

## 7. 布局系统 (Layout System)

### 容器宽度

```css
:root {
  --container-sm: 640px;   /* 紧凑内容 */
  --container-md: 768px;   /* 中等内容 */
  --container-lg: 1024px;  /* 标准内容 */
  --container-xl: 1280px;  /* 主容器 */
  --container-2xl: 1440px; /* 宽屏容器 */
}

.container {
  width: 100%;
  max-width: var(--container-xl);
  margin: 0 auto;
  padding: 0 24px;
}

@media (min-width: 768px) {
  .container {
    padding: 0 48px;
  }
}

@media (min-width: 1280px) {
  .container {
    padding: 0 64px;
  }
}
```

### 网格系统

```css
/* 响应式网格 */
.grid {
  display: grid;
  gap: 24px;
}

.grid-2 {
  grid-template-columns: repeat(1, 1fr);
}

.grid-3 {
  grid-template-columns: repeat(1, 1fr);
}

.grid-4 {
  grid-template-columns: repeat(1, 1fr);
}

@media (min-width: 640px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(2, 1fr); }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
}
```

### 区块结构

```css
/* 页面区块 */
.section {
  padding: 80px 0;
}

@media (min-width: 768px) {
  .section {
    padding: 120px 0;
  }
}

/* Hero 区块 */
.hero {
  padding: 120px 0 80px;
  min-height: 80vh;
  display: flex;
  align-items: center;
}

/* 特色区块 - 带背景 */
.section-featured {
  background: linear-gradient(135deg, #1E3A5F 0%, #2D4A6F 100%);
  color: #FFFFFF;
}
```

---

## 8. 动效系统 (Animation & Motion)

### 过渡时间

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
  
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### 常用动画

```css
/* 淡入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.5s var(--ease-out) forwards;
}

/* 滑入动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 缩放动画 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 浮动动画 - 用于插图 */
@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* 悬停效果 */
.hover-lift {
  transition: transform var(--duration-normal) var(--ease-out),
              box-shadow var(--duration-normal) var(--ease-out);
}

.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}
```

---

## 9. 插图风格 (Illustration Style)

MotherDuck 使用独特的手绘风格卡通鸭子插图作为品牌核心视觉元素。

### 插图特点

1. **鸭子角色设计**
   - 圆润可爱的体型
   - 明亮的黄色为主色
   - 橙色嘴巴和脚蹼
   - 友善的表情设计
   - 不同场景下有不同"职业装扮"（程序员鸭、科学家鸭、工程师鸭等）

2. **配色方案**
   - 主体：`#FFD93D` (黄色)
   - 嘴巴/脚：`#FF9500` (橙色)
   - 阴影：`#E6C235` (深黄)
   - 高光：`#FFFFFF`

3. **风格指南**
   - 扁平化设计，少量渐变
   - 柔和的阴影效果
   - 简洁的线条
   - 温暖友好的色调

### 使用场景

| 场景 | 插图类型 | 建议尺寸 |
|------|----------|----------|
| Hero 区域 | 大型场景插图 | 600-800px |
| 功能卡片 | 单一角色图标 | 120-200px |
| 空状态 | 表情丰富的鸭子 | 200-300px |
| 加载状态 | 动态鸭子动画 | 80-120px |
| 页脚 | 小型装饰图标 | 40-80px |

---

## 10. 响应式断点 (Responsive Breakpoints)

```css
/* 移动优先断点 */
:root {
  --breakpoint-sm: 640px;   /* 大手机/小平板 */
  --breakpoint-md: 768px;   /* 平板 */
  --breakpoint-lg: 1024px;  /* 小型桌面 */
  --breakpoint-xl: 1280px;  /* 桌面 */
  --breakpoint-2xl: 1536px; /* 大屏桌面 */
}

/* Tailwind 风格媒体查询 */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

### 响应式设计原则

1. **移动优先** - 从最小屏幕开始设计
2. **流式布局** - 使用相对单位 (%, rem, vw)
3. **断点堆叠** - 卡片网格在小屏时堆叠
4. **触摸友好** - 按钮最小点击区域 44x44px
5. **可读性** - 移动端文字不小于 16px

---

## 11. 代码块样式 (Code Styling)

```css
/* 行内代码 */
code {
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 0.875em;
  color: #1E3A5F;
  background: #F3F4F6;
  border-radius: 4px;
}

/* 代码块 */
pre {
  padding: 20px 24px;
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1.6;
  color: #E5E7EB;
  background: #1E3A5F;
  border-radius: 12px;
  overflow-x: auto;
}

pre code {
  padding: 0;
  background: none;
  color: inherit;
}

/* 语法高亮色彩 */
.token-keyword { color: #FFD93D; }
.token-string { color: #86EFAC; }
.token-comment { color: #9CA3AF; }
.token-function { color: #93C5FD; }
.token-number { color: #FCA5A5; }
```

---

## 12. 完整 CSS 变量汇总

```css
:root {
  /* 色彩 */
  --color-primary: #FFD93D;
  --color-primary-light: #FFEA80;
  --color-primary-dark: #E6C235;
  --color-secondary: #1E3A5F;
  --color-secondary-light: #2D4A6F;
  --color-accent: #D5E8F0;
  
  --color-text-primary: #111827;
  --color-text-secondary: #374151;
  --color-text-muted: #6B7280;
  
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #FAFAFA;
  --color-bg-tertiary: #F5F5F5;
  
  --color-border: #E5E5E5;
  --color-border-light: #F3F4F6;
  
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* 字体 */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* 间距 */
  --space-unit: 8px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition-normal: 200ms ease;
  --transition-slow: 300ms ease;
  
  /* 容器 */
  --container-max: 1280px;
  --container-padding: 24px;
}
```

---

## 13. Tailwind CSS 配置参考

如果使用 Tailwind CSS，可参考以下配置：

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'duck-yellow': {
          DEFAULT: '#FFD93D',
          light: '#FFEA80',
          dark: '#E6C235',
        },
        'duck-blue': {
          DEFAULT: '#1E3A5F',
          light: '#2D4A6F',
          dark: '#0F1F33',
        },
        'duck-sky': '#D5E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'yellow': '0 4px 14px 0 rgba(255, 217, 61, 0.3)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
      },
    },
  },
}
```

---

## 14. 设计原则总结

### 核心设计价值观

1. **Playful but Professional** - 俏皮但专业
   - 使用鸭子插图增添趣味，但保持整体专业感
   - 色彩明亮但不刺眼
   - 适度使用动效

2. **Simple & Clear** - 简洁清晰
   - 大量留白
   - 清晰的视觉层级
   - 一目了然的信息架构

3. **Warm & Approachable** - 温暖亲切
   - 暖色调的品牌黄
   - 友好的字体选择
   - 人性化的文案

4. **Technical Excellence** - 技术卓越
   - 代码块设计精致
   - 表格数据呈现清晰
   - 专业的技术文档风格

### 关键视觉元素

- 🦆 鸭子插图作为品牌符号
- 🟡 明亮的黄色作为主色调
- 📐 圆角设计 (12-16px)
- ✨ 微妙的阴影和悬停效果
- 📱 移动优先的响应式设计

---

*此设计系统基于 MotherDuck 官网分析创建，仅供学习参考使用。*
