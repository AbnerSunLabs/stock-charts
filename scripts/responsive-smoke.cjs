/* 大屏自适应冒烟验证：测量各页面内容容器实际宽度 */
const { chromium } = require('playwright');

const BASE = process.env.SMOKE_BASE || 'http://localhost:3100';
const VIEWPORTS = [1920, 2560];
const TARGETS = [
  { url: '/', selector: 'main > div' },
  { url: '/view/sunburst', selector: '.sunburst-page' },
  { url: '/view/index-levels', selector: '.index-levels' },
  { url: '/view/grid', selector: '.site-container--grid' },
];

(async () => {
  const browser = await chromium.launch();
  for (const width of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height: 1080 } });
    console.log(`\n===== viewport ${width}px =====`);
    for (const t of TARGETS) {
      try {
        await page.goto(BASE + t.url, { waitUntil: 'networkidle', timeout: 30000 });
        const box = await page.locator(t.selector).first().boundingBox();
        if (box) {
          const sideBlank = ((width - box.width) / 2).toFixed(0);
          console.log(
            `${t.url.padEnd(22)} 容器宽 ${box.width.toFixed(0)}px | 两侧留白各 ~${sideBlank}px`
          );
        } else {
          console.log(`${t.url.padEnd(22)} 未找到容器 ${t.selector}`);
        }
      } catch (e) {
        console.log(`${t.url.padEnd(22)} 加载失败: ${e.message.split('\n')[0]}`);
      }
    }
    await page.screenshot({ path: `/tmp/resp-${width}-grid.png`, fullPage: false });
    await page.close();
  }
  await browser.close();
})();
