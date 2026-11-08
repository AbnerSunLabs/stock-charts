/* 全站图表/表格逐元素审计：svg、canvas、table 与父容器宽度占比 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';
const PAGES = [
  { url: '/', name: 'home' },
  { url: '/view/index-levels', name: 'index-levels' },
  { url: '/view/grid', name: 'grid-calc' },
  { url: '/view/sunburst', name: 'sunburst' },
];

const AUDIT = () => {
  const results = [];
  const walk = (el) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'svg' || tag === 'canvas' || tag === 'table') {
        const rect = child.getBoundingClientRect();
        if (rect.width > 50) {
          // 找最近的块级父容器宽度
          let parent = child.parentElement;
          let pw = 0;
          while (parent && parent.getBoundingClientRect().width === 0) parent = parent.parentElement;
          if (parent) pw = parent.getBoundingClientRect().width;
          const ratio = pw > 0 ? rect.width / pw : 1;
          results.push({
            tag,
            cls: (child.getAttribute('class') || '').slice(0, 60),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            pw: Math.round(pw),
            ratio: ratio.toFixed(2),
          });
        }
      } else {
        walk(child);
      }
    }
  };
  walk(document.body);
  return results;
};

(async () => {
  const browser = await chromium.launch();
  for (const width of [1920, 2560]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    console.log(`\n========== viewport ${width}px ==========`);
    for (const p of PAGES) {
      await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const items = await page.evaluate(AUDIT);
      const bad = items.filter(i => Number(i.ratio) < 0.92);
      console.log(`\n--- ${p.name} (${p.url}) ---`);
      if (items.length === 0) {
        console.log('  (无可测量图表元素)');
        continue;
      }
      for (const i of items) {
        const flag = Number(i.ratio) < 0.92 ? ' ⚠️' : ' ✓';
        console.log(`  ${flag} ${i.tag.padEnd(6)} ${String(i.w).padStart(5)}x${String(i.h).padStart(4)}  父容器=${String(i.pw).padStart(5)}  占比=${i.ratio}  ${i.cls}`);
      }
    }
    await page.close();
  }
  await browser.close();
})();
