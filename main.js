/**
 * @file main.js
 * @description 应用入口：初始化、模块整合、事件绑定。
 */

import { loadPalette, getPalette, getReadableTextColor } from './js/palette.js';
import * as state from './js/state.js';
import * as renderer from './js/canvasRenderer.js';
import * as editor from './js/editor.js';
import * as imageConvert from './js/imageConvert.js';
import * as statistics from './js/statistics.js';
import { exportPdf } from './js/pdfExport.js';

/** @type {'design' | 'convert'} */
let currentMode = 'design';

/** @type {ImageBitmap | null} */
let currentImageBitmap = null;

/**
 * 页面加载完成后初始化应用。
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const palette = await loadPalette();
    renderPalette(palette);

    const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('pixel-canvas'));
    renderer.initCanvas(canvas);
    editor.initEditor(canvas, (tool) => {
      // 工具切换回调
    });
    editor.setOnChange(() => {
      statistics.renderStatistics();
    });

    bindModeTabs();
    bindDesignControls();
    bindConvertControls();
    bindCanvasControls();
    bindHeaderActions();

    // 创建默认空白画布
    createNewCanvas(64, 64);

    showToast('应用初始化完成', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : '初始化失败', 'error');
    console.error(err);
  }
});

/**
 * 渲染色板面板。
 * @param {import('./js/palette.js').PaletteEntry[]} palette
 */
function renderPalette(palette) {
  const grid = document.getElementById('palette-grid');
  const count = document.getElementById('palette-count');
  if (!grid) return;

  if (count) count.textContent = palette.length.toString();
  grid.innerHTML = '';

  palette.forEach((entry) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.style.backgroundColor = entry.hex;
    swatch.dataset.alias = entry.alias;
    swatch.dataset.hex = entry.hex;
    swatch.title = `${entry.alias} ${entry.hex}`;

    if (entry.index === 0) swatch.classList.add('active');

    swatch.addEventListener('click', () => {
      document.querySelectorAll('.palette-swatch').forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      updateSelectedColorInfo(entry);

      // 点击色板后自动切回画笔
      if (editor.getTool() === 'eraser') {
        editor.setTool('brush');
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'brush'));
      }
    });

    grid.appendChild(swatch);
  });

  if (palette.length > 0) {
    updateSelectedColorInfo(palette[0]);
  }
}

/**
 * 更新当前选中色号信息。
 * @param {import('./js/palette.js').PaletteEntry} entry
 */
function updateSelectedColorInfo(entry) {
  const elAlias = document.getElementById('selected-alias');
  const elHex = document.getElementById('selected-hex');
  const elSwatch = document.getElementById('selected-swatch');

  if (elAlias) elAlias.textContent = entry.alias;
  if (elHex) elHex.textContent = entry.hex;
  if (elSwatch) {
    elSwatch.style.backgroundColor = entry.hex;
    elSwatch.style.color = getReadableTextColor(entry);
  }
}

/**
 * 绑定工作模式切换标签。
 */
function bindModeTabs() {
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = /** @type {'design' | 'convert'} */ (tab.dataset.mode);
      setMode(mode);
    });
  });
}

/**
 * 切换工作模式。
 * @param {'design' | 'convert'} mode
 */
function setMode(mode) {
  currentMode = mode;

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  document.getElementById('panel-design')?.classList.toggle('hidden', mode !== 'design');
  document.getElementById('panel-convert')?.classList.toggle('hidden', mode !== 'convert');
}

/**
 * 创建新的空白画布。
 * @param {number} width
 * @param {number} height
 */
function createNewCanvas(width, height) {
  try {
    const palette = getPalette();
    const project = state.createBlankProject(width, height, palette);
    state.setProject(project);
    renderer.render(project);
    statistics.renderStatistics();
    updateCanvasInfo();
  } catch (err) {
    showToast(err instanceof Error ? err.message : '创建画布失败', 'error');
  }
}

/**
 * 更新画布信息显示。
 */
function updateCanvasInfo() {
  const project = state.getProject();
  const dims = document.getElementById('canvas-dims');
  const zoom = document.getElementById('canvas-zoom');

  if (dims && project) {
    dims.textContent = `${project.width} × ${project.height}`;
  }
  if (zoom) {
    zoom.textContent = `${Math.round(renderer.getZoom() * 100)}%`;
  }
}

/**
 * 绑定设计模式控件。
 */
