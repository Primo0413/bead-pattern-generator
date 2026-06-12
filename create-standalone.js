import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distDir = path.join(root, 'dist-single');
const assetsDir = path.join(distDir, 'assets');
const outFile = path.join(root, 'bead-pattern-generator.html');

// 自动发现构建后的 CSS 和 JS 文件名
const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') && f.startsWith('index-'));
const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css') && f.startsWith('index-'));
if (jsFiles.length !== 1 || cssFiles.length !== 1) {
  console.error('错误：dist-single/assets 中 JS 或 CSS 文件不唯一');
  process.exit(1);
}
const jsFile = jsFiles[0];
const cssFile = cssFiles[0];

// 读取构建产物
let html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
let js = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');

// 读取色号库并转为 base64 data URI
const paletteJson = fs.readFileSync(path.join(root, 'assets', 'color-aliases.json'), 'utf8');
const paletteBase64 = Buffer.from(paletteJson).toString('base64');
const paletteDataUri = `data:application/json;base64,${paletteBase64}`;

// 将 JS 中对色号库的请求替换为内联 data URI
js = js.replace('./assets/color-aliases.json', paletteDataUri);

// 转义内联脚本中可能出现的 </script>，避免 HTML 解析器提前关闭 script 标签
js = js.replace(/<\/script>/gi, '<\\/script>');

// 直接定位并替换原 HTML 中的 link/script 标签
const cssLinkMatch = html.match(/<link rel="stylesheet" crossorigin href="\.\/assets\/index-[^"]+\.css">/);
if (!cssLinkMatch) {
  console.error('错误：未找到 CSS link 标签');
  process.exit(1);
}
html = html.replace(cssLinkMatch[0], `<style>\n${css}\n</style>`);

const scriptTagMatch = html.match(/<script[^>]+src="[^"]*index-[^"]+\.js"[^>]*><\/script>/);
if (!scriptTagMatch) {
  console.error('错误：未找到 JS script 标签');
  process.exit(1);
}
// 使用 split-join 避免 replace 对特殊字符的处理问题
html = html.split(scriptTagMatch[0]).join(`<script type="module">\n${js}\n</script>`);

fs.writeFileSync(outFile, html, 'utf8');
console.log(`已生成独立 HTML 文件：${outFile}`);
console.log(`文件大小：${(fs.statSync(outFile).size / 1024).toFixed(1)} KB`);

// 简单校验
const oldScriptCount = (html.match(/index-[^"]+\.js/g) || []).length;
const scriptTagCount = (html.match(/<script/g) || []).length;
console.log(`剩余外部 JS 引用：${oldScriptCount}`);
console.log(`script 标签数：${scriptTagCount}`);
if (oldScriptCount > 0) {
  console.error('错误：未成功内联 JS，请检查正则');
  process.exit(1);
}
