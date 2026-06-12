/**
 * @file editor.js
 * @description 编辑器交互：画笔、橡皮擦、取色器、油漆桶、拖拽绘制、快捷键。
 */

import * as state from './state.js';
import * as renderer from './canvasRenderer.js';
import { findIndexByAlias } from './palette.js';

/** @typedef {'brush' | 'eraser' | 'picker' | 'fill'} Tool */

/** @type {Tool} */
let currentTool = 'brush';

/** @type {boolean} */
let isDrawing = false;

/** @type {number} */
let lastX = -1;

/** @type {number} */
let lastY = -1;

/** @type {() => void} */
let onChangeCallback = () => {};

/** @type {HTMLCanvasElement | null} */
let canvas = null;

/**
 * 设置工具变更回调。
 * @param {() => void} callback
 */
export function setOnChange(callback) {
  onChangeCallback = callback;
}

/**
 * 设置当前工具。
 * @param {Tool} tool
 */
export function setTool(tool) {
  currentTool = tool;
  if (canvas) {
    canvas.style.cursor = tool === 'picker' ? 'copy' : 'crosshair';
  }
}

/**
 * 获取当前工具。
 * @returns {Tool}
 */
export function getTool() {
  return currentTool;
}

/**
 * 初始化编辑器事件。
 * @param {HTMLCanvasElement} canvasEl
 * @param {(tool: Tool) => void} toolChangeCallback
 */
export function initEditor(canvasEl, toolChangeCallback) {
  canvas = canvasEl;

  // 鼠标事件
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  // 触摸事件
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleMouseUp);

  // 工具按钮
  document.querySelectorAll('.tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = /** @type {Tool} */ (btn.dataset.tool);
      setTool(tool);
      document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      toolChangeCallback?.(tool);
    });
  });

  // 键盘快捷键
  window.addEventListener('keydown', handleKeyDown);
}

/**
 * 处理鼠标按下。
 * @param {MouseEvent} e
 */
function handleMouseDown(e) {
  if (e.button !== 0) return;
  e.preventDefault();

  const pos = renderer.screenToGrid(e.clientX, e.clientY);
  if (!pos) return;

  isDrawing = true;
  lastX = pos.x;
  lastY = pos.y;

  applyTool(pos.x, pos.y);
}

/**
 * 处理鼠标移动。
 * @param {MouseEvent} e
 */
function handleMouseMove(e) {
  if (!isDrawing) return;
  e.preventDefault();

  const pos = renderer.screenToGrid(e.clientX, e.clientY);
  if (!pos) return;

  if (pos.x === lastX && pos.y === lastY) return;

  // 插值绘制，避免快速移动时漏掉格子
  interpolateLine(lastX, lastY, pos.x, pos.y);
  lastX = pos.x;
  lastY = pos.y;
}

/**
 * 处理鼠标释放。
 */
function handleMouseUp() {
  isDrawing = false;
  lastX = -1;
  lastY = -1;
}

/**
 * 处理触摸开始。
 * @param {TouchEvent} e
 */
function handleTouchStart(e) {
  if (e.touches.length !== 1) return;
  e.preventDefault();

  const touch = e.touches[0];
  const pos = renderer.screenToGrid(touch.clientX, touch.clientY);
  if (!pos) return;

  isDrawing = true;
  lastX = pos.x;
  lastY = pos.y;

  applyTool(pos.x, pos.y);
}

/**
 * 处理触摸移动。
 * @param {TouchEvent} e
 */
function handleTouchMove(e) {
  if (!isDrawing || e.touches.length !== 1) return;
  e.preventDefault();

  const touch = e.touches[0];
  const pos = renderer.screenToGrid(touch.clientX, touch.clientY);
  if (!pos) return;

  if (pos.x === lastX && pos.y === lastY) return;

  interpolateLine(lastX, lastY, pos.x, pos.y);
  lastX = pos.x;
  lastY = pos.y;
}

/**
 * 在两点之间插值绘制直线。
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function interpolateLine(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    applyTool(x, y);

    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * 应用当前工具到指定格子。
 * @param {number} x
 * @param {number} y
 */
function applyTool(x, y) {
  const project = state.getProject();
  if (!project) return;

  if (x < 0 || x >= project.width || y < 0 || y >= project.height) return;

  let changed = false;

  switch (currentTool) {
    case 'brush': {
      const selected = document.querySelector('.palette-swatch.active');
      if (!selected) return;
      const alias = selected.dataset.alias;
      const index = alias ? findIndexByAlias(alias) : -1;
      if (index >= 0) {
        changed = state.setPixel(x, y, index);
      }
      break;
    }
    case 'eraser': {
      changed = state.setPixel(x, y, -1);
      break;
    }
    case 'picker': {
      const picked = state.getPixel(x, y);
      if (picked >= 0) {
        const entry = project.palette[picked];
        selectPaletteByAlias(entry.alias);
        setTool('brush');
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'brush'));
      }
      break;
    }
    case 'fill': {
      const selected = document.querySelector('.palette-swatch.active');
      if (!selected) return;
      const alias = selected.dataset.alias;
      const index = alias ? findIndexByAlias(alias) : -1;
      if (index >= 0) {
        state.floodFill(x, y, index);
        changed = true;
        setTool('brush');
        document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === 'brush'));
      }
      break;
    }
  }

  if (changed) {
    renderer.render(project);
    onChangeCallback();
  }
}

/**
 * 根据别名选中色板。
 * @param {string} alias
 */
function selectPaletteByAlias(alias) {
  document.querySelectorAll('.palette-swatch').forEach((swatch) => {
    const isTarget = swatch.dataset.alias === alias;
    swatch.classList.toggle('active', isTarget);
    if (isTarget) {
      updateSelectedColorInfo(swatch);
      swatch.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

/**
 * 更新顶部选色信息。
 * @param {HTMLElement} swatch
 */
function updateSelectedColorInfo(swatch) {
  const alias = swatch.dataset.alias || '-';
  const hex = swatch.dataset.hex || '#000000';

  const elAlias = document.getElementById('selected-alias');
  const elHex = document.getElementById('selected-hex');
  const elSwatch = document.getElementById('selected-swatch');

  if (elAlias) elAlias.textContent = alias;
  if (elHex) elHex.textContent = hex;
  if (elSwatch) elSwatch.style.background = hex;
}

/**
 * 处理键盘快捷键。
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
  // 在输入框、文本域等可编辑元素中不触发工具快捷键
  const target = /** @type {HTMLElement | null} */ (e.target);
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  ) {
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        state.redo();
      } else {
        state.undo();
      }
      const project = state.getProject();
      if (project) {
        renderer.render(project);
        onChangeCallback();
      }
      return;
    }
  }

  switch (e.key.toLowerCase()) {
    case 'b':
      setToolByName('brush');
      break;
    case 'e':
      setToolByName('eraser');
      break;
    case 'i':
      setToolByName('picker');
      break;
    case 'f':
      setToolByName('fill');
      break;
  }
}

/**
 * 通过名称设置工具并更新 UI。
 * @param {Tool} tool
 */
function setToolByName(tool) {
  setTool(tool);
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
}
