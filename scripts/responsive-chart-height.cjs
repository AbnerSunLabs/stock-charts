/* 折线图高度联动验证：不同视口下 chart 宽高与宽高比 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const WIDTHS = [1280, 1440, 1536, 1920, 2560, 375];

(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    await page.goto(BASE + '/view/index-levels', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const data = await page.evaluate(() => {
      const charts = [...document.querySelectorAll('.index-levels .chart')].map(svg => {
        const r = svg.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      const gauge = document.querySelector('.index-levels .gauge');
      const g = gauge ? gauge.getBoundingClientRect() : null;
      return { charts, gauge: g ? { w: Math.round(g.width), h: Math.round(g.height) } : null };
    });
    const desc = data.charts
      .map(c => `${c.w}x${c.h} (${(c.w / c.h).toFixed(1)}:1)`)
      .join('  |  ');
    console.log(`${String(width).padStart(5)}px  折线图: ${desc || '无'}  仪表盘: ${data.gauge ? data.gauge.w + 'x' + data.gauge.h : '无'}`);
    await page.close();
  }
  await browser.close();
})();
