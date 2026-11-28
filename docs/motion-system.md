# 长流动效语言规范（Motion System）— 定稿 v1

> 依据：全项目按「状态变化」审计（83 条发现，7 高 / 42 中 / 34 低）+ agy 顾问报告合并。
> 气质基准：金融投研产品 = 冷静、精准、解释因果。响应快于意识延迟，落位干脆，绝不抢戏。
> 上限红线：除背景氛围漂移外，任何交互动效 ≤ 360ms；**退场一律比进场短 20-25%（离开不挽留）**。

## 1. Token（globals.css `:root`，全站唯一来源）

```css
:root {
  /* 时长 */
  --motion-duration-micro: 120ms;   /* 按压、悬停高亮、图标切换、焦点环、Tooltip */
  --motion-duration-small: 180ms;   /* 下拉/Popover、分段滑块、徽章显隐、金额显隐、内容淡切 */
  --motion-duration-medium: 240ms;  /* Tab 内容、折叠面板、侧栏收展、居中弹窗、状态岛 */
  --motion-duration-large: 320ms;   /* 抽屉滑入、页面态切换、图表重绘、大块入场 */
  /* 退场时长 */
  --motion-duration-exit-small: 140ms;
  --motion-duration-exit-medium: 180ms;
  --motion-duration-exit-large: 240ms;
  /* 曲线 */
  --motion-ease-out: cubic-bezier(0.22, 1, 0.36, 1);       /* 进场/落位（GSAP power3.out）*/
  --motion-ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1); /* 跟手位移（GSAP power2.inOut）*/
  --motion-ease-spring: cubic-bezier(0.34, 1.32, 0.64, 1);  /* 轻弹：仅打勾/开关/圆点，严禁大卡片弹窗 */
  --motion-ease-in: cubic-bezier(0.4, 0, 1, 1);             /* 退场（GSAP power2.in）*/
  /* Stagger */
  --motion-stagger-item: 30ms;   /* 列表行 */
  --motion-stagger-card: 40ms;   /* 卡片 */
  /* 空间 */
  --motion-shift-sm: 6px;
  --motion-shift-md: 12px;
  --motion-press-scale: 0.98;
  /* 骨架 */
  --bg-skeleton: #e9edf2;        /* 修复未定义的 --bg-muted */
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-micro: 0ms;  --motion-duration-small: 0ms;
    --motion-duration-medium: 0ms; --motion-duration-large: 0ms;
    --motion-duration-exit-small: 0ms; --motion-duration-exit-medium: 0ms;
    --motion-duration-exit-large: 0ms; --motion-shift-sm: 0px; --motion-shift-md: 0px;
    --motion-press-scale: 1;
  }
}
```

废除旧 token（`--ease-out-expo`、`--ease-in-out-smooth`、`--duration-fast`、`--duration-normal`、home-final-b 局部 `--ease`），所有引用迁到 `--motion-*`。

**Stagger 约束**：仅首屏前 8 个可见节点参与；总错峰 ≤ 180ms（GSAP `stagger: { each: 0.03, amount: 0.18 }`）；仅「首次打开/首次生成」播放，数据局部更新严禁重播整列。

## 2. antd ConfigProvider 映射（antd-provider.tsx 注入，grid-antd-provider 继承）

```ts
motionDurationFast: '0.12s',   // Tooltip / Switch / hover（= --motion-duration-micro）
motionDurationMid: '0.18s',    // Dropdown / Modal / Tabs inkBar（= --motion-duration-small）
motionDurationSlow: '0.24s',   // Drawer / Collapse（= --motion-duration-medium）
motionEaseOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
motionEaseInOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
```
`prefers-reduced-motion` 时（用 `usePrefersReducedMotion()` 监听）把三个 duration token 置 `0s`，实现全组件动效关闭。
静态 `message` 全部改 `App.useApp()`（grid page / grid-result-table / sunburst page）。

## 3. GSAP 收口（新建 `src/lib/motion.ts`）

`gsap.registerPlugin(useGSAP)` 只做一次；`gsap.defaults({ duration: 0.24, ease: 'power3.out', overwrite: 'auto' })`；导出 `MOTION` 常量（与 CSS token 同值）与 `isReducedMotion()`。业务组件禁止再手写 `matchMedia`。

## 4. 状态变化 → 模式（唯一对照表）

