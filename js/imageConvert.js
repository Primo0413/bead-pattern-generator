/**
 * @file imageConvert.js
 * @description 图片上传、缩放、Floyd-Steinberg 抖动转换。
 */

import { findNearestPaletteIndex } from './colorMatch.js';

/** @typedef {import('./palette.js').PaletteEntry} PaletteEntry */

/**
 * 读取文件为 ImageBitmap。
 * @param {File} file
 * @returns {Promise<ImageBitmap>}
 */
export async function loadImageFile(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('请上传图片文件（PNG、JPG、BMP、WebP）');
  }

  const bitmap = await createImageBitmap(file);
  if (!bitmap.width || !bitmap.height) {
    throw new Error('无法读取图片尺寸');
  }
  return bitmap;
}

/**
 * 将 ImageBitmap 缩放到目标尺寸，返回 ImageData。
 * 使用最近邻插值保持像素感。
 * @param {ImageBitmap} bitmap
 * @param {number} targetWidth
 * @returns {ImageData}
 */
export function scaleImage(bitmap, targetWidth) {
  if (targetWidth < 1) targetWidth = 1;

  const aspectRatio = bitmap.height / bitmap.width;
  const targetHeight = Math.max(1, Math.round(targetWidth * aspectRatio));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建 canvas 上下文');
  }

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * 将缩放后的 ImageData 匹配到色号库，可选 Floyd-Steinberg 抖动。
 * @param {ImageData} imageData
 * @param {PaletteEntry[]} palette
 * @param {boolean} useDithering
 * @returns {Int16Array}
 */
export function convertToPixelData(imageData, palette, useDithering) {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const result = new Int16Array(totalPixels);

  if (useDithering) {
    return convertWithDithering(imageData, palette);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const idx = y * width + x;
      if (a < 128) {
        result[idx] = -1;
      } else {
        result[idx] = findNearestPaletteIndex(r, g, b, palette);
      }
    }
  }

  return result;
}

/**
 * 使用 Floyd-Steinberg 抖动算法进行颜色量化。
 * @param {ImageData} imageData
 * @param {PaletteEntry[]} palette
 * @returns {Int16Array}
 */
function convertWithDithering(imageData, palette) {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const result = new Int16Array(totalPixels);

  // 用 Float32Array 保存每个通道的误差累积
  const buffer = new Float32Array(totalPixels * 3);
  for (let i = 0; i < totalPixels; i++) {
    buffer[i * 3] = data[i * 4];
    buffer[i * 3 + 1] = data[i * 4 + 1];
    buffer[i * 3 + 2] = data[i * 4 + 2];
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const i3 = idx * 3;
      const i4 = idx * 4;

      const a = data[i4 + 3];
      if (a < 128) {
        result[idx] = -1;
        continue;
      }

      const oldR = Math.max(0, Math.min(255, Math.round(buffer[i3])));
      const oldG = Math.max(0, Math.min(255, Math.round(buffer[i3 + 1])));
      const oldB = Math.max(0, Math.min(255, Math.round(buffer[i3 + 2])));

      const paletteIndex = findNearestPaletteIndex(oldR, oldG, oldB, palette);
      result[idx] = paletteIndex;

      const entry = palette[paletteIndex];
      const errR = oldR - entry.r;
      const errG = oldG - entry.g;
      const errB = oldB - entry.b;

      // Floyd-Steinberg 误差扩散
      distributeError(buffer, width, height, x, y, errR, errG, errB);
    }
  }

  return result;
}

/**
 * 将量化误差扩散到相邻像素。
 * @param {Float32Array} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} er
 * @param {number} eg
 * @param {number} eb
 */
function distributeError(buffer, width, height, x, y, er, eg, eb) {
  /**
   * 标准 Floyd-Steinberg 权重：
   *        X   7/16
   *  3/16  5/16  1/16
   */
  const add = (dx, dy, factor) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny >= height) return;

    const i = (ny * width + nx) * 3;
    buffer[i] += er * factor;
    buffer[i + 1] += eg * factor;
    buffer[i + 2] += eb * factor;
  };

  add(1, 0, 7 / 16);
  add(-1, 1, 3 / 16);
  add(0, 1, 5 / 16);
  add(1, 1, 1 / 16);
}

/**
 * 上传像素图 PNG 并精确读取每个像素。
 * @param {File} file
 * @param {PaletteEntry[]} palette
 * @returns {Promise<Int16Array>}
 */
export async function loadPixelImage(file, palette) {
  const bitmap = await loadImageFile(file);
  const imageData = scaleImage(bitmap, bitmap.width);
  return convertToPixelData(imageData, palette, false);
}
