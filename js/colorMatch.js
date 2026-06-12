/**
 * @file colorMatch.js
 * @description HSV-aware 最近色号匹配算法。
 * 从 pixel_edit/Services/PixelConvertService.cs 移植到 JavaScript。
 */

/** @typedef {import('./palette.js').PaletteEntry} PaletteEntry */

/**
 * 将 RGB 转换为 HSV。
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @returns {{hue: number, saturation: number, value: number}}
 */
export function rgbToHsv(r, g, b) {
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

  return {
    hue,
    saturation: max <= 0.0 ? 0.0 : delta / max,
    value: max
  };
}

/**
 * 计算两个色相角度在色环上的最短距离。
 * @param {number} h1
 * @param {number} h2
 * @returns {number} 0-180
 */
export function hueDistance(h1, h2) {
  const diff = Math.abs(h1 - h2);
  return Math.min(diff, 360.0 - diff);
}

/**
 * 在固定色板中查找与指定 RGB 最接近的颜色索引。
 * 匹配策略：优先同色系（Hue 接近），再以 RGB/饱和度综合距离评分。
 * @param {number} r 0-255
 * @param {number} g 0-255
 * @param {number} b 0-255
 * @param {PaletteEntry[]} palette
 * @returns {number} 最接近颜色的色板索引
 */
export function findNearestPaletteIndex(r, g, b, palette) {
  if (!palette || palette.length === 0) return -1;

  const { hue, saturation } = rgbToHsv(r, g, b);
  const sourceNeutral = saturation < 0.12;

  /** @type {PaletteEntry[]} */
  let candidateSet = palette;

  if (sourceNeutral) {
    const neutralCandidates = palette.filter((p) => p.isNeutral);
    if (neutralCandidates.length > 0) {
      candidateSet = neutralCandidates;
    }
  } else {
    let sameHueCandidates = palette.filter(
      (p) => !p.isNeutral && hueDistance(hue, p.hue) <= 32.0
    );
    if (sameHueCandidates.length === 0) {
      sameHueCandidates = palette.filter(
        (p) => !p.isNeutral && hueDistance(hue, p.hue) <= 48.0
      );
    }
    if (sameHueCandidates.length > 0) {
      candidateSet = sameHueCandidates;
    }
  }

  let bestScore = Infinity;
  let bestIndex = candidateSet[0].index;

  for (const c of candidateSet) {
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const rgbDistance = dr * dr + dg * dg + db * db;

    const huePenalty = sourceNeutral ? 0.0 : Math.pow(hueDistance(hue, c.hue), 2) * 2.0;
    const satDiff = (saturation - c.saturation) * 255.0;
    const saturationPenalty = satDiff * satDiff * 0.25;

    const score = rgbDistance + huePenalty + saturationPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = c.index;
    }
  }

  return bestIndex;
}
