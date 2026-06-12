import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 900 }
  });

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://127.0.0.1:5173/', { timeout: 60000 });
  await page.waitForTimeout(2000);

  // 截图
  await page.screenshot({ path: 'verify-screenshot.png', fullPage: false });

  // 检查关键元素
  const paletteCount = await page.locator('.palette-swatch').count();
  const canvasVisible = await page.locator('#pixel-canvas').isVisible();
  const statsVisible = await page.locator('#stats-table').isVisible();

  console.log('Palette swatches:', paletteCount);
  console.log('Canvas visible:', canvasVisible);
  console.log('Stats visible:', statsVisible);
  console.log('Console errors:', errors.length > 0 ? errors : 'none');

  // 测试绘制：通过页面内 JavaScript 触发点击事件
  const clickResult = await page.evaluate(() => {
    const canvas = document.getElementById('pixel-canvas');
    if (!canvas) return { error: 'canvas not found' };
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + 30;
    const y = rect.top + 30;

    const mousedown = new MouseEvent('mousedown', { clientX: x, clientY: y, button: 0, bubbles: true });
    const mouseup = new MouseEvent('mouseup', { clientX: x, clientY: y, button: 0, bubbles: true });
    canvas.dispatchEvent(mousedown);
    canvas.dispatchEvent(mouseup);

    const total = document.getElementById('total-beads')?.textContent;
    return { total, x, y, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } };
  });
  console.log('Click result:', clickResult);

  // 测试 PDF 导出
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-pdf')
  ]);
  const pdfPath = await download.path();
  const savePath = './verify-output.pdf';
  await download.saveAs(savePath);
  console.log('PDF saved to:', savePath);
  console.log('PDF filename:', download.suggestedFilename());

  await browser.close();
})();
