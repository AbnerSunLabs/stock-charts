# 网格组合看板与成交流水设计

> 日期：2026-09-09  
> 范围：`/view/grid` 三 Tab（计算器 | 组合看板 | 流水）；策略标的代码；档位成交流水  
> Demo：`output/grid-portfolio-journal-demo.html`（已确认）  
> 状态：已实现（migration `20260909_grid_strategy_trades` 已应用到远程）

## 1. 目标与边界

### 1.1 目标

在现有网格计算器与 `grid_strategies` 云端保存之上，增加：

1. **组合看板**：按已保存策略平铺，汇总资金压力与持仓进度；
2. **成交流水**：按档位记录买卖，同档可多轮（买→卖→买）；
3. **策略 `symbol`**：看板展示名称 + 代码。

### 1.2 双仓职责

| 仓库 | 职责 |
| --- | --- |
| `stock-charts` | 本 spec；类型 / 纯函数 / Repository / UI |
| `scheduled-tasks` | 权威 migration、`doc/supabase-schema.md` |

实施顺序：**spec → scheduled-tasks migration → 本仓实现**。

### 1.3 不复用已下线账本

不复活 `grid_plans` / `trade_records`。流水挂在 `grid_strategies` 上，新表 `grid_strategy_trades`。

### 1.4 非目标

券商同步、手续费入账、底仓份额、实时估值行情、自动弹药反推 UI、状态标签体系、分享协作。

### 1.5 产品决策摘要（已确认）

- IA：三 Tab 松耦合；计算器保留；看板聚合保存策略 + 流水；流水为时间线。
- 记账：结果表档位操作为主；量/价/日可改；默认可来自档位计划价与股数。
- 同档可循环买卖；轮次 = 该档累计卖出笔数。
- 看板无状态标签；排序：预计最大亏损 / 已占用弹药；搜索名称或代码。
- KPI（5）：预计最大投入、预计最大亏损、组合跌幅%、已实现收益、持仓市值粗估。
- 卡片：名称+代码、最大亏损、占用弹药、已实现收益、进度「持仓中 a/b · 累计 n 轮」。
- UI：无「子腿」列；聚合组展开后记账；「持仓中」用 antd `Tag color="processing"`；色板对齐现站 Coinbase token。

## 2. 信息架构与交互

### 2.1 Tab

- **计算器**：现有生成 / 保存 / 结果表（增加执行列）。
- **组合看板**：策略卡片 + 顶栏 KPI + 排序/搜索。
- **流水**：全策略或单策略筛选；侧：买卖；列含盈利金额（卖出配对后，买入为 `-`）。

### 2.2 记账弹窗

- 买入：默认价=档位买入价，量=计划买入股数，日=今天；可改。
- 卖出：默认价=档位卖出价，量=当前 openQty（不超过），日=今天。
- 卖出校验：`qty <= openQty`。

## 3. 数据模型

### 3.1 `grid_strategies` 增量

新增可空列（`schema_version` 仍为 1）：

| 字段 | 约束 |
| --- | --- |
| `symbol` | `text`，允许 null/空；`char_length(btrim(coalesce(symbol,''))) <= 32` |

列表与详情均返回 `symbol`；空则 UI 只显示 `name`。

### 3.2 `grid_strategy_trades`

| 字段 | 类型与约束 |
| --- | --- |
| `id` | `uuid` PK |
| `user_id` | `uuid` → `auth.users` ON DELETE CASCADE |
| `strategy_id` | `uuid` → `grid_strategies` ON DELETE CASCADE |
| `level_key` | `text not null`（= 快照 `GridLeg.id`） |
| `side` | `buy` \| `sell` |
| `price` | `numeric not null check (price > 0)` |
| `qty` | `integer not null check (qty > 0)` |
| `trade_date` | `date not null` |
| `created_at` | `timestamptz not null default now()` |

索引：

- `(user_id, strategy_id, trade_date desc, created_at desc)`
- `(strategy_id, level_key, created_at)`

RLS：与 `grid_strategies` 相同（owner only；不走家庭白名单）。

### 3.3 派生规则（不落库）

对 `(strategy_id, level_key)` 按 `created_at` 序：

- **openQty**：buy +qty，sell -qty；写入前 sell 不得使结果 < 0。
- **rounds**：该档 sell 笔数。
- **已实现收益**：FIFO 配对；`(sellPrice - buyPrice) * matchedQty`；本期不计费。
- **占用弹药**：未平买入成本之和。
- **持仓市值粗估**：`Σ openQty × strategy.params.basePrice`（粗估，非行情）。

看板 KPI：

- 预计最大投入 / 亏损：各策略快照 `stressTest` 聚合（投入用 `totalBudgetRequired` 或等价字段；亏损口径与现 KPI 一致）。
- 组合跌幅%：`最大亏损 / 最大投入`（投入为 0 则 0）。
- 已实现收益 / 持仓市值粗估：流水派生。

### 3.4 与更新策略

覆盖 `config` / `result_snapshot` **不删流水**。失效 `level_key` 仍保留；UI 档位显示 `-`，不可再记账。删策略 CASCADE 删流水。

## 4. 应用层模块

| 模块 | 职责 |
| --- | --- |
| `types/grid-strategy-trade.ts` | 流水类型与写入载荷 |
| `lib/grid/grid-strategy-trade-stats.ts` | openQty / rounds / PnL / 看板聚合纯函数 |
| `lib/supabase/grid-strategy-trade-repository.ts` | 流水 CRUD |
| `GridStrategyRepository` | list/get/create/update 带 `symbol` |
| `hooks/use-grid-strategy-trades.ts` | 登录后加载/刷新流水 |
| UI | Tab、看板、流水表、记账 Modal、结果表执行列 |

## 5. 验收

- 未登录：可算网格；看板/流水空态引导登录；不可记账。
- 登录后：保存策略可填 symbol；结果表可买卖；同档多轮；看板与流水数字一致。
- RLS：用户互不可见对方流水与策略。
- 无「子腿」列；持仓中为 antd Tag；主色按钮白字可读。
