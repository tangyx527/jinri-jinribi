# 今日事今日毕 · Serene Today

> 一个纯净、清新的待办应用 — 平静、专注、每一天 🌿

纯原生 HTML/CSS/JS 构建的 PWA 待办清单，无任何第三方依赖，支持离线使用、桌面安装、数据导入导出。

<p align="center">
  <img src="icons/icon-192.png" width="96" height="96" alt="icon">
</p>

---

## ✨ 功能特性

| 模块 | 说明 |
|---|---|
| 📝 **任务管理** | 按「工作/生活」分类、「常规/重要/紧急」优先级快速添加任务 |
| ✅ **完成高亮** | 勾选完成任务后卡片变绿色高亮，进度环实时反馈 |
| 👈 **左滑删除** | 原生手势左滑删除，弹性回弹动画，流畅跟手 |
| 📊 **行为统计** | 连续打卡天数、年度热力图、月度完成率图表 |
| 📂 **数据导入导出** | 一键导出/导入 JSON 文件，轻松跨设备迁移数据 |
| 📢 **更新公告** | 版本升级自动弹窗，已读版本号记忆，支持手动查看 |
| 📱 **PWA 离线安装** | 添加到手机/电脑桌面，离线可正常访问 |
| 🌙 **鼓励反馈** | 完成任务时随机鼓励语 + 庆祝撒花动画 |

---

## 🚀 快速开始

### 本地运行

```bash
# 克隆仓库
git clone https://github.com/tangyx527/jinri-jinribi.git
cd jinri-jinribi

# 启动本地服务器（PWA 需要 HTTPS 或 localhost）
npx serve .
# 或
python -m http.server 8080
```

浏览器打开 `http://localhost:8080` 即可使用。

### 添加到桌面

- **Chrome / Edge**：地址栏右侧 → 安装图标 → 安装
- **iOS Safari**：分享按钮 → 添加到主屏幕
- **Android Chrome**：菜单 → 添加到主屏幕

---

## 📁 项目结构

```
serene-today/
├── index.html          # 主应用（单文件，含全部 HTML/CSS/JS）
├── manifest.json       # PWA 应用清单
├── service-worker.js   # Service Worker 缓存策略
├── icons/
│   ├── icon-192.png    # 应用图标 192x192
│   └── icon-512.png    # 应用图标 512x512
└── README.md
```

> **零依赖**：仅 `index.html` 引入 Google Fonts（Inter 字体），离线时自动降级为系统字体。

---

## 🛠️ 技术栈

| 层面 | 技术选型 |
|---|---|
| 结构 | 纯 HTML5 语义化标签 |
| 样式 | 纯 CSS3 + CSS Variables（35+ 设计变量） |
| 逻辑 | 原生 ES5 JavaScript（兼容旧浏览器） |
| 存储 | `localStorage`（任务数据 + 行为记录 + 已读版本号） |
| 离线 | Service Worker 缓存优先策略 |
| PWA | Web App Manifest + `standalone` 模式 |
| 字体 | Google Fonts Inter（离线降级为 `system-ui`） |

---

## 🎨 设计风格

- **主题色**：浅绿清新 (`#22c55e`)，搭配淡绿背景 (`#f3fcef`)
- **圆角体系**：统一 `8px / 12px / 20px / 24px` 四级圆角
- **阴影层级**：统一 3 级阴影变量（卡片 / 浮动 / 模态）
- **动效**：弹性曲线 `cubic-bezier(0.16,1,0.3,1)` 统一所有过渡
- **移动端适配**：全面屏 `safe-area-inset` 适配，触摸 `:active` 反馈

---

## 🔄 版本发布

每次发布新版本时，需要同时更新以下两个位置的版本号：

```js
// index.html — 第 965 行
var APP_VERSION = 'serene-today-v2';   // 修改此处

// service-worker.js — 第 15 行
var CACHE_VERSION = 'serene-today-v2'; // 修改此处
```

两处版本号保持一致后：
- Service Worker 自动更新缓存
- 用户下次打开时自动弹出更新公告

---

## 📋 localStorage 键名说明

| 键名 | 用途 |
|---|---|
| `serene_logic_v2` | 核心数据（任务 + 历史记录） |
| `serene_announce_read_version` | 已读公告版本号 |
| `serene_last_date` | 上次访问日期（日更检测） |

---

## 🌐 浏览器兼容

| 平台 | 兼容性 |
|---|---|
| Chrome / Edge (桌面) | ✅ 完全支持 |
| Chrome / Edge (Android) | ✅ 完全支持 + PWA 安装 |
| Safari (macOS) | ✅ 完全支持 |
| Safari (iOS) | ✅ 完全支持 + 主屏幕添加 |
| Firefox | ✅ 基本支持（无 PWA 安装） |

---

## 🔍 PWA 安装排查指南

如果安装弹窗未出现，打开浏览器开发者工具（F12）→ Console 面板，根据日志输出逐项排查：

### 3 步快速排查法

| 步骤 | 检查项 | 控制台预期输出 | 不达标常见原因 |
|---|---|---|---|
| **1** | 安全上下文 | `✅ 安全上下文 \| https: 符合要求` | 未使用 HTTPS 或 localhost |
| **2** | manifest 加载 | `✅ manifest 必填字段 \| name=...` | manifest.json 404、字段缺失、图标尺寸不达标 |
| **3** | SW 注册 & 激活 | `✅ SW 注册成功 \| scope=... 状态=active` | SW 文件路径错误、注册失败、未激活 |
| **4** | 安装事件 | `✅ 安装事件已捕获 \| beforeinstallprompt 已触发` | 前面任一步不达标均会导致此事件不触发 |

### 常见不达标原因对照表

| 症状 | 控制台日志特征 | 解决方案 |
|---|---|---|
| manifest 文件 404 | `❌ manifest 文件加载 \| HTTP 404` | 检查 manifest.json 是否部署到正确路径 |
| 必填字段缺失 | `❌ manifest 必填字段 \| 缺少 name` | 补齐 name/short_name/start_url/icons/display 字段 |
| SW 注册失败 | `❌ SW 注册失败` | 检查 service-worker.js 路径，确认 HTTPS 环境 |
| 非 HTTPS 环境 | `❌ 安全上下文 \| 当前非 HTTPS` | 部署到 HTTPS 服务器，或本地使用 localhost |
| 5秒内未触发 | `❌ 安装事件未捕获` | 逐项检查前3步，全部达标后浏览器会触发 |
| 图标路径错误 | manifest 图标不显示 | 确保 icons 目录下 PNG 尺寸准确（192×192、512×512） |
| 重复安装 | display-mode 检测失效 | 检查 `isPwaInstalled()` 是否正确返回 true |

### Chromium PWA 可安装硬性标准

浏览器判定可安装需 **全部满足** 以下条件：

1. ✅ **HTTPS 或 localhost** — 页面必须通过安全上下文提供
2. ✅ **有效的 manifest.json** — 必须包含 `name`/`short_name`、`start_url`、`display: standalone`、`192×192` 和 `512×512` 两个 PNG 图标
3. ✅ **已注册且激活的 Service Worker** — 必须监听 `fetch` 事件并提供离线响应能力
4. ✅ **用户未重复安装** — 同一应用不能重复安装
5. ✅ **用户有足够的交互** — 浏览器可能要求用户在页面上有一定交互（非自动弹窗前提，但影响触发时机）

---

## 📄 License

MIT © 2024

---

<p align="center">
  <sub>平静地完成每一天 · 今日事，今日毕 🌱</sub>
</p>
