# 拼豆图纸生成器 | Bead Pattern Studio

一个网页版拼豆（Perler / Fuse Beads）图纸生成工具，支持手动绘制像素图和将任意图片转换为像素图，并可导出带色号标注的 PDF。

---

## 项目概述

本工具基于原生 HTML + CSS + JavaScript，使用 Vite 构建，核心绘图基于 HTML5 Canvas。两种工作模式：

- **设计模式**：手动绘制或编辑像素图。
- **转换模式**：上传图片，通过 HSV-aware 颜色匹配和 Floyd-Steinberg 抖动算法转换为像素图。

---

## 目录结构

### 根目录文件

| 文件 | 作用 |
|---|---|
| `index.html` | Vite 构建入口，包含页面完整 UI 结构 |
| `main.js` | 应用入口，负责初始化、模块整合、事件绑定 |
| `style.css` | 全局样式，包含布局、组件、响应式设计 |
| `vite.config.js` | Vite 配置文件，定义构建输出和模块行为 |
| `package.json` | 项目依赖、脚本命令和元数据 |
| `.gitignore` | Git 忽略规则，排除 `node_modules`、构建产物等 |
| `create-standalone.js` | Node 脚本，将构建产物打包为单个独立 HTML 文件 |
| `verify.js` | Playwright 自动化验证脚本 |
| `bead-pattern-generator.html` | 由 `create-standalone.js` 生成的独立发布版 HTML |

### `assets/` 目录

| 文件 | 作用 |
|---|---|
| `assets/color-aliases.json` | 拼豆色号库，包含 222 种颜色的别名和 HEX 值 |

### `js/` 目录

| 文件 | 作用 |
|---|---|
| `js/palette.js` | 加载 `color-aliases.json`，预计算 RGB/HSV，管理色板面板 |
| `js/state.js` | 定义项目数据结构、像素网格、撤销/重做栈、图片图层 |
| `js/colorMatch.js` | HSV-aware 最近色号匹配算法 |
| `js/canvasRenderer.js` | Canvas 渲染器，绘制网格、颜色、色号标注、缩放 |
| `js/editor.js` | 编辑器交互：画笔、橡皮擦、取色器、油漆桶、快捷键 |
| `js/imageConvert.js` | 图片上传、缩放、Floyd-Steinberg 抖动转换 |
| `js/statistics.js` | 色号使用量统计与统计面板渲染 |
| `js/pdfExport.js` | PDF 导出：像素图 + 色号统计表 |

---

## 功能说明

### 一、设计模式

| 功能 | 说明 |
|---|---|
| 新建空白画布 | 自定义画板宽度与高度（8~512 格） |
| 上传像素图 PNG | 读取 1:1 像素图，每个像素映射为最近色号 |
| 画笔工具 | 选中色号后点击或拖拽绘制 |
| 橡皮擦工具 | 将格子恢复为透明 |
| 取色器工具 | 拾取已绘制格子的色号 |
| 油漆桶填充 | 填充相连同色区域 |
| 撤销 / 重做 | 支持 Ctrl+Z / Ctrl+Shift+Z |
| 网格线显示/隐藏 | 控制画布网格显示 |
| 色号标注显示/隐藏 | 控制格子里是否显示色号别名 |
| 画布缩放 | 50% ~ 400% 缩放 |
| 快捷键 | B 画笔、E 橡皮、I 取色器、F 油漆桶、[ / ] 缩放 |

### 二、转换模式

| 功能 | 说明 |
|---|---|
| 上传任意图片 | 支持 PNG、JPG、BMP、WebP |
| 自定义画板尺寸 | 宽度和高度独立输入 |
| 图片默认 fit 80% | 长和宽 whichever 先占满画板 80% |
| 图片始终居中 | 自动计算居中偏移 |
| 图片缩放调整 | 10% ~ 400%，保持长宽比 |
| HSV-aware 色号匹配 | 优先匹配同色系 |
| Floyd-Steinberg 抖动 | 开关可控，改善渐变过渡 |
| 透明背景处理 | alpha < 128 的像素映射为透明格 |
| 重新生成 | 调整缩放后可再次生成 |

### 三、色号统计

| 功能 | 说明 |
|---|---|
| 实时统计 | 绘制或转换后自动更新 |
| 按数量排序 | 用量多的颜色排在前面 |
| 总豆数 | 所有非透明格总数 |
| 颜色种数 | 实际用到的色号数量 |
| 仅显示已用颜色 | 过滤未使用的色号 |

### 四、PDF 导出

| 功能 | 说明 |
|---|---|
| A4 纵向页面 | 标准 210mm × 297mm |
| 顶部像素图 | 含色号标注 |
| 自动缩放适配 | 根据图纸宽度自动计算单格尺寸 |
| 下方统计表 | 含色块、别名、HEX、数量 |
| 项目名称与日期 | 页眉显示 |

### 五、工程文件

| 功能 | 说明 |
|---|---|
| 保存工程 | 导出 `.bead.json` 文件 |
| 加载工程 | 读取 `.bead.json` 恢复编辑状态 |
| 快捷键保存 | Ctrl+S |

---

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 生成独立 HTML 文件
node create-standalone.js
```

---

## 部署说明

- `main` 分支存放完整源码。
- `gh-pages` 分支只存放独立版 `index.html`，用于 GitHub Pages 部署。
- 更新后执行 `npm run build` 和 `node create-standalone.js`，然后将生成的 `bead-pattern-generator.html` 同步到 `gh-pages` 分支。

---

## 在线访问

GitHub Pages：

```
https://primo0413.github.io/bead-pattern-generator/
```
