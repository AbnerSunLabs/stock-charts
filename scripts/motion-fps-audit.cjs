/* 动效帧稳定性实测：各页面入场动画期 + 滚动期间的掉帧情况。
 * 用法：先起独立验证服务（PROD_DIST=1 npm run start -- -p 3100），再 node scripts/motion-fps-audit.cjs
 * 判定口径：4x CPU 节流下，滚动期 p95 帧时间应 ≤ 32ms（约 60fps 的 2 帧预算），无 >100ms 卡顿。 */
const { chromium } = require('playwright');

const BASE = process.env.SMOKE_BASE || 'http://localhost:3100';
const PAGES = ['/', '/view/grid', '/view/index-levels', '/view/family', '/view/family/ledger', '/view/sunburst'];

/** 注入 rAF 采样器：返回 {frames: [dt...]}，通过 window.__motionSamples 暴露 */
const SAMPLER = `
window.__motionSamples = [];
(function sample(t0) {
  window.__rafTimes = window.__rafTimes || [];
  window.__rafTimes.push(t0);
  if (window.__rafTimes.length < 5000) requestAnimationFrame(sample);
})(performance.now());
`;

/**
 * 把帧时间序列汇总为指标。
 * @param {number[]} dts 帧间隔数组（ms）
 * @returns {{count: number, avgFps: number, p95: number, max: number, over32: number, over100: number}}
 */
function summarize(dts) {
  if (!dts.length) return { count: 0, avgFps: 0, p95: 0, max: 0, over32: 0, over100: 0 };
  const sorted = [...dts].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return {
    count: dts.length,
    avgFps: Math.round(1000 / (dts.reduce((a, b) => a + b, 0) / dts.length)),
    p95: Math.round(p95 * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    over32: dts.filter((d) => d > 32).length,
    over100: dts.filter((d) => d > 100).length,
  };
}

/** 取某时间段内的帧间隔切片 */
function sliceBetween(times, from, to) {
  const dts = [];
  for (let i = 1; i < times.length; i++) {
    if (times[i] >= from && times[i] <= to) dts.push(times[i] - times[i - 1]);
  }
  return dts;
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const url of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // 模拟低端设备，从严考核
    await page.addInitScript(SAMPLER);
    const mark = Date.now();
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) {
      console.log(`${url.padEnd(22)} 加载失败: ${e.message.split('\n')[0]}`);
      failed = true;
      await page.close();
      continue;
    }
    await page.waitForTimeout(2600); // 覆盖入场动画窗口
    const afterEntry = Date.now() - mark;

    // 平滑滚动整页，覆盖「长内容稳定满帧」要求
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.5);
      for (let y = step; y <= document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: 'smooth' });
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(800);
    const times = await page.evaluate(() => window.__rafTimes);
    const entry = summarize(sliceBetween(times, 0, afterEntry));
    const scroll = summarize(sliceBetween(times, afterEntry, Date.now() - mark));
    const badScroll = scroll.over100 > 0 || scroll.p95 > 32;
    if (badScroll) failed = true;
    console.log(
      `${url.padEnd(22)} 入场 fps≈${String(entry.avgFps).padStart(3)} p95=${String(entry.p95).padStart(6)}ms 卡>100ms:${entry.over100}` +
        ` | 滚动 fps≈${String(scroll.avgFps).padStart(3)} p95=${String(scroll.p95).padStart(6)}ms 掉帧>32ms:${scroll.over32} 卡>100ms:${scroll.over100}${badScroll ? ' ← 不达标' : ''}`
    );
    await page.close();
  }

  // reduced-motion 冒烟：强制减少动态效果后页面应正常渲染、无控制台报错
  console.log('\n===== prefers-reduced-motion: reduce 冒烟 =====');
  for (const url of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(600);
      const height = await page.evaluate(() => document.body.scrollHeight);
      console.log(`${url.padEnd(22)} 渲染正常 内容高 ${height}px 报错 ${errors.length}`);
      if (errors.length) { failed = true; errors.slice(0, 3).forEach((e) => console.log('  pageerror:', e.split('\n')[0])); }
    } catch (e) {
      console.log(`${url.padEnd(22)} 加载失败: ${e.message.split('\n')[0]}`);
      failed = true;
    }
    await ctx.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
