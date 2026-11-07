/* 布局健康检查：各视口无横向溢出 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const PAGES = ['/', '/view/sunburst', '/view/index-levels', '/view/grid'];
const WIDTHS = [375, 768, 1366, 1920, 2560];

(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scroll: doc.scrollWidth, client: doc.clientWidth };
      });
      const ok = overflow.scroll <= overflow.client + 1;
      if (!ok) bad++;
      console.log(
        `${width}px ${url.padEnd(20)} ${ok ? 'OK' : '横向溢出!'} (scroll=${overflow.scroll}, client=${overflow.client})`
      );
    }
    await page.close();
  }
  await browser.close();
  console.log(bad === 0 ? '\n全部通过：无横向溢出' : `\n${bad} 处横向溢出`);
})();
