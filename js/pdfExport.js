/**
 * @file pdfExport.js
 * @description PDF 导出：像素图 + 色号统计表。
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as state from './state.js';
import { getStatisticsForExport } from './statistics.js';
import { getPatternDataUrl } from './canvasRenderer.js';

/**
 * 导出当前项目为 PDF。
 * 使用 html2canvas 渲染隐藏的 DOM 容器，确保中文字体与视觉样式正确。
 * @param {string} [fileName]
 */
export async function exportPdf(fileName) {
  const project = state.getProject();
  if (!project) {
    throw new Error('当前没有可导出的项目');
  }

  const stats = getStatisticsForExport();
  if (stats.length === 0) {
    throw new Error('当前项目没有可统计的像素');
  }

  const container = createExportContainer(project, stats);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);

    const drawWidth = imgWidth * ratio;
    const drawHeight = imgHeight * ratio;
    const x = margin + (availableWidth - drawWidth) / 2;
    const y = margin + (availableHeight - drawHeight) / 2;

    doc.addImage(imgData, 'JPEG', x, y, drawWidth, drawHeight);
    doc.save(fileName || `${project.name || 'bead-pattern'}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 创建用于 PDF 导出的隐藏 DOM 容器。
 * @param {import('./state.js').PixelProject} project
 * @param {{alias: string, hex: string, count: number, r: number, g: number, b: number}[]} stats
 * @returns {HTMLElement}
 */
function createExportContainer(project, stats) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 794px;
    background: #ffffff;
    padding: 32px;
    font-family: 'Inter', 'Noto Sans SC', sans-serif;
    color: #1a1a1a;
    box-sizing: border-box;
  `;

  // 标题区
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 12px;';
  header.innerHTML = `
    <h1 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700; color: #111;">${escapeHtml(project.name || '拼豆图纸')}</h1>
    <p style="margin: 0; font-size: 12px; color: #666;">
      尺寸：${project.width} × ${project.height} 格 &nbsp;|&nbsp; 总豆数：${state.getTotalBeads()} &nbsp;|&nbsp; 使用颜色：${stats.length} 种
    </p>
  `;
  container.appendChild(header);

  // 像素图区
  const patternArea = document.createElement('div');
  patternArea.style.cssText = 'margin-bottom: 24px; text-align: center;';

  const patternImg = document.createElement('img');
  patternImg.src = getPatternDataUrl(project, true);
  patternImg.style.cssText = `
    max-width: 100%;
    background: #f8f8f8;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  `;
  patternArea.appendChild(patternImg);
  container.appendChild(patternArea);

  // 统计表区
  const statsHeader = document.createElement('h2');
  statsHeader.style.cssText = 'font-size: 16px; font-weight: 700; margin: 0 0 12px 0; color: #111;';
  statsHeader.textContent = '颜色使用情况';
  container.appendChild(statsHeader);

  const columns = 4;
  const table = document.createElement('div');
  table.style.cssText = `
    display: grid;
    grid-template-columns: repeat(${columns}, 1fr);
    gap: 8px 16px;
    font-size: 12px;
  `;

  for (let i = 0; i < stats.length; i++) {
    const item = stats[i];
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: #fafafa;
      border-radius: 6px;
      border: 1px solid #eee;
    `;
    row.innerHTML = `
      <div style="width: 16px; height: 16px; border-radius: 4px; background: ${item.hex}; border: 1px solid rgba(0,0,0,0.1);"></div>
      <span style="font-weight: 700; min-width: 32px;">${escapeHtml(item.alias)}</span>
      <span style="color: #888; font-family: monospace; font-size: 11px;">${item.hex}</span>
      <span style="margin-left: auto; font-weight: 700; color: #4f46e5;">${item.count}</span>
    `;
    table.appendChild(row);
  }

  container.appendChild(table);

  // 页脚
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center;';
  footer.textContent = `生成时间：${new Date().toLocaleString('zh-CN')}`;
  container.appendChild(footer);

  return container;
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
