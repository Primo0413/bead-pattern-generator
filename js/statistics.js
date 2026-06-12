/**
 * @file statistics.js
 * @description 色号使用量统计与统计面板渲染。
 */

import * as state from './state.js';

/**
 * 渲染统计面板。
 */
export function renderStatistics() {
  const stats = state.computeStatistics();
  const total = state.getTotalBeads();
  const usedCount = state.getUsedColorCount();

  // 更新汇总数字
  const elTotal = document.getElementById('total-beads');
  const elTypes = document.getElementById('color-types');
  const elUsedCount = document.getElementById('used-color-count');

  if (elTotal) elTotal.textContent = total.toLocaleString();
  if (elTypes) elTypes.textContent = usedCount.toLocaleString();
  if (elUsedCount) elUsedCount.textContent = usedCount.toLocaleString();

  // 渲染表格
  const table = document.getElementById('stats-table');
  if (!table) return;

  if (stats.length === 0) {
    table.innerHTML = `<div class="stats-empty">暂无数据</div>`;
    return;
  }

  table.innerHTML = '';
  for (const item of stats) {
    const row = document.createElement('div');
    row.className = 'stats-row';
    row.innerHTML = `
      <div class="swatch" style="background: ${item.hex};" title="${item.hex}"></div>
      <span class="alias">${escapeHtml(item.alias)}</span>
      <span class="hex">${item.hex}</span>
      <span class="count">${item.count}</span>
    `;
    table.appendChild(row);
  }
}

/**
 * 转义 HTML 特殊字符。
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 导出统计数据为 PDF-ready 数组。
 * @returns {{alias: string, hex: string, count: number, r: number, g: number, b: number}[]}
 */
export function getStatisticsForExport() {
  const stats = state.computeStatistics();
  const project = state.getProject();
  if (!project) return [];

  return stats.map((item) => {
    const entry = project.palette[item.index];
    return {
      alias: item.alias,
      hex: item.hex,
      count: item.count,
      r: entry.r,
      g: entry.g,
      b: entry.b
    };
  });
}