function bindDesignControls() {
  const btnNew = document.getElementById('btn-new-canvas');
  const btnUploadPixel = document.getElementById('btn-upload-pixel');
  const filePixel = document.getElementById('file-pixel');

  btnNew?.addEventListener('click', () => {
    const width = Number(document.getElementById('input-width')?.value);
    const height = Number(document.getElementById('input-height')?.value);
    createNewCanvas(width, height);
  });

  btnUploadPixel?.addEventListener('click', () => filePixel?.click());

  filePixel?.addEventListener('change', async (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const file = target.files?.[0];
    if (!file) return;

    try {
      showToast('正在读取像素图...', 'success');
      const palette = getPalette();
      const pixels = await imageConvert.loadPixelImage(file, palette);

      // 创建与图片尺寸一致的项目
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const project = state.createBlankProject(img.width, img.height, palette, file.name);
      state.setProject(project);
      state.replacePixels(pixels);
      renderer.render(project);
      statistics.renderStatistics();
      updateCanvasInfo();
      showToast('像素图加载完成', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载像素图失败', 'error');
    } finally {
      target.value = '';
    }
  });
}

/**
 * 绑定转换模式控件。
 */
function bindConvertControls() {
  const btnUploadImage = document.getElementById('btn-upload-image');
  const fileImage = document.getElementById('file-image');
  const btnConvert = document.getElementById('btn-convert');
  const preview = document.getElementById('image-preview');

  btnUploadImage?.addEventListener('click', () => fileImage?.click());

  fileImage?.addEventListener('change', async (e) => {
    const target = /** @type {HTMLInputElement} */ (e.target);
    const file = target.files?.[0];
    if (!file) return;

    try {
      currentImageBitmap = await imageConvert.loadImageFile(file);

      if (preview) {
        const url = URL.createObjectURL(file);
        preview.style.backgroundImage = `url(${url})`;
        preview.classList.remove('hidden');
      }

      showToast('图片已加载，可点击生成', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '加载图片失败', 'error');
    }
  });

  btnConvert?.addEventListener('click', async () => {
    if (!currentImageBitmap) {
      showToast('请先选择一张图片', 'error');
      return;
    }

    try {
      showToast('正在转换...', 'success');
      const palette = getPalette();
      const targetWidth = Number(document.getElementById('input-target-width')?.value) || 96;
      const useDithering = /** @type {HTMLInputElement} */ (document.getElementById('chk-dithering'))?.checked ?? true;

      const imageData = imageConvert.scaleImage(currentImageBitmap, targetWidth);
      const pixels = imageConvert.convertToPixelData(imageData, palette, useDithering);

      const project = state.createBlankProject(imageData.width, imageData.height, palette, 'converted');
      state.setProject(project);
      state.replacePixels(pixels);
      renderer.render(project);
      statistics.renderStatistics();
      updateCanvasInfo();
      showToast('转换完成', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '转换失败', 'error');
    }
  });
}

/**
 * 绑定画布控制按钮。
 */
function bindCanvasControls() {
  const btnToggleGrid = document.getElementById('btn-toggle-grid');
  const btnToggleLabels = document.getElementById('btn-toggle-labels');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const zoomSlider = /** @type {HTMLInputElement} */ (document.getElementById('zoom-slider'));

  btnToggleGrid?.addEventListener('click', () => {
    renderer.setShowGrid(!btnToggleGrid.classList.contains('active'));
    btnToggleGrid.classList.toggle('active');
    const project = state.getProject();
    if (project) renderer.render(project);
  });

  btnToggleLabels?.addEventListener('click', () => {
    renderer.setShowLabels(!btnToggleLabels.classList.contains('active'));
    btnToggleLabels.classList.toggle('active');
    const project = state.getProject();
    if (project) renderer.render(project);
  });

  btnZoomOut?.addEventListener('click', () => {
    renderer.setZoom(renderer.getZoom() - 0.25);
    refreshZoom();
  });

  btnZoomIn?.addEventListener('click', () => {
    renderer.setZoom(renderer.getZoom() + 0.25);
    refreshZoom();
  });

  zoomSlider?.addEventListener('input', () => {
    renderer.setZoom(Number(zoomSlider.value) / 100);
    refreshZoom();
  });
}

/**
 * 刷新缩放显示。
 */
function refreshZoom() {
  const zoomSlider = /** @type {HTMLInputElement} */ (document.getElementById('zoom-slider'));
  if (zoomSlider) zoomSlider.value = String(Math.round(renderer.getZoom() * 100));
  updateCanvasInfo();
  const project = state.getProject();
  if (project) renderer.render(project);
}

/**
 * 绑定顶部操作按钮。
 */
function bindHeaderActions() {
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const btnExportPdf = document.getElementById('btn-export-pdf');

  btnSave?.addEventListener('click', () => {
    try {
      const data = state.serializeProject();
      downloadJson(data, `${state.getProject()?.name || 'project'}.bead.json`);
      showToast('工程已保存', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    }
  });

  btnLoad?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bead.json,application/json';
    input.addEventListener('change', async (e) => {
      const target = /** @type {HTMLInputElement} */ (e.target);
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const palette = getPalette();
        const project = state.loadProject(data, palette);
        state.setProject(project);
        renderer.render(project);
        statistics.renderStatistics();
        updateCanvasInfo();
        showToast('工程已加载', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : '加载工程失败', 'error');
      }
    });
    input.click();
  });

  btnExportPdf?.addEventListener('click', async () => {
    try {
      showToast('正在生成 PDF...', 'success');
      await exportPdf();
      showToast('PDF 导出成功', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'PDF 导出失败', 'error');
    }
  });

  // 快捷键 Ctrl+S / Cmd+S 保存
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      btnSave?.click();
    }
  });
}

/**
 * 下载 JSON 文件。
 * @param {object} data
 * @param {string} fileName
 */
function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 显示 Toast 提示。
 * @param {string} message
 * @param {'success' | 'error'} type
 */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
