/**
 * @file canvasRenderer.js
 * @description Canvas 渲染器：绘制像素网格、颜色填充、色号标注、缩放。
 */

/** @typedef {import('./palette.js').PaletteEntry} PaletteEntry */
/** @typedef {import('./state.js').PixelProject} PixelProject */

/** @type {HTMLCanvasElement | null} */
let canvas = null;

/** @type {CanvasRenderingContext2D | null} */
let ctx = null;

/** @type {number} */
let zoom = 1.0;

/** @type {boolean} */
let showGrid = true;

/** @type {boolean} */
let showLabels = true;

/** @type {number} */
const BASE_CELL_SIZE = 20;

/** @type {number} */
let cachedWidth = 0;

/** @type {number} */
let cachedHeight = 0;

/** @type {number} */
let cachedCellSize = BASE_CELL_SIZE;

/**
 * 初始化 Canvas。
 * @param {HTMLCanvasElement} canvasEl
 */
export function initCanvas(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('无法获取 Canvas 2D 上下文');
  }
  ctx.imageSmoothingEnabled = false;
}

/**
 * 设置是否显示网格线。
 * @param {boolean} value
 */
export function setShowGrid(value) {
  showGrid = value;
}

/**
 * 设置是否显示色号标注。
 * @param {boolean} value
 */
export function setShowLabels(value) {
  showLabels = value;
}

/**
 * 设置缩放比例。
 * @param {number} value 0.5 ~ 4.0
 */
export function setZoom(value) {
  zoom = Math.max(0.5, Math.min(4.0, value));
}

/**
 * 获取当前缩放比例。
 * @returns {number}
 */
export function getZoom() {
  return zoom;
}

/**
 * 判断背景色上应使用深色还是浅色文字。
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function getReadableTextColor(r, g, b) {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
  return luminance > 0.62 ? '#242424' : '#ffffff';
}

/**
 * 渲染整个项目。
 * @param {PixelProject} project
 */
export function render(project) {
  if (!canvas || !ctx) return;

  const cellSize = Math.max(8, Math.round(BASE_CELL_SIZE * zoom));
  const width = project.width;
  const height = project.height;

  // 缓存当前渲染参数，供 screenToGrid 使用
  cachedWidth = width;
  cachedHeight = height;
  cachedCellSize = cellSize;

  // 设置 canvas 实际像素尺寸
  canvas.width = width * cellSize;
  canvas.height = height * cellSize;

  // 设置 canvas 显示尺寸（保持清晰）
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;

  // 白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制每个像素格
  const palette = project.palette;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const colorIndex = project.pixels[idx];

      if (colorIndex < 0 || colorIndex >= palette.length) {
        // 透明格：绘制棋盘格背景
        drawTransparentCell(x, y, cellSize);
        continue;
      }

      const entry = palette[colorIndex];
      const px = x * cellSize;
      const py = y * cellSize;

      // 填充颜色
      ctx.fillStyle = entry.hex;
      ctx.fillRect(px, py, cellSize, cellSize);

      // 绘制色号标注
      if (showLabels && cellSize >= 12) {
        ctx.fillStyle = getReadableTextColor(entry.r, entry.g, entry.b);
        ctx.font = `bold ${Math.max(7, Math.floor(cellSize * 0.38))}px "Inter", "Noto Sans SC", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(entry.alias, px + cellSize / 2, py + cellSize / 2 + 1);
      }
    }
  }

  // 绘制网格线
  if (showGrid) {
    drawGridLines(width, height, cellSize);
  }
}

/**
 * 绘制透明格的棋盘格背景。
 * @param {number} x
 * @param {number} y
 * @param {number} cellSize
 */
function drawTransparentCell(x, y, cellSize) {
  if (!ctx) return;

  const px = x * cellSize;
  const py = y * cellSize;
  const checkerSize = Math.max(4, Math.floor(cellSize / 4));

  for (let cy = 0; cy < cellSize; cy += checkerSize) {
    for (let cx = 0; cx < cellSize; cx += checkerSize) {
      const isEven = ((x * cellSize + cx) / checkerSize + (y * cellSize + cy) / checkerSize) % 2 < 1;
      ctx.fillStyle = isEven ? '#f5f5f5' : '#ffffff';
      ctx.fillRect(px + cx, py + cy, checkerSize, checkerSize);
    }
  }
}

/**
 * 绘制网格线。
 * @param {number} width
 * @param {number} height
 * @param {number} cellSize
 */
function drawGridLines(width, height, cellSize) {
  if (!ctx) return;

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  // 竖线
  for (let x = 0; x <= width; x++) {
    const px = x * cellSize;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, height * cellSize);
  }

  // 横线
  for (let y = 0; y <= height; y++) {
    const py = y * cellSize;
    ctx.moveTo(0, py);
    ctx.lineTo(width * cellSize, py);
  }

  ctx.stroke();
}

/**
 * 将屏幕坐标转换为网格坐标。
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{x: number, y: number} | null}
 */
export function screenToGrid(clientX, clientY) {
  if (!canvas || cachedWidth <= 0 || cachedHeight <= 0) return null;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  // 使用与 render() 一致的逻辑：按显示尺寸反推网格坐标
  const x = Math.floor((clientX - rect.left) * cachedWidth / rect.width);
  const y = Math.floor((clientY - rect.top) * cachedHeight / rect.height);

  if (x < 0 || x >= cachedWidth || y < 0 || y >= cachedHeight) return null;
  return { x, y };
}

/**
 * 导出当前像素图为 Data URL（用于 PDF 导出）。
 * @param {PixelProject} project
 * @param {boolean} [withLabels=true]
 * @returns {string}
 */
export function getPatternDataUrl(project, withLabels = true) {
  if (!canvas) {
    throw new Error('Canvas 未初始化');
  }

  const originalShowGrid = showGrid;
  const originalShowLabels = showLabels;

  showGrid = false;
  showLabels = withLabels;
  render(project);

  const dataUrl = canvas.toDataURL('image/png');

  showGrid = originalShowGrid;
  showLabels = originalShowLabels;
  render(project);

  return dataUrl;
}
