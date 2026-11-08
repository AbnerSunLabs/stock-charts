/* 仪表盘自适应验证：测量表盘 SVG 宽度与数值字号随视口的变化 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const WIDTHS = [1280, 1440, 1536, 1920, 2560];

(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 1080 } });
    await page.goto(BASE + '/view/index-levels', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);
    const data = await page.evaluate(() => {
      const svg = document.querySelector('.index-levels .gauge');
      const wrap = document.querySelector('.index-levels .gauge-wrap');
      const value = document.querySelector('.index-levels .gauge-value');
      const panel = document.querySelector('.index-levels .gauge-panel');
      return {
        svg: svg ? Math.round(svg.getBoundingClientRect().width) : null,
        wrap: wrap ? Math.round(wrap.getBoundingClientRect().width) : null,
        valueFont: value ? getComputedStyle(value).fontSize : null,
        panel: panel ? Math.round(panel.getBoundingClientRect().width) : null,
      };
    });
    console.log(
      `${width}px  面板=${data.panel}px  表盘=${data.svg}px (面板占比 ${((data.svg / data.panel) * 100).toFixed(0)}%)  数值字号=${data.valueFont}`
    );
    await page.close();
  }
  await browser.close();
})();
