/* 大屏截图目检 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const SHOTS = [
  { url: '/', name: 'home' },
  { url: '/view/sunburst', name: 'sunburst' },
  { url: '/view/index-levels', name: 'index-levels' },
  { url: '/view/grid', name: 'grid' },
];

(async () => {
  const browser = await chromium.launch();
  for (const width of [1920, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 1080 } });
    for (const s of SHOTS) {
      await page.goto(BASE + s.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: `/tmp/shot-${s.name}-${width}.png` });
    }
    await page.close();
  }
  await browser.close();
  console.log('done');
})();
