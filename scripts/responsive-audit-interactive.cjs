/* 交互式审计：驱动 grid 计算器生成图表/表格、sunburst 生成图表后测量 */
const { chromium } = require('playwright');

const BASE = 'http://localhost:3100';

const AUDIT = () => {
  const results = [];
  const walk = (el) => {
    for (const child of el.children) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'svg' || tag === 'canvas' || tag === 'table') {
        const rect = child.getBoundingClientRect();
        if (rect.width > 50) {
          let parent = child.parentElement;
          let pw = 0;
          while (parent && parent.getBoundingClientRect().width === 0) parent = parent.parentElement;
          if (parent) pw = parent.getBoundingClientRect().width;
          results.push({
            tag,
            cls: (child.getAttribute('class') || '').slice(0, 50),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
            pw: Math.round(pw),
            ratio: pw > 0 ? (rect.width / pw).toFixed(2) : '1',
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

const report = (title, items) => {
  console.log(`\n--- ${title} ---`);
  if (!items.length) return console.log('  (无图表/表格元素)');
  for (const i of items) {
    const flag = Number(i.ratio) < 0.92 ? ' ⚠️ 未撑满' : ' ✓';
    console.log(`  ${flag} ${i.tag.padEnd(6)} ${String(i.w).padStart(5)}x${String(i.h).padStart(4)}  父容器=${String(i.pw).padStart(5)}  占比=${i.ratio}  ${i.cls}`);
  }
};

(async () => {
  const browser = await chromium.launch();
  for (const width of [1920]) {
    const page = await browser.newPage({ viewport: { width, height: 1200 } });
    console.log(`========== viewport ${width}px ==========`);

    // 1) grid 计算器：点「生成策略」
    await page.goto(BASE + '/view/grid', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(800);
    const genBtn = page.getByRole('button', { name: /生成策略/ }).first();
    if (await genBtn.count()) {
      await genBtn.click();
      await page.waitForTimeout(1500);
      report('grid 计算器(生成后)', await page.evaluate(AUDIT));
    } else {
      console.log('\n--- grid --- 未找到「生成策略」按钮');
    }

    // 2) sunburst：填总投资额 + 生成图表
    await page.goto(BASE + '/view/sunburst', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(800);
    const totalInput = page.getByPlaceholder('请输入总投资额');
    if (await totalInput.count()) {
      await totalInput.fill('1000000');
      await page.getByRole('button', { name: '生成图表' }).click();
      await page.waitForTimeout(2500);
      report('sunburst(生成后)', await page.evaluate(AUDIT));
    } else {
      console.log('\n--- sunburst --- 未找到总投资额输入框');
    }
    await page.close();
  }
  await browser.close();
})();
