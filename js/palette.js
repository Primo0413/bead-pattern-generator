/**
 * @file palette.js
 * @description 色号库加载、预计算与管理模块。
 */

/**
 * @typedef {Object} PaletteEntry
 * @property {number} index 在 palette 数组中的索引
 * @property {string} alias 色号别名，如 "A1"
 * @property {string} hex 十六进制颜色，如 "#FAF5CD"
 * @property {number} r 红色分量 0-255
 * @property {number} g 绿色分量 0-255
 * @property {number} b 蓝色分量 0-255
 * @property {number} hue HSV 色相 0-360
 * @property {number} saturation HSV 饱和度 0-1
 * @property {boolean} isNeutral 是否视为中性色
 */

/** @type {PaletteEntry[] | null} */
let palette = null;

/**
 * 将 RGB 转换为 HSV。
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{hue: number, saturation: number, value: number}}
 */
function rgbToHsv(r, g, b) {
  const rd = r / 255.0;
  const gd = g / 255.0;
  const bd = b / 255.0;

  const max = Math.max(rd, gd, bd);
  const min = Math.min(rd, gd, bd);
  const delta = max - min;

  let hue = 0.0;
  if (delta > 0.0) {
    if (max === rd) {
      hue = 60.0 * (((gd - bd) / delta) % 6.0);
    } else if (max === gd) {
      hue = 60.0 * (((bd - rd) / delta) + 2.0);
    } else {
      hue = 60.0 * (((rd - gd) / delta) + 4.0);
    }
    if (hue < 0.0) hue += 360.0;
  }

  const saturation = max <= 0.0 ? 0.0 : delta / max;
  const value = max;

  return { hue, saturation, value };
}

/**
 * 解析十六进制颜色字符串为 RGB 分量。
 * @param {string} hex 颜色字符串，支持 #RGB 或 #RRGGBB
 * @returns {{r: number, g: number, b: number}}
 */
function parseHex(hex) {
  let value = (hex || '000000').trim();
  if (value.startsWith('#')) value = value.slice(1);

  if (value.length === 3) {
    value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
  }

  if (value.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;

  return { r, g, b };
}

/**
 * 加载色号库。
 * @returns {Promise<PaletteEntry[]>}
 * @throws {Error} 加载或解析失败时抛出
 */
export async function loadPalette() {
  const response = await fetch('./assets/color-aliases.json');
  if (!response.ok) {
    throw new Error(`加载色号库失败：${response.status} ${response.statusText}`);
  }

  const raw = await response.json();
  if (!raw || typeof raw !== 'object') {
    throw new Error('色号库格式错误：应为对象');
  }

  /** @type {PaletteEntry[]} */
  const entries = [];
  let index = 0;

  for (const [alias, hex] of Object.entries(raw)) {
    const { r, g, b } = parseHex(hex);
    const { hue, saturation } = rgbToHsv(r, g, b);

    entries.push({
      index: index++,
      alias,
      hex: hex.toUpperCase(),
      r,
      g,
      b,
      hue,
      saturation,
      isNeutral: saturation < 0.12
    });
  }

  if (entries.length === 0) {
    throw new Error('色号库为空');
  }

  palette = entries;
  return entries;
}

/**
 * 获取当前已加载的色号库。
 * @returns {PaletteEntry[]}
 * @throws {Error} 若未加载则抛出
 */
export function getPalette() {
  if (!palette) {
    throw new Error('色号库尚未加载');
  }
  return palette;
}

/**
 * 根据索引获取色号条目。
 * @param {number} index
 * @returns {PaletteEntry | null}
 */
export function getPaletteEntry(index) {
  if (!palette || index < 0 || index >= palette.length) return null;
  return palette[index];
}

/**
 * 根据别名查找色号索引。
 * @param {string} alias
 * @returns {number} 未找到返回 -1
 */
export function findIndexByAlias(alias) {
  if (!palette) return -1;
  return palette.findIndex((p) => p.alias === alias);
}

/**
 * 判断背景色上应使用深色还是浅色文字。
 * @param {PaletteEntry} entry
 * @returns {string}
 */
export function getReadableTextColor(entry) {
  const luminance = (0.299 * entry.r + 0.587 * entry.g + 0.114 * entry.b) / 255.0;
  return luminance > 0.62 ? '#242424' : '#ffffff';
}
