/**
 * @file state.js
 * @description 应用状态、项目数据结构与撤销栈管理。
 */

/** @typedef {import('./palette.js').PaletteEntry} PaletteEntry */

/**
 * @typedef {Object} PixelProject
 * @property {number} schemaVersion 数据格式版本
 * @property {string} name 项目名称
 * @property {number} width 网格宽度
 * @property {number} height 网格高度
 * @property {number} cellSize 显示单格尺寸
 * @property {Int16Array} pixels 扁平化像素数据，-1 表示透明
 * @property {PaletteEntry[]} palette 色号库引用
 */

/**
 * @typedef {Object} HistoryRecord
 * @property {number} x
 * @property {number} y
 * @property {number} previousIndex
 * @property {boolean} [isFill] 是否为填充操作
 * @property {number} [fillColor] 填充操作使用的颜色
 * @property {Array<{x: number, y: number}>} [cells] 填充操作涉及的格子坐标
 */

/** @type {PixelProject | null} */
let currentProject = null;

/** @type {HistoryRecord[]} */
const undoStack = [];

/** @type {HistoryRecord[]} */
const redoStack = [];

const HISTORY_LIMIT = 100;

/**
 * 创建空白像素工程。
 * @param {number} width
 * @param {number} height
 * @param {PaletteEntry[]} palette
 * @param {string} [name='未命名']
 * @returns {PixelProject}
 */
export function createBlankProject(width, height, palette, name = '未命名') {
  if (width < 1 || height < 1) {
    throw new Error('画布尺寸必须大于 0');
  }
  if (width > 512 || height > 512) {
    throw new Error('画布尺寸不能超过 512 × 512');
  }

  return {
    schemaVersion: 1,
    name,
    width,
    height,
    cellSize: 20,
    pixels: new Int16Array(width * height).fill(-1),
    palette
  };
}

/**
 * 从普通对象反序列化为 PixelProject。
 * @param {object} data
 * @param {PaletteEntry[]} palette
 * @returns {PixelProject}
 */
export function loadProject(data, palette) {
  if (!data || data.schemaVersion !== 1) {
    throw new Error('项目文件格式不支持或版本过低');
  }

  const width = Number(data.width);
  const height = Number(data.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('项目文件尺寸无效');
  }

  const pixels = new Int16Array(width * height).fill(-1);
  if (Array.isArray(data.pixels)) {
    const len = Math.min(data.pixels.length, pixels.length);
    for (let i = 0; i < len; i++) {
      const v = Number(data.pixels[i]);
      pixels[i] = Number.isFinite(v) ? v : -1;
    }
  }

  return {
    schemaVersion: 1,
    name: data.name || '未命名',
    width,
    height,
    cellSize: Number(data.cellSize) || 20,
    pixels,
    palette
  };
}

/**
 * 将当前项目序列化为可保存对象。
 * @returns {object}
 */
export function serializeProject() {
  if (!currentProject) {
    throw new Error('当前没有可保存的项目');
  }

  return {
    schemaVersion: currentProject.schemaVersion,
    name: currentProject.name,
    width: currentProject.width,
    height: currentProject.height,
    cellSize: currentProject.cellSize,
    pixels: Array.from(currentProject.pixels)
  };
}

/**
 * 获取当前项目。
 * @returns {PixelProject | null}
 */
export function getProject() {
  return currentProject;
}

/**
 * 设置当前项目。
 * @param {PixelProject} project
 */
export function setProject(project) {
  currentProject = project;
  clearHistory();
}

/**
 * 将二维坐标转为一维索引。
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number}
 */
function toIndex(x, y, width) {
  return y * width + x;
}

/**
 * 读取指定格子的色号索引。
 * @param {number} x
 * @param {number} y
 * @returns {number} 未设置或越界返回 -1
 */
export function getPixel(x, y) {
  if (!currentProject) return -1;
  if (x < 0 || x >= currentProject.width || y < 0 || y >= currentProject.height) return -1;
  return currentProject.pixels[toIndex(x, y, currentProject.width)];
}

/**
 * 设置指定格子的色号索引，并记录历史。
 * @param {number} x
 * @param {number} y
 * @param {number} colorIndex -1 表示擦除
 * @returns {boolean} 是否成功设置
 */
export function setPixel(x, y, colorIndex) {
  if (!currentProject) return false;
  if (x < 0 || x >= currentProject.width || y < 0 || y >= currentProject.height) return false;

  const idx = toIndex(x, y, currentProject.width);
  const previous = currentProject.pixels[idx];

  if (previous === colorIndex) return false;

  // 记录撤销
  undoStack.push({ x, y, previousIndex: previous });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();

  currentProject.pixels[idx] = colorIndex;
  redoStack.length = 0;
  return true;
}

/**
 * 用当前色号填充一片连续同色区域。
 * @param {number} startX
 * @param {number} startY
 * @param {number} colorIndex
 * @returns {number} 填充的格子数
 */
