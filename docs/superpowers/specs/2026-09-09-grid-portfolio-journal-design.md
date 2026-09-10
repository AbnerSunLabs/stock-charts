# 网格组合看板与成交流水设计

> 日期：2026-09-09  
> 范围：`/view/grid` 三 Tab（组合看板 | 计算器 | 流水）；策略标的代码；档位成交流水  
> Demo：`output/grid-portfolio-journal-demo.html`（已确认）  
> 状态：已实现（migration `20260909_grid_strategy_trades` 已应用到远程）

## 1. 目标与边界

### 1.1 目标

在现有网格计算器与 `grid_strategies` 云端保存之上，增加：

1. **组合看板**：按已保存策略平铺，汇总资金压力与持仓进度；
2. **成交流水**：按档位记录买卖，同档可多轮（买→卖→买）；
3. **策略 `symbol`**：看板展示名称 + 代码。

### 1.2 双仓职责

| 仓库              | 职责                                     |
| ----------------- | ---------------------------------------- |
| `stock-charts`    | 本 spec；类型 / 纯函数 / Repository / UI |
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
- 看板无状态标签；排序：预计最大亏损 / 已投入金额；搜索名称或代码。
- KPI（5）：预计最大投入、预计最大亏损、组合跌幅%、已实现收益、买入成本价。
- 卡片：名称+代码旁 `EditOutlined` 打开同一套编辑浮层（名称 / 标的 / 备注）；备注 Tag（单行溢出 `…`，hover 看全文）、最大亏损、已投入金额、已实现收益、进度「持仓中 a/b · 累计 n 轮」。同排卡片等高，无备注也占一行高度。
- 页头「创建网格策略」另起空白草稿；保存浮层名称与标的代码必填，备注可选写入 `config.note`。
- UI：无「子腿」列；聚合组展开后记账；「持仓中」用 antd `Tag color="processing"`；色板对齐现站 Coinbase token。

## 2. 信息架构与交互

### 2.1 Tab

- **组合看板**：策略卡片 + 顶栏 KPI + 排序/搜索。
- **计算器**：现有生成 / 保存 / 结果表（增加执行列）。
- **流水**：全策略或单策略筛选；侧：买卖；列含盈利金额（卖出配对后，买入为 `-`）。操作列「删除」须 `modal.confirm` 二次确认后再调删除接口。

### 2.2 记账弹窗

- 买入：默认价=档位买入价，量=计划买入股数，日=今天；可改。
- 卖出：默认价=档位卖出价，量=`min(openQty, 计划卖出股数)`（不超过 openQty），日=今天。
- 成交日 DatePicker 的表单值须使用已扩展 weekday/localeData 的 dayjs 实例。
- 卖出校验：`qty <= openQty`。
- 结果表执行列：该档**最后一笔是买入**才显示「持仓中 / 卖出」；最后一笔是卖出或无流水则显示「买入」。留利底仓使 `openQty > 0` 时仍应能进入下一轮买入。
- 结果表「轮次」列（档位右侧）：antd Tag 显示该档卖出笔数，默认 `0`；主色蓝随轮次加深。聚合组折叠时为子档轮次之和；展开后组合行为 `-`，各档自己显示。执行列不再写「已完成 n 轮」。
- Demo：`output/grid-level-rounds-tag-demo.html`。

## 3. 数据模型

### 3.1 `grid_strategies` 增量

新增可空列（`schema_version` 仍为 1）：

| 字段     | 约束                                                                  |
| -------- | --------------------------------------------------------------------- |
| `symbol` | `text`，允许 null/空；`char_length(btrim(coalesce(symbol,''))) <= 32` |

列表与详情均返回 `symbol`。保存/重命名浮层中标的代码为必填；历史空值仍只显示 `name`。

### 3.2 `grid_strategy_trades`

| 字段          | 类型与约束                                   |
| ------------- | -------------------------------------------- |
| `id`          | `uuid` PK                                    |
| `user_id`     | `uuid` → `auth.users` ON DELETE CASCADE      |
| `strategy_id` | `uuid` → `grid_strategies` ON DELETE CASCADE |
| `level_key`   | `text not null`（= 快照 `GridLeg.id`）       |
| `side`        | `buy` \| `sell`                              |
| `price`       | `numeric not null check (price > 0)`         |
| `qty`         | `integer not null check (qty > 0)`           |
| `trade_date`  | `date not null`                              |
| `created_at`  | `timestamptz not null default now()`         |

索引：

- `(user_id, strategy_id, trade_date desc, created_at desc)`
- `(strategy_id, level_key, created_at)`

RLS：与 `grid_strategies` 相同（owner only；不走家庭白名单）。

### 3.3 派生规则（不落库）

对 `(strategy_id, level_key)` 按 `created_at` 序：

- **openQty**：buy +qty，sell -qty；写入前 sell 不得使结果 < 0。
- **rounds**：该档 sell 笔数。
- **已实现收益**：FIFO 配对；`(sellPrice - buyPrice) * matchedQty`；本期不计费。
- **已投入金额**：未平买入成本之和（含已从快照移除的失效档）。原看板文案「已占用弹药」。
- **买入成本价**：未平买入成本之和（与卡片「已投入金额」同一口径；含失效档未平仓）。
- **持仓中 a/b**：`a` = 当前快照档中**最后一笔是买入**的个数（与结果表「持仓中」相同，留利底仓不算）；`b` = 当前快照档位数。失效档不进 `a`。

看板 KPI：

- 预计最大投入 / 亏损：各策略**最新保存**快照 `stressTest` 聚合。投入用 `totalBudgetRequired`（无 V2 则 `totalBuyAmount`）；亏损 = `投入 − 计划买入总股数 × 保存的最低价`（股数用 `totalBuyShares`，不用底仓 `remainingShares`），下限 0。
- 组合跌幅%：`最大亏损 / 最大投入`（投入为 0 则 0）。
- 已实现收益 / 买入成本价：流水派生。

同名字段在计算器 / 看板 / 流水之间的对照与数字例子见 [`2026-09-10-grid-display-field-glossary.md`](./2026-09-10-grid-display-field-glossary.md)。

### 3.4 与更新策略

覆盖 `config` / `result_snapshot` **不删流水**。失效 `level_key` 仍保留；UI 档位显示 `-`，不可再记账。删策略 CASCADE 删流水。

## 4. 应用层模块

| 模块                                             | 职责                                        |
| ------------------------------------------------ | ------------------------------------------- |
| `types/grid-strategy-trade.ts`                   | 流水类型与写入载荷                          |
| `lib/grid/grid-strategy-trade-stats.ts`          | openQty / rounds / PnL / 看板聚合纯函数     |
| `lib/supabase/grid-strategy-trade-repository.ts` | 流水 CRUD                                   |
| `GridStrategyRepository`                         | list/get/create/update 带 `symbol`          |
| `hooks/use-grid-strategy-trades.ts`              | 登录后加载/刷新流水                         |
| UI                                               | Tab、看板、流水表、记账 Modal、结果表执行列 |

## 5. 验收

- 未登录：可算网格；看板/流水空态引导登录；不可记账。
- 登录后：保存策略可填 symbol；结果表可买卖；同档多轮；看板与流水数字一致。
- RLS：用户互不可见对方流水与策略。
- 无「子腿」列；持仓中为 antd Tag；主色按钮白字可读。
