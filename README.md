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

## 🔄 版本发布（发版操作说明）

### 🎯 极简发版：只需修改一处版本号

每次发布新版本，**仅需修改以下两个文件中的版本号**，其余全部由 SW 自动处理：

```
1. service-worker.js → 第 12 行：var SW_VERSION = 'v3';  // 递增此处
2. index.html        → APP_VERSION 常量保持一致
```

### 📋 完整发版操作步骤

| 步骤 | 操作 | 说明 |
|---|---|---|
| **1** | 修改 `service-worker.js` 中的 `SW_VERSION` | 例如 `'v3'` → `'v4'`，同时更新 `SW_BUILD_TIME` |
| **2** | 修改 `index.html` 中的 `APP_VERSION` | 与 SW_VERSION **完全一致**，例如 `'v4'` |
| **3** | 提交并推送到 GitHub | `git add . && git commit -m "v4 发布" && git push` |
| **4** | （可选）验证更新 | 打开应用 → 统计页 → 点击「检查更新」按钮 |

> ⚠️ **重要**：`APP_VERSION` 必须与 `SW_VERSION` **完全一致**（均使用 `'v3'` 格式），否则每次刷新都会误判"有新版本"。

### ⚙️ SW 更新机制说明

```
用户打开页面
    ↓
浏览器检测到 service-worker.js 内容变化（SW_VERSION 不同）
    ↓
触发 updatefound → 安装新 SW → skipWaiting() 立即激活
    ↓
clients.claim() 接管所有已打开标签页
    ↓
向页面发送 SW_UPDATED 消息 → 顶部弹出绿色提示条
    ↓
用户点击「立即刷新」或自动刷新 → 新版本生效
```

### 🔧 关键配置（已内置，无需手动调整）

| 配置项 | 值 | 作用 |
|---|---|---|
| `updateViaCache` | `'none'` | **禁止浏览器 HTTP 缓存 SW 文件**，每次更新检查都重新拉取 |
| `self.skipWaiting()` | install 事件中调用 | 新 SW 安装完立即激活，不等旧 SW 退出 |
| `self.clients.claim()` | activate 事件中调用 | 激活后立即接管所有已打开页面 |
| 旧缓存清理 | activate 事件中遍历删除 | 自动删除所有非当前版本的缓存，杜绝垃圾残留 |
| 自动检查间隔 | 10 分钟 | 每 10 分钟自动 `reg.update()` 检查新版本 |
| 手动检查 | 统计页「检查更新」按钮 | 用户可随时主动触发 SW 更新检测 |

### 🐛 本地浏览器始终显示旧版本？排查清单

| 症状 | 原因 | 解决方案 |
|---|---|---|
| 修改 SW 后本地不更新 | 浏览器 HTTP 缓存了旧 SW 文件 | 已配置 `updateViaCache: 'none'`，但仍建议打开 DevTools → Application → Service Workers → 勾选 "Update on reload" |
| 线上已更新但本地不显示 | GitHub Pages CDN 缓存 | GitHub Pages 有约 1-5 分钟缓存，等待后刷新；或点击「检查更新」按钮 |
| SW 文件 404 | 路径错误或未部署 | 检查 `service-worker.js` 是否在仓库根目录 |
| 控制台显示旧版本号 | SW 未被替换 | 打开 DevTools → Application → Service Workers → 点击 "Unregister"，刷新页面重新注册 |
| 缓存混乱 | 旧版本缓存残留 | activate 事件已自动清理旧缓存，如仍有问题手动在 DevTools → Application → Cache Storage 中删除 |

---

## 📋 localStorage 键名说明

| 键名 | 用途 |
|---|---|
| `serene_logic_v3` | 核心数据（任务 + 历史记录） |
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

### 5 步快速排查法（全链路日志）

| 步骤 | 检查项 | 控制台预期输出 | 不达标常见原因 |
|---|---|---|---|
| **1** | 安全上下文 | `✅ 安全上下文 \| https: 符合要求` | 未使用 HTTPS 或 localhost |
| **2** | manifest 加载 | `✅ manifest 必填字段 \| name=... short_name=... display=standalone icons=2个` | manifest.json 404、字段缺失、图标尺寸不达标 |
| **3** | SW 注册 & 激活 | `✅ SW 注册成功 \| scope=... 状态=active 是否接管页面=true` | SW 文件路径错误、注册失败、未激活 |
| **4** | SW 版本号 | `✅ SW 版本号 \| 当前运行 SW 版本=v3` | SW 未响应 GET_VERSION 消息 |
| **5** | 安装事件 | `✅ 安装事件已捕获 \| beforeinstallprompt 已触发` | 前面任一步不达标均会导致此事件不触发 |

### Chromium PWA 可安装硬性标准（必须全部满足）

浏览器判定可安装需 **全部满足** 以下条件：

1. ✅ **HTTPS 或 localhost** — 页面必须通过安全上下文提供
2. ✅ **有效的 manifest.json** — 必须包含 `name`/`short_name`、`start_url: "./"`、`scope: "./"`、`display: "standalone"`、`192×192` 和 `512×512` 两个 PNG 图标
3. ✅ **已注册且激活的 Service Worker** — 必须监听 `fetch` 事件并实现缓存优先策略，提供离线响应能力
4. ✅ **用户未重复安装** — 同一应用不能重复安装（已安装后自动隐藏按钮）
5. ✅ **用户有足够的交互** — 浏览器可能要求用户在页面上有一定交互

### 部署验证步骤

```bash
# 1. 本地验证（必须用 localhost 或 HTTPS）
npx serve .              # 或 python -m http.server 8080
# 打开 http://localhost:8080 → F12 → Application → Manifest 检查字段
# → Application → Service Workers 确认状态为 "activated and is running"

# 2. GitHub Pages 部署后验证
# 部署到 https://<username>.github.io/<repo>/
# 打开浏览器 → F12 → Console → 确认看到以下日志序列：
#   [PWA] ✅ 安全上下文 | https: 符合要求
#   [PWA] ✅ manifest <link> 标签 | href=./manifest.json
#   [PWA] ✅ manifest 必填字段 | name=... short_name=... display=standalone icons=2个
#   [PWA] ✅ manifest 图标 | 192x192→./icons/icon-192.png | 512x512→./icons/icon-512.png
#   [PWA] ✅ SW 注册成功 | scope=... 状态=active 是否接管页面=true
#   [PWA] ✅ SW 版本号 | 当前运行 SW 版本=v3
#   [SW] 🔧 install 事件触发 | 版本=v3
#   [SW] 🚀 activate 事件触发 | 版本=v3
#   [PWA] ✅ 安装事件已捕获 | beforeinstallprompt 已触发

# 3. 安装测试
# 统计页应显示「📲 安装到桌面」按钮
# 点击按钮 → 应弹出系统原生安装弹窗
# 安装成功后按钮自动隐藏，控制台输出：✅ 应用已安装

# 4. 离线测试
# Chrome DevTools → Network → 勾选 "Offline"
# 刷新页面 → 应能正常显示（进度环、任务列表、统计数据均可用）
# 控制台可能出现 [SW] 🌐 网络不可达，尝试降级 日志（正常）
```

---

## 📄 License

MIT © 2024

---

<p align="center">
  <sub>平静地完成每一天 · 今日事，今日毕 🌱</sub>
</p>