| 类别 | 模式 | 参数 |
|---|---|---|
| 悬停 | 只过渡 color/bg/border/shadow，卡片可 translateY(-2px)；禁 `transition: all` | micro~small + ease-out |
| 按压 | `:active:not(:disabled) { scale(var(--motion-press-scale)) }`（大卡 0.992）；删掉 `transform: none` 的反例 | micro |
| 图标切换 | 叠层 crossfade + scale(0.85→1)，方向感用 rotate | micro |
| 下拉/Popover | opacity + translateY(-4px) + scale(0.98→1)，origin 顶部；箭头 rotate 180° | small 进 / exit-small 出 |
| 抽屉/弹窗 | 遮罩 opacity；面板 translateX/scale；**退场完整保留**（`afterClose` 再清数据，禁止早卸载） | large 进 / exit-large 出 + out/in |
| Tab/分段切换 | 新内容 opacity+translateY(6px) 淡入；分段 thumb 用 translateX 滑块 | small + standard |
| 折叠展开 | `grid-template-rows: 0fr→1fr` + 内容 fade + Chevron 旋转 + 「展开/收起」文案同步 | medium + out |
| 大块入场 | opacity + translateY(var(--motion-shift-md))，卡片组 stagger | large + out |
| 高频重算 | 纯 fade 或不动 | small |
| 加载 | 同高骨架 + 柔和扫光 1.6s；到达后 fade 覆盖；严禁先闪 Empty | small |
| 数值跳动 | 旧值保持到新值到达 + 新值 opacity 0.4→1 微闪；**不做滚动计数器**（金融忌误导读数） | small |
| 金额显隐 | blur(6px)+opacity 淡切或同宽掩码；G2 图表**禁止 key 重挂载**，只更新 formatter | small |
| 行删除 | 该行 fade+收起再更新数据 | small~medium |
| 表格行 hover | background-color 过渡 | micro~small |
| SVG 显隐 | path 常挂 + opacity 过渡；虚线用 translateY | small |
| 程序滚动 | `behavior: isReducedMotion() ? 'auto' : 'smooth'`，与入场错峰 | — |
| 骨架/装饰循环 | reduced-motion 下静态化（pulse/漂移/水波全停） | — |

## 5. 性能与可访问性红线

1. 只动 transform/opacity（颜色过渡允许）；Tooltip 定位用 `translate3d` 不写 left/top；禁止 `transition: all`。
2. `prefers-reduced-motion` 五层全覆盖：CSS token 归零 + 全局 `*` 兜底块 + antd duration 置 0 + GSAP/图表跳过 + scrollIntoView 退化。归零后必须立即到终态，不许卡隐藏态。
3. 满帧：4x CPU 节流下滚动 p95 帧时间 ≤ 32ms、无 >100ms 卡顿（`scripts/motion-fps-audit.cjs` 实测交付）。水波图用 IntersectionObserver 只动视口内；sticky 条慎用 backdrop-filter；首页漂移在 `visibilitychange` 隐藏时暂停。
4. CLS≈0：骨架与内容严格等高（指标卡 min-height）；全站数字 `tabular-nums`（修正 .px 的 proportional-nums）；金额列定宽右对齐。
5. 键盘：自建浮层 Focus Trap + 关闭后焦点归还触发按钮。
6. 手机/窄窗/宽屏全成立；动效全走 CSS 变量，未来暗色主题自动继承。

## 6. 文案规范

**基准**：对齐首页品牌气质——克制、平实、说人话、不卖萌、不露代码词。

| 状态 | 规范 | 范例 |
|---|---|---|
| 加载中 | `正在[动词][对象]…`，中文省略号 | 正在核验登录状态… / 正在读取收盘数据… |
| 空状态 | 「还没有…/暂无…」+ 动作引导 | 还没有保存的策略，生成后点「保存策略」即可存到这里 |
| 进行中 | `[动词]中…` 按钮原位替换 | 保存中… / 更新中… / 导出中… |
| 成功 | `已[动词][对象]` 2-8 字，无标点；原地有确认就不弹 toast | 已保存策略 / 已删除该笔流水 |
| 出错 | `[对象][动作]失败` + 下一步，禁露变量名/状态码/英文枚举 | 未能读取收盘数据，请稍后重试 |

**必改清单**（agy 逐条核对）：
- `basePrice/minPrice` 暴露 → 「重新调整基准价与最低价」（grid page L667）
- 「感官模式」→「扩张节奏」（grid-step-config L322）
- 「等差指数模型（系数: 0）」→「固定步长」/「动态步长（基础 5%，系数 0.3）」（grid-step-config L409-418）
- 展开永远显示「展开」→ 随状态切换（grid-params-panel L125）
- `<Empty description="加载中…">` → 骨架屏 + 「正在加载组合看板…」（grid-portfolio-board L115）
- 「搜索标的...」→「搜索策略名或代码」；「组合跌幅%」→「最大回撤幅度」
- `'?'` 兜底 →「未命名策略」；电报体空态改写（grid-trade-journal L78/L224）
- 保存岛/下载按钮 loading 时文案切「保存中…/导出中…」
- 「校验登录…/鉴权失败」→「正在核验登录状态…/登录状态核验失败，请重试」（auth-gate，Spin tip 需嵌套容器）
- 保单英文枚举 `lapsed/pending` → 已失效/待生效（family-policies L209）
- 「你们好棒棒/继续保持哦/需要抓紧存钱啦」→ 领先于计划/与计划同步/落后于计划（mental-account.ts L94-99）
- 「对照性的一句没有单列。」→ 改写（index-essay-rail L39）
- 「读取收盘/收盘暂时读不出来」→「正在读取收盘…」+「重新加载」按钮（index-level-chart L111）
- 根面包屑「工具集」→「长流」

## 7. 已知边界

- 项目当前无暗色主题实现（无 prefers-color-scheme/data-theme）——动效全部基于 CSS 变量，未来接入暗色时颜色过渡自动成立，不预造主题系统。
- 4 个无引用旧首页组件（home-tool-grid/home-tool-card/home-family-finance-section/home-family-finance-card）与其 CSS 段一并删除。
- index-level-gauge / index-quote-ledger / index-strategy-cards 当前未被页面引用：保留并补上规范动效（防止误挂时闪烁），不删除。