export function floodFill(startX, startY, colorIndex) {
  if (!currentProject) return 0;
  const { width, height, pixels } = currentProject;

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return 0;

  const startIdx = toIndex(startX, startY, width);
  const targetColor = pixels[startIdx];

  if (targetColor === colorIndex) return 0;

  let filled = 0;
  const queue = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  visited[startIdx] = 1;

  /** @type {Array<{x: number, y: number}>} */
  const filledCells = [];

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    const idx = toIndex(x, y, width);

    if (pixels[idx] === colorIndex) continue;

    pixels[idx] = colorIndex;
    filledCells.push({ x, y });
    filled++;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = toIndex(nx, ny, width);
      if (visited[nIdx] || pixels[nIdx] !== targetColor) continue;
      visited[nIdx] = 1;
      queue.push([nx, ny]);
    }
  }

  // 将填充操作作为一个整体记录到撤销栈
  if (filledCells.length > 0) {
    undoStack.push({
      x: startX,
      y: startY,
      previousIndex: targetColor,
      isFill: true,
      fillColor: colorIndex,
      cells: filledCells
    });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  }
  redoStack.length = 0;
  return filled;
}

/**
 * 撤销上一步操作。
 * @returns {boolean}
 */
export function undo() {
  if (undoStack.length === 0 || !currentProject) return false;

  const record = undoStack.pop();
  if (!record) return false;

  // 填充操作：批量恢复所有涉及格子
  if (record.isFill && record.cells) {
    /** @type {Array<{x: number, y: number, previousIndex: number}>} */
    const currentCells = [];
    for (const cell of record.cells) {
      const idx = toIndex(cell.x, cell.y, currentProject.width);
      currentCells.push({ x: cell.x, y: cell.y, previousIndex: currentProject.pixels[idx] });
      currentProject.pixels[idx] = record.previousIndex;
    }
    redoStack.push({
      x: record.x,
      y: record.y,
      previousIndex: record.fillColor ?? record.previousIndex,
      isFill: true,
      fillColor: record.previousIndex,
      cells: currentCells
    });
    return true;
  }

  const idx = toIndex(record.x, record.y, currentProject.width);
  const current = currentProject.pixels[idx];
  currentProject.pixels[idx] = record.previousIndex;
  redoStack.push({ x: record.x, y: record.y, previousIndex: current });
  return true;
}

/**
 * 重做上一步撤销。
 * @returns {boolean}
 */
export function redo() {
  if (redoStack.length === 0 || !currentProject) return false;

  const record = redoStack.pop();
  if (!record) return false;

  // 填充操作：批量恢复
  if (record.isFill && record.cells) {
    /** @type {Array<{x: number, y: number, previousIndex: number}>} */
    const currentCells = [];
    for (const cell of record.cells) {
      const idx = toIndex(cell.x, cell.y, currentProject.width);
      currentCells.push({ x: cell.x, y: cell.y, previousIndex: currentProject.pixels[idx] });
      currentProject.pixels[idx] = record.previousIndex;
    }
    undoStack.push({
      x: record.x,
      y: record.y,
      previousIndex: record.fillColor ?? record.previousIndex,
      isFill: true,
      fillColor: record.previousIndex,
      cells: currentCells
    });
    return true;
  }

  const idx = toIndex(record.x, record.y, currentProject.width);
  const current = currentProject.pixels[idx];
  currentProject.pixels[idx] = record.previousIndex;
  undoStack.push({ x: record.x, y: record.y, previousIndex: current });
  return true;
}

/**
 * 清空历史记录。
 */
export function clearHistory() {
  undoStack.length = 0;
  redoStack.length = 0;
}

/**
 * 用新的像素数据覆盖当前项目（用于图片转换后）。
 * @param {Int16Array} pixels
 */
export function replacePixels(pixels) {
  if (!currentProject) return;
  if (pixels.length !== currentProject.pixels.length) {
    throw new Error('像素数据尺寸与当前项目不匹配');
  }
  currentProject.pixels.set(pixels);
  clearHistory();
}

/**
 * 统计每种色号的使用量。
 * @returns {{alias: string, hex: string, index: number, count: number}[]}
 */
export function computeStatistics() {
  if (!currentProject) return [];

  const counts = new Int32Array(currentProject.palette.length);
  let total = 0;

  for (const idx of currentProject.pixels) {
    if (idx >= 0 && idx < counts.length) {
      counts[idx]++;
      total++;
    }
  }

  const result = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      const entry = currentProject.palette[i];
      result.push({
        alias: entry.alias,
        hex: entry.hex,
        index: i,
        count: counts[i]
      });
    }
  }

  // 按数量降序，再按别名升序
  result.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.alias.localeCompare(b.alias);
  });

  return result;
}

/**
 * 获取总豆数。
 * @returns {number}
 */
export function getTotalBeads() {
  if (!currentProject) return 0;
  let total = 0;
  for (const idx of currentProject.pixels) {
    if (idx >= 0) total++;
  }
  return total;
}

/**
 * 获取使用的颜色种数。
 * @returns {number}
 */
export function getUsedColorCount() {
  return computeStatistics().length;
}
