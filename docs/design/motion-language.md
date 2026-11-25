# 动效语言（Motion Language）

一套全站共用的时长与曲线。同类状态变化用同一节奏，不每处自己发明。

## Token（定义于 `src/app/globals.css`）

| Token | 值 | 用途 |
| --- | --- | --- |
| `--duration-micro` | 0.1s | 按压、开关滑块、箭头旋转向 |
| `--duration-fast` | 0.16s | 悬停、小元素状态切换（颜色/透明度）、内容淡入 |
| `--duration-normal` | 0.24s | 进出场、面板滑入滑出、页面级一次性淡入 |
| `--duration-exit` | 0.14s | 退场（比进场快，用户已知道结果） |
| `--ease-out-expo` | cubic-bezier(0.16, 1, 0.3, 1) | 进场、出现 |
| `--ease-in-out-smooth` | cubic-bezier(0.65, 0, 0.35, 1) | 对称变化：移动、宽度塌缩、遮罩淡入淡出 |
| `--ease-snappy` | cubic-bezier(0.2, 0, 0, 1) | 微交互：悬停、按压、选中色 |
| `--ease-in-quick` | cubic-bezier(0.4, 0, 1, 1) | 退场加速 |

Ant Design 侧由 `src/components/app-shell/antd-provider.tsx` 的
`motionDuration*` / `motionEase*` token 对齐同一套值，Modal / Drawer / Message /
Dropdown 等弹层反馈随之统一；嵌套的网格页 Provider 自动继承。

## 原则

1. **动效解释状态变化**：出现/消失/换内容要有来有去；用户反复操作的更快（micro/fast）。
2. **只动合成层属性**：transform / opacity 优先。允许的例外：投研侧栏宽度塌缩、
   summary-bar 的 border-color（范围小、元素少、一次性）。
3. **退场必须完整**：弹层关闭先播退场再卸载，用 `src/hooks/use-presence.ts`
   （`usePresence`）统一处理；不要在 open 变 false 时直接 `return null`。
4. **克制**：宁少勿乱。金额滚数、表格逐行入场、整页出入场串联、股价闪烁等一律不做。
5. **尊重系统偏好**：全局 `prefers-reduced-motion` 兜底把 CSS 动效归零；
   JS 侧统一走 `src/lib/prefers-reduced-motion.ts` 的 `prefersReducedMotion()`
   （GSAP、`scrollIntoView({behavior:'smooth'})`、`usePresence` 共用，勿再内联 matchMedia）。
6. **跟手**：悬停卡、拖拽平移不加位移过渡，出现只做一次淡入。

## 典型模式

- **页面/视图进场**：根容器 `viewFadeIn`（0.24s，一次性）。
- **页签内容切换**：容器 `key` 随页签变 + `viewFadeIn`。
- **侧滑面板**（E大怎么说）：backdrop 淡入 + 面板 `translateX`，进出同曲线，退场走 `usePresence`。
- **下拉菜单**（选择指数）：transform-origin 在触发处的轻放大 + 淡入，退场反向。
- **状态徽标/提示**（未保存 chip、dirty hint）：出现时 `grid-fade-in`（opacity only）。
- **图标换向**（菜单折叠、金额显隐）：换节点 + key 重挂载触发一次 0.24s 淡入缩放。
- **成功确认**（保存岛对勾、命名浮层）：一拍确认即退，持久状态交给页面上的常驻元素接续。

## 挂账（本次未做、后续再议）

- 加载失败与"成功为空"在网格看板/流水/家庭总览的数据层尚未完全区分（失败会落到空态），
  需要数据流层面的错误保留策略，动效层已就位（骨架/错误/空态三态样式齐备）。
- 家庭财务趋势图以金额显隐为 `key` 重挂载（规避 G2 轴文案更新时折线路径残留），
  切换时整图重建一次；根因在图表库更新策略，改它需要单独验证。
- 网格主 Tab 三分支是条件渲染：切走再切回会重挂载看板（重拉收盘价、丢搜索/排序状态）。
  这是基线就有的行为（本次 `key` 包裹层未新增卸载）；要根治需把非活跃页签保活
  （`display:none` 保挂载），涉及数据刷新策略，另开任务处理。
- 弹层退场窗口（≤280ms）内离屏元素理论上仍可被 Tab 命中：焦点已在关闭时移出，
  未再对内部元素设 `inert`（React 18 类型不支持，等升级 React 19 后补）。
- E大侧栏打开期间未做焦点圈闭（aria-modal 的完整语义需要 focus trap），
  背景 Tab 顺序仍可到达；目前只保证开/关的焦点交接正确。
- 侧栏折叠的文字收拢在过渡前半段会被轨宽裁切边缘（约 90ms 的中间帧），
  彻底消除需要给菜单项加稳定内层布局的重构，收益有限暂缓。
