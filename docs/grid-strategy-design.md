# 网格策略体系设计文档

> 版本：v0.1  
> 日期：2026-07-03  
> 范围：仅面向 ETF 网格策略体系升级，不覆盖个股、期货、期权、杠杆融资或自动交易接入。  
> 定位：这是后续代码落地的策略规格说明，不是投资建议。所有规则用于工具计算、风险提示与参数生成，最终交易决策仍由使用者承担。

## 0. 文档目标

本文只解决 Phase 0：把网格策略升级所需的底层规则、指标口径和数据源关系写清楚，供后续 AI 或开发者按阶段落地。

后续实现必须优先遵守本文的四类契约：

| 契约类型 | 本文覆盖内容                                       | 后续落地要求                                       |
| -------- | -------------------------------------------------- | -------------------------------------------------- |
| 策略原则 | 第一性原理、收益来源、主要风险、ETF 约束           | 不允许用主观预测替代规则化门控                     |
| 计算规则 | 网格价位、兜底网、资金反推、跨层聚合、成本、底仓   | 纯函数实现，单元测试覆盖边界                       |
| 指标体系 | 相关性、波动、流动性、震荡性、估值、趋势、汇金代理 | 指标口径必须可复算、可追溯                         |
| 数据映射 | 字段、来源候选、刷新频率、缓存、降级、校验         | 免费源先做 spike，接口不可用时必须降级并展示时间戳 |

本文明确不做以下事情：

- 不修改现有代码。
- 不新增接口、页面、依赖或环境变量。
- 不给出实时可用的第三方接口 URL 承诺。免费源稳定性必须在 Phase 2 spike 中实测确认。

## 1. 现状与背景

### 1.1 项目现状

当前 `stock-charts` 是一个 Next.js 14 App Router 项目，网格策略页的核心路径如下：

| 模块                                | 当前职责                                         | 与本次升级的关系                                     |
| ----------------------------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `src/app/view/grid/page.tsx`        | 网格策略页，管理参数、动态步长开关、计算结果展示 | Phase 1 会在此接入新参数、新结果卡片和聚合表格       |
| `src/hooks/use-grid-params.ts`      | 管理 `GridParams` 与参数校验                     | Phase 1 会扩展参数模型，如总弹药、交易成本、聚合阈值 |
| `src/hooks/use-grid-calculator.ts`  | 包装计算调用                                     | Phase 1 继续保持薄封装                               |
| `src/lib/grid-calculator.ts`        | 生成小/中/大网明细与压力测试                     | Phase 1 的主要改造点                                 |
| `src/lib/grid-validate-params.ts`   | 校验基础价格、步长和系数                         | Phase 1 需要新增成本、预算、兜底、精度校验           |
| `src/types/grid.ts`                 | 网格输入、行、压力测试类型                       | Phase 1 需要扩展为 V2 类型                           |
| `__tests__/grid-calculator.test.ts` | 当前计算器单测                                   | Phase 1 需要补充本文列出的边界用例                   |

当前实现是纯本地计算，不依赖外部行情或估值数据。Phase 2 之后才引入数据层与指标计算。

### 1.2 当前计算模型摘要

当前 `calculateGridStrategy(params, options)` 的核心模型：

| 维度     | 当前规则                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 标的类型 | 未显式限制，但默认按 ETF 参数使用                                                                                      |
| 三层网格 | 小网从 `basePrice` 开始；中网从 `basePrice * (1 - mediumGridStep)` 开始；大网从 `basePrice * (1 - largeGridStep)` 开始 |
| 资金模型 | 先输入 `amountPerGrid`，再汇总 `totalBuyAmount`                                                                        |
| 买入加码 | `amountPerGrid * (1 + amountMultiplier * (1 - positionRatio))`                                                         |
| 动态步长 | 稳健模式 scale=0.3，抄底模式 scale=0.6，逐档放大                                                                       |
| 最低价   | `buyPrice <= minPrice` 时直接停止，没有兜底网                                                                          |
| 交易成本 | 只有 `priceUnit * 5` 的触发价滑点展示，利润未扣佣金和滑点                                                              |
| 留利     | `profitReserveMultiplier` 影响卖出股数，但底仓没有单独统计                                                             |
| 压力测试 | 汇总买入金额、卖出金额、剩余股数、利润、收益率                                                                         |

### 1.3 当前问题与理想目标

| 维度     | 当前状态                                 | 理想目标                                                                   |
| -------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| 资金管理 | 先设单格金额，再被动得出总投入           | 先设总弹药和最低价，再反推单格金额，确保压力测试不超预算                   |
| 风险边界 | 跌到 `minPrice` 前停止，缺少最后一格防线 | 最后一网夹到 `minPrice` 硬地板（计划内买入价不得更低）；市价跌破后停止加码 |
| 步长     | 固定 5% / 15% / 30%，与 ETF 波动率无关   | 小网步长锚定 ATR 和交易成本，中大网表达不同周期                            |
| 三层重叠 | 多层同价位资金可能同时触发但未聚合展示   | 价位聚合展示资金压力，内部仍分层记账和配对卖出                             |
| 交易成本 | 利润未扣佣金、滑点和成本覆盖下限         | ETF 佣金万 1 免 5、免印花税、免过户费入模                                  |
| 底仓     | 留利股份混在压力测试利润中               | 底仓股数、成本、市值、浮盈与网格滚动利润分开                               |
| 趋势     | 无趋势与估值门控                         | 趋势只做节流阀，不做方向预测                                               |
| 标的筛选 | 无数据层、无指标体系                     | 用免费数据自算相关性、波动、流动性、估值、适配度                           |

## 2. 第一性原理分析

### 2.1 网格策略的本质

网格策略不是预测系统，而是机械化的库存管理系统。

它把价格波动拆成一组可执行的买入线和卖出线：

1. 价格下跌到某一网格线时买入。
2. 价格反弹到上一网格线或目标卖出线时卖出。
3. 通过多次买低卖高，把震荡转化为现金利润。
4. 通过留利机制，把部分利润转化为长期底仓。

抽象收益公式：

```text
单次网格净收益
= 卖出成交金额
- 买入成交金额
- 买入佣金
- 卖出佣金
- 双边滑点损耗
+ 留存底仓按评估价计入的市值变化
```

核心收益来源：

| 来源     | 解释                               | 可控变量                                |
| -------- | ---------------------------------- | --------------------------------------- |
| 波动捕获 | 标的在区间内上下震荡，触发多轮买卖 | 步长、交易成本、T+0 属性                |
| 均值回归 | 跌后反弹到上一档或均值附近         | 标的选择、估值门控、趋势节流            |
| 底仓积累 | 每轮卖出时保留一部分股份           | `profitReserveMultiplier`、卖出股数公式 |

核心风险来源：

| 风险       | 表现                       | 控制方式                           |
| ---------- | -------------------------- | ---------------------------------- |
| 单边下跌   | 库存越买越多，资金耗尽     | 总弹药反推、最低价兜底、跌破停止   |
| 单边上涨   | 网格卖出后踏空             | 底仓留存、估值高位只卖不买         |
| 波动不足   | 长时间不成交               | ATR 步长推荐、震荡性筛选           |
| 步长过密   | 成本侵蚀收益               | 成本覆盖下限、交易成本模型         |
| 标的不适合 | 流动性差、溢价大、清盘风险 | ETF 筛选硬门槛                     |
| 数据失真   | 指标滞后或源不可用         | 数据时间戳、主备降级、数据质量评分 |

### 2.2 设计公理

后续所有实现必须满足以下公理。

#### 公理 A：先定义生存边界，再追求收益

网格最大的风险不是少赚，而是在下跌过程中资金先耗尽。  
因此资金管理顺序必须从：

```text
错误顺序：单格金额 -> 总投入 -> 事后发现是否超预算
```

改为：

```text
正确顺序：总弹药 -> 最低价 -> 网格结构 -> 反推单格金额 -> 压力测试
```

#### 公理 B：`minPrice` 是计划买入价硬地板，也是市价加码停止线

`minPrice` 表示用户设定的**最低买入边界**与**自动加码停止线**：

- **计划内**：所有档位买入价必须 `>= minPrice`；触及边界时最后一网夹到 `minPrice`，不得更深。
- **市价**：当 `currentPrice <= minPrice` 时不再自动补仓，状态改为「跌破网格区间，等待回到区间或人工重评」。

向下生成时，每层最后一网取（见 4.5 节）：

```text
lastGridPrice = round_up_to_tick(minPrice)
```

当下一档理论价已 `<= minPrice`（或层达到档位上限仍高于边界）时，补一档到该硬地板后停止该层。

#### 公理 C：步长必须大于成本，并且贴合标的波动

网格步长太小会被成本磨损，太大会长期不成交。  
小网步长必须同时满足：

```text
smallGridStep >= costCoverageStep
smallGridStep ≈ f(ATR20%, 日均振幅, T+0 属性)
```

其中 `costCoverageStep` 是双边佣金和滑点的最低覆盖线。

#### 公理 D：趋势只做节流阀，不做预测器

网格策略的优势是放弃主观预测。  
趋势和估值只能控制“买入火力”和“是否开网”，不能变成主观择时。

#### 公理 E：三层网格代表三种周期，不允许因为价位接近而丢失语义

小网、中网、大网分别代表短周期、中周期、深跌周期。  
价位接近时可以聚合展示资金压力，但内部买卖配对必须保持独立。

#### 公理 F：ETF 口径优先

本文所有成本、流动性、估值和数据源都按 ETF 设计：

- ETF 免印花税。
- ETF 免过户费。
- 默认佣金为万 1，且免 5 元最低佣金。
- 最小交易单位默认 100 份。
- 是否 T+0 必须按 ETF 类型标注。

## 3. 术语与变量定义

### 3.1 基础价格变量

| 变量                       | 类型                             | 含义                                                | 默认或来源                        |
| -------------------------- | -------------------------------- | --------------------------------------------------- | --------------------------------- |
| `symbol`                   | string                           | ETF 代码，如 `510300`                               | 用户选择或筛选页传入              |
| `exchange`                 | <code>'SSE' &#124; 'SZSE'</code> | 交易所                                              | 代码规则或数据源返回              |
| `basePrice` / `P0`         | number                           | 网格基准价                                          | 用户输入，后续可由最新价带入      |
| `minPrice` / `Pmin`        | number                           | 计划买入价硬地板与市价加码停止线；最后一网见 4.5 节 | 用户输入                          |
| `priceUnit` / `tickSize`   | number                           | 最小报价单位                                        | 默认 `0.001`，按 ETF 实际规则校验 |
| `minTradeUnit` / `lotSize` | number                           | 最小交易单位                                        | ETF 默认 `100`                    |
| `currentPrice`             | number                           | 当前最新价                                          | Phase 2 行情源                    |

约束：

```text
basePrice > 0
minPrice > 0
minPrice < basePrice
priceUnit > 0
minTradeUnit >= 1
```

### 3.2 网格层变量

| 变量                 | 类型                                                | 含义                    |
| -------------------- | --------------------------------------------------- | ----------------------- |
| `gridType`           | <code>'small' &#124; 'medium' &#124; 'large'</code> | 小网、中网、大网        |
| `gridLabel`          | <code>'小网' &#124; '中网' &#124; '大网'</code>     | UI 展示名               |
| `initialStepPct`     | number                                              | 该层初始步长，百分比    |
| `stepRatio`          | number                                              | `initialStepPct / 100`  |
| `maxGridCount`       | number                                              | 每层最多档位数，默认 10 |
| `dynamicGridEnabled` | boolean                                             | 是否启用动态步长        |
| `dynamicGridMode`    | <code>'stable' &#124; 'aggressive'</code>           | 稳健或抄底              |
| `dynamicScale`       | number                                              | 稳健 0.3，抄底 0.6      |

三层默认语义：

| 层   | 目标         | 默认初始步长                                | 典型用途   |
| ---- | ------------ | ------------------------------------------- | ---------- |
| 小网 | 捕捉日常波动 | 后续由 ATR 推荐，当前可保留 5% 作为兼容默认 | 高频滚动   |
| 中网 | 捕捉中等回撤 | 当前默认 15%                                | 中周期加仓 |
| 大网 | 捕捉深度回撤 | 当前默认 30%                                | 深跌防守   |

注意：Phase 1 后小网步长应支持小数，不能继续被 UI 限死为整数 `>= 1%`，否则无法表达 0.5% 等密集小网。

### 3.3 资金变量

| 变量               | 类型   | 含义                                    |
| ------------------ | ------ | --------------------------------------- |
| `totalBudget`      | number | 总弹药，用户愿意投入网格的最大现金      |
| `amountPerGrid`    | number | 单格基础金额，目标由 `totalBudget` 反推 |
| `amountMultiplier` | number | 越跌越买的加码系数                      |
| `positionRatio`    | number | `buyPrice / basePrice`                  |
| `amountWeight`     | number | 单档资金权重                            |
| `plannedBuyAmount` | number | 取整前计划买入金额                      |
| `actualBuyAmount`  | number | 按整手取整后的真实买入金额              |
| `buyShares`        | number | 买入份额                                |

资金权重公式：

```text
positionRatio = buyPrice / basePrice
amountWeight = 1 + amountMultiplier * (1 - positionRatio)
plannedBuyAmount = amountPerGrid * amountWeight
buyShares = floor(plannedBuyAmount / buyExecutionPrice / minTradeUnit) * minTradeUnit
actualBuyAmount = buyShares * buyExecutionPrice
```

其中 `buyExecutionPrice` 用于保守压力测试，见交易成本章节。

### 3.4 留利与底仓变量

| 变量                      | 类型   | 含义                   |
| ------------------------- | ------ | ---------------------- |
| `profitReserveMultiplier` | number | 留利系数               |
| `sellShares`              | number | 反弹时卖出的份额       |
| `reservedShares`          | number | 留下作为长期底仓的份额 |
| `basePositionShares`      | number | 所有网格累积底仓份额   |
| `basePositionCost`        | number | 底仓分摊成本           |
| `basePositionMarketValue` | number | 底仓按评估价计的市值   |

卖出份额公式：

```text
rawSellShares = buyShares * max(0, 1 - effectiveStepRatio * profitReserveMultiplier)
sellShares = floor(rawSellShares / minTradeUnit) * minTradeUnit
reservedShares = buyShares - sellShares
```

解释：

- `profitReserveMultiplier = 0`：不留利，尽量卖出全部买入份额。
- `profitReserveMultiplier = 1`：理论上只卖回本金附近，保留利润对应份额。
- `profitReserveMultiplier > 1`：更激进地积累底仓。
- 当公式结果为负时必须钳制到 0，禁止负卖出份额。

底仓必须从滚动利润中拆开展示，不能继续只并入 `profit`。

### 3.5 交易成本变量

默认 ETF 成本参数：

| 变量                 | 默认值   | 说明                            |
| -------------------- | -------- | ------------------------------- |
| `buyCommissionRate`  | `0.0001` | 买入佣金，万 1                  |
| `sellCommissionRate` | `0.0001` | 卖出佣金，万 1                  |
| `minCommission`      | `0`      | 免 5 元最低佣金                 |
| `stampDutyRate`      | `0`      | ETF 免印花税                    |
| `transferFeeRate`    | `0`      | ETF 免过户费                    |
| `slippageTicks`      | `5`      | 默认双边各 5 个 tick 的保守滑点 |

买卖执行价：

```text
buyExecutionPrice = roundToTick(buyPrice + slippageTicks * priceUnit)
sellExecutionPrice = roundToTick(max(0, sellPrice - slippageTicks * priceUnit))
```

佣金：

```text
buyCommission = max(minCommission, buyExecutionPrice * buyShares * buyCommissionRate)
sellCommission = max(minCommission, sellExecutionPrice * sellShares * sellCommissionRate)
```

由于默认 `minCommission = 0`，小额网格不会被 5 元最低佣金扭曲。

成本覆盖步长：

```text
roundTripCostRate
= buyCommissionRate
+ sellCommissionRate
+ stampDutyRate
+ transferFeeRate
+ (2 * slippageTicks * priceUnit / basePrice)

costCoverageStepPct = roundTripCostRate * 100
```

实现要求：

- 当 `smallGridStep < costCoverageStepPct * 2` 时，UI 必须给出黄色风险提示。
- 当 `smallGridStep <= costCoverageStepPct` 时，UI 必须给出红色风险提示，表示理论上可能被成本吞噬。
- 压力测试利润必须使用扣费后的净值。

## 4. 策略规则精确定义

### 4.1 输入模型

Phase 1 目标输入分为三类。

#### A. 必填基础输入

| 字段                      | 类型   | 规则                                |
| ------------------------- | ------ | ----------------------------------- |
| `basePrice`               | number | `> 0`                               |
| `minPrice`                | number | `> 0` 且 `< basePrice`              |
| `totalBudget`             | number | `> 0`，推荐替代手输 `amountPerGrid` |
| `minTradeUnit`            | number | `>= 1`，ETF 默认 100                |
| `priceUnit`               | number | `> 0`，ETF 默认 0.001               |
| `smallGridStep`           | number | `> 0`，允许小数                     |
| `mediumGridStep`          | number | `> smallGridStep`                   |
| `largeGridStep`           | number | `> mediumGridStep` 且 `< 100`       |
| `amountMultiplier`        | number | `>= 0`                              |
| `profitReserveMultiplier` | number | `>= 0`                              |

#### B. 成本输入

| 字段                 | 类型   | 默认     |
| -------------------- | ------ | -------- |
| `buyCommissionRate`  | number | `0.0001` |
| `sellCommissionRate` | number | `0.0001` |
| `minCommission`      | number | `0`      |
| `stampDutyRate`      | number | `0`      |
| `transferFeeRate`    | number | `0`      |
| `slippageTicks`      | number | `5`      |

#### C. 指标输入，Phase 2 之后自动带入

| 字段                      | 类型                                              | 用途             |
| ------------------------- | ------------------------------------------------- | ---------------- |
| `atr20Pct`                | number                                            | 推荐小网步长     |
| `annualizedVolatility250` | number                                            | 标的筛选         |
| `valuationPercentile`     | number                                            | 估值门控         |
| `ma200State`              | <code>'above' &#124; 'near' &#124; 'below'</code> | 趋势节流         |
| `premiumDiscountPct`      | number                                            | ETF 溢价风险     |
| `avgTurnoverAmount20`     | number                                            | 流动性门槛       |
| `fundScale`               | number                                            | 清盘风险门槛     |
| `isT0`                    | boolean                                           | 小步长网格适配度 |

### 4.2 参数校验规则

硬错误，禁止生成策略：

| 编号 | 条件                              | 错误信息建议                 |
| ---- | --------------------------------- | ---------------------------- |
| E01  | `basePrice <= 0`                  | 基准价必须大于 0             |
| E02  | `minPrice <= 0`                   | 最低价必须大于 0             |
| E03  | `minPrice >= basePrice`           | 最低价必须小于基准价         |
| E04  | `totalBudget <= 0`                | 总弹药必须大于 0             |
| E05  | 任一步长 `<= 0`                   | 步长必须大于 0               |
| E06  | `smallGridStep >= mediumGridStep` | 小网步长必须小于中网步长     |
| E07  | `mediumGridStep >= largeGridStep` | 中网步长必须小于大网步长     |
| E08  | `largeGridStep >= 100`            | 大网步长必须小于 100%        |
| E09  | `amountMultiplier < 0`            | 金额加码系数不能小于 0       |
| E10  | `profitReserveMultiplier < 0`     | 留利系数不能小于 0           |
| E11  | `priceUnit <= 0`                  | 价格精度必须大于 0           |
| E12  | `minTradeUnit < 1`                | 最小交易单位必须大于等于 1   |
| E13  | 反推后所有档位 `buyShares = 0`    | 总弹药不足以生成任何有效档位 |

风险警告，允许生成但必须提示：

| 编号 | 条件                                   | 提示                                    |
| ---- | -------------------------------------- | --------------------------------------- |
| W01  | `smallGridStep <= costCoverageStepPct` | 小网步长小于成本覆盖线，净收益可能为负  |
| W02  | `smallGridStep < atr20Pct * 0.3`       | 步长过密，可能高频磨损                  |
| W03  | `smallGridStep > atr20Pct * 2`         | 步长过宽，可能长期不成交                |
| W04  | `abs(premiumDiscountPct) > 0.5`        | ETF 溢价/折价偏高，限价成交可能偏离净值 |
| W05  | `avgTurnoverAmount20 < 100000000`      | 日均成交额不足 1 亿，流动性偏弱         |
| W06  | `fundScale < 500000000`                | 基金规模不足 5 亿，存在清盘风险         |
| W07  | `valuationPercentile > 60`             | 估值不低，建议只卖不买或等待            |
| W08  | `dataTimestamp` 不是最近交易日         | 数据过期，结果仅供参考                  |

### 4.3 价格精度与取整规则

所有价格必须通过统一函数取整，禁止各模块自行 `toFixed` 后再解析。

推荐规则：

```text
roundToTick(price, tickSize, mode)

mode = 'nearest'：展示价，四舍五入到 tick
mode = 'down'：买入限价保守取整
mode = 'up'：卖出限价保守取整
```

ETF 保守执行建议：

| 场景               | 取整                 |
| ------------------ | -------------------- |
| 买入目标价         | `down`               |
| 买入执行价压力测试 | `up`，因为考虑滑点   |
| 卖出目标价         | `up`                 |
| 卖出执行价压力测试 | `down`，因为考虑滑点 |
| 展示价             | `nearest`            |

### 4.4 单层网格生成规则

每一层网格生成一个 `GridLeg[]`，再做跨层聚合。

#### 4.4.1 起始价

| 层   | 起始买入价                          | 第一档上沿卖出价                                            |
| ---- | ----------------------------------- | ----------------------------------------------------------- |
| 小网 | `basePrice`                         | `basePrice * (1 + smallStepRatio)`                          |
| 中网 | `basePrice * (1 - mediumStepRatio)` | `basePrice * (1 - mediumStepRatio) * (1 + mediumStepRatio)` |
| 大网 | `basePrice * (1 - largeStepRatio)`  | `basePrice * (1 - largeStepRatio) * (1 + largeStepRatio)`   |

说明：

- 中网和大网的第一档是从基准价回撤后买入，但卖出价不默认回到 `basePrice`，而是按该层自身步长从买入价向上反弹一档。
- 该规则与原方案“中网买的等中网步长、大网买的等大网步长”一致，避免人为抬高中/大网首档收益。
- 当前代码中首档已接近该语义；后续 Phase 1 应统一所有档位的卖出价公式，避免首档和后续档位口径不一致。

#### 4.4.2 价格线递推

设某层第 `i` 档买入价为 `buyPrice[i]`，卖出价为 `sellPrice[i]`。

```text
buyPrice[0] =
  small: basePrice
  medium: basePrice * (1 - mediumStep[0])
  large: basePrice * (1 - largeStep[0])

buyPrice[i] = buyPrice[i - 1] * (1 - step[i])     // i > 0
sellPrice[i] = buyPrice[i] * (1 + step[i])
```

每一档的有效步长：

```text
effectiveStepRatio[i] = (sellPrice[i] - buyPrice[i]) / sellPrice[i]
```

`effectiveStepRatio` 以卖出价为分母，目的是让“留利系数 = 1”时理论上只卖出回本份额。不要简单使用输入步长参与利润和留利计算，因为价格取整、兜底价、动态步长和交易成本都会改变真实价差。

#### 4.4.3 动态步长

静态模式：

```text
step[i] = initialStep
```

动态模式：

```text
dynamicScale = stable ? 0.3 : 0.6
step[0] = initialStep
step[i] = step[i - 1] * (1 + dynamicScale)   // i > 0
```

约束：

- `step[i] < 1`，否则下一档价格会小于等于 0。
- 当下一档理论买入价触及 `minPrice` 边界时，进入最后一网决策逻辑。

### 4.5 最低价兜底网

#### 4.5.1 核心规则

向下生成时，当下一档理论买入价 `nextBuyPrice <= minPrice` 或需要收尾该层时，确定最后一网价格：

```text
lastGridPrice = round_up_to_tick(minPrice)
```

含义：

- 计算价已触及或穿过 `minPrice`：最后一网夹到 `minPrice`（硬地板），不允许更深。
- 层达档位上限且上一档仍高于 `minPrice`：同样补一档到 `minPrice` 收尾。

流程：

1. 不直接 `break`；先按上式确定 `lastGridPrice`。
2. 若当前层末档已等于 `lastGridPrice`，将该普通档替换为兜底档；否则追加兜底档。
3. 三层价格梯全部生成后，使用 4.7 节完全相同的全局排序与固定锚点规则聚类。
4. 只删除真实聚合组内与同层兜底档共组的普通档；删除后重新聚类，直到结果稳定。
5. 对保留的档位按层重排 `indexInLayer`，再进入资金分配。
6. 计划内不存在 `buyPrice < minPrice` 的档位；市价跌破 `minPrice` 后不再自动加码。

触发最后一网决策的时机：

- 下一档理论买入价 `calculatedLastPrice <= minPrice`（自然步长进入边界）。
- 或该层已达 `maxGridCount` 等上限，且上一档仍高于 `minPrice`（最后一网取 `minPrice`）。

伪代码：

```ts
for each layer:
  while rows.length < maxGridCount:
    calculatedLastPrice = calculateNextBuyPrice()

    if calculatedLastPrice > minPrice:
      appendNormalGrid(calculatedLastPrice)
      continue

    const lastGridPrice = roundUpToTick(minPrice)

    if currentLastBuyPrice == lastGridPrice:
      replaceLastNormalGridWithBottomGrid()
    else if !hasPrice(lastGridPrice):
      appendBottomGrid(lastGridPrice)

    break

  // maxGridCount 用尽且仍未触达 minPrice 时，补最后一网
  if lastBuyPrice > minPrice:
    lastGridPrice = roundUpToTick(minPrice)
    if currentLastBuyPrice == lastGridPrice:
      replaceLastNormalGridWithBottomGrid()
    else if !hasPrice(lastGridPrice):
      appendBottomGrid(lastGridPrice)

allRows = flatten(layerRows)

repeat:
  clusters = clusterByBuyPrice(allRows)
  duplicates = normal rows sharing a cluster and gridType with a bottom row
  if duplicates is empty:
    break
  remove duplicates from allRows

reindex each layer in allRows
```

#### 4.5.2 兜底网资金

最后一网（含兜底网）使用自然最大加码权重，按实际最后一网价格计：

```text
positionRatio = lastGridPrice / basePrice
amountWeight = 1 + amountMultiplier * (1 - positionRatio)
```

如果跨层同时在最后一网价位附近生成档位，必须参与价位聚合，压力测试按聚合后总资金展示。

#### 4.5.3 兜底网状态提示

当最新价：

| 条件                       | 状态                       |
| -------------------------- | -------------------------- |
| `currentPrice > minPrice`  | 网格区间内                 |
| `currentPrice <= minPrice` | 跌破策略边界，停止自动加码 |

跌破提示文案建议：

```text
当前价格已跌破最低价边界。本策略不再自动加码，等待价格回到网格区间或人工重新评估 basePrice/minPrice/总弹药。
```

### 4.6 总弹药反推单格金额

#### 4.6.1 目标

给定 `totalBudget`，反推出最大的 `amountPerGrid`，使所有有效买入档位按成本压力测试后满足：

```text
sum(actualBuyAmount + buyCommission) <= totalBudget
```

#### 4.6.2 为什么不能直接公式反推

因为以下因素会导致非线性和阶梯变化：

- 每档买入份额必须按 `minTradeUnit` 向下取整。
- 买入执行价包含滑点。
- 跨层聚合不改变内部买入份额，但会改变压力展示。
- 兜底网可能改变最低一档价格。

因此推荐用二分搜索反推，而不是一次性除以权重和。

#### 4.6.3 二分搜索规则

输入：

```text
totalBudget
gridStructureParams
costParams
minTradeUnit
priceUnit
```

输出：

```text
amountPerGrid
generatedLegs
stressTest
```

搜索边界：

```text
low = 0
high = totalBudget
precision = max(1, priceUnit * minTradeUnit)
```

判定函数：

```text
canAfford(amountPerGrid):
  generate all legs
  totalCost = sum(actualBuyAmount + buyCommission)
  return totalCost <= totalBudget
```

停止条件：

```text
high - low <= precision
```

结果：

```text
amountPerGrid = floor(low)
```

实现要求：

- 反推结果必须可复算。
- UI 允许显示“单格基础金额由总弹药反推得出”。
- 如用户仍选择手动 `amountPerGrid` 模式，必须展示“预计总投入”并在超出预算时警告。

### 4.7 跨层价位聚合

#### 4.7.1 目标

保留小/中/大三层逻辑，同时解决同价位或近似价位多层同时触发时，资金压力展示不真实的问题。

#### 4.7.2 数据模型分离

必须分为两层数据：

| 数据                | 用途                                     | 是否改变策略语义           |
| ------------------- | ---------------------------------------- | -------------------------- |
| `GridLeg`           | 内部记账和买卖配对，每条只属于一个网格层 | 不改变                     |
| `AggregatedGridRow` | UI 展示、压力测试分组、资金峰值分析      | 只聚合展示，不改变内部配对 |

禁止为了聚合而删除某一层的 `GridLeg`。

#### 4.7.3 聚合阈值

最终阈值必须同时考虑百分比阈值和 tick 下限：

```text
tickThresholdPct = priceUnit / clusterAnchorPrice * 100
aggregationThresholdPct = max(smallGridStep / 2, tickThresholdPct)
```

两条腿可以进入同一聚合组的条件：

```text
abs(a.buyPrice - clusterAnchorPrice) / clusterAnchorPrice * 100
<= aggregationThresholdPct
```

其中 `clusterAnchorPrice` 使用当前聚合组第一条腿的买入价，保证排序稳定。

也就是说，如果半个小网步长折算后的绝对价差小于一个 tick，则按一个 tick 对应的百分比聚合。

#### 4.7.4 聚合算法

1. 将所有 `GridLeg` 按 `buyPrice` 从高到低排序。
2. 取第一条腿创建聚合组。
3. 依次扫描后续腿：
   - 如果满足聚合阈值，加入当前组。
   - 否则关闭当前组，创建新组。
4. 每个聚合组输出一条 `AggregatedGridRow`。

聚合行字段：

| 字段              | 规则                                        |
| ----------------- | ------------------------------------------- |
| `gridTypes`       | 子腿层级去重后排序，如 `['小网', '中网']`   |
| `displayType`     | 单层显示原层级，多层显示 `组合：小网+中网`  |
| `buyPriceHigh`    | 组内最高买入价                              |
| `buyPriceLow`     | 组内最低买入价                              |
| `displayBuyPrice` | 组内买入金额加权平均价，按 tick 展示        |
| `triggerBuyPrice` | 组内最高买入触发价，用于提示最早触发点      |
| `totalBuyAmount`  | 组内 `actualBuyAmount + buyCommission` 汇总 |
| `totalBuyShares`  | 组内买入份额汇总                            |
| `childLegIds`     | 组内腿 ID，用于展开明细                     |
| `sellPlans`       | 每条子腿自己的卖出价和卖出份额              |

#### 4.7.5 压力测试口径

压力测试需要同时给出：

| 指标                    | 口径                                |
| ----------------------- | ----------------------------------- |
| `totalBudgetRequired`   | 所有腿买入成本之和                  |
| `maxClusterCashDemand`  | 单个聚合组一次触发的最大资金需求    |
| `cumulativeCashByPrice` | 价格逐档下跌时累计消耗资金          |
| `budgetUsageRate`       | `totalBudgetRequired / totalBudget` |

### 4.8 买入、卖出与底仓记账

#### 4.8.1 单腿买入记账

每条 `GridLeg` 必须保留以下字段：

```ts
interface GridLeg {
  id: string;
  gridType: "small" | "medium" | "large";
  gridLabel: "小网" | "中网" | "大网";
  indexInLayer: number;
  buyPrice: number;
  buyExecutionPrice: number;
  sellPrice: number;
  sellExecutionPrice: number;
  effectiveStepRatio: number;
  positionRatio: number;
  amountWeight: number;
  plannedBuyAmount: number;
  buyShares: number;
  actualBuyAmount: number;
  buyCommission: number;
  sellShares: number;
  reservedShares: number;
  sellAmount: number;
  sellCommission: number;
  gridNetProfit: number;
  reserveCost: number;
}
```

#### 4.8.2 净利润口径

单腿网格滚动净利润：

```text
gridNetProfit
= sellExecutionPrice * sellShares
- sellCommission
- buyExecutionPrice * sellShares
- allocatedBuyCommissionForSoldShares
```

底仓成本：

```text
reserveCost
= buyExecutionPrice * reservedShares
+ allocatedBuyCommissionForReservedShares
```

佣金分摊：

```text
allocatedBuyCommissionForSoldShares
= buyCommission * sellShares / buyShares

allocatedBuyCommissionForReservedShares
= buyCommission * reservedShares / buyShares
```

总压力测试：

```text
realizedGridProfit = sum(gridNetProfit)
basePositionShares = sum(reservedShares)
basePositionCost = sum(reserveCost)
basePositionMarketValue = basePositionShares * valuationPrice
basePositionUnrealizedPnL = basePositionMarketValue - basePositionCost
totalNetProfit = realizedGridProfit + basePositionUnrealizedPnL
```

`valuationPrice` 默认使用 `basePrice`，Phase 2 有行情后可使用 `currentPrice` 并标注时间戳。

#### 4.8.3 展示要求

统计卡片至少拆为两组：

| 分组     | 字段                                               |
| -------- | -------------------------------------------------- |
| 资金压力 | 总弹药、预计最大投入、预算使用率、最大单档聚合资金 |
| 滚动收益 | 推演网格利润、扣费后收益率、成本覆盖步长           |
| 底仓     | 底仓份额、底仓成本、底仓市值、底仓浮盈             |

### 4.9 开网、暂停、收网与停止规则

网格状态必须是规则化状态机。

| 状态         | 触发条件                             | 行为                         |
| ------------ | ------------------------------------ | ---------------------------- |
| `blocked`    | 硬错误、数据不可用、ETF 不满足硬门槛 | 禁止生成正式策略，可展示原因 |
| `wait`       | 估值过高或趋势过热                   | 不建议开新买单               |
| `normal`     | 估值中位、价格在 MA200 附近          | 正常网格                     |
| `accumulate` | 价格低于 MA200 且估值低              | 加大买入力度，步长可适度加密 |
| `sellOnly`   | 价格高于 MA200 且估值偏高            | 只执行卖出和收网，不新增买入 |
| `stopped`    | `currentPrice <= minPrice`           | 跌破策略边界，停止加码       |

三态节流阀：

| 条件                                                      | 状态         | 参数调整                                     |
| --------------------------------------------------------- | ------------ | -------------------------------------------- |
| `currentPrice > MA200` 且 `valuationPercentile > 60`      | `sellOnly`   | 只卖不买，提示收网                           |
| `abs(currentPrice / MA200 - 1) <= 0.03` 或估值在 30 到 60 | `normal`     | 使用默认参数                                 |
| `currentPrice < MA200` 且 `valuationPercentile < 30`      | `accumulate` | 买入金额乘以 1.5，小网步长可降到推荐区间下沿 |

状态匹配必须按以下优先级短路执行：

1. 参数硬错误、数据硬错误、ETF 命中硬剔除线时，返回 `blocked`。
2. `currentPrice <= minPrice` 时，返回 `stopped`。
3. 趋势或估值数据缺失时，不输出趋势节流结论；纯手动计算可继续，状态按 `normal` 展示并附带数据缺失 warning。
4. 命中 `sellOnly` 条件时，返回 `sellOnly`。
5. 命中 `accumulate` 条件时，返回 `accumulate`。
6. 估值偏高或趋势过热但未命中 `sellOnly` 时，返回 `wait`。
7. 其他情况返回 `normal`。

注意：

- 趋势节流阀只改变资金火力和开网状态。
- 不允许根据主观趋势判断直接改写 `minPrice`。
- `sellOnly` 不是清仓命令，只是不新增买入网格。

### 4.10 退出机制

完整策略必须定义何时退出或人工重评。

| 退出类型         | 触发条件                                              | 行为                                             |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------ |
| 估值退出         | `valuationPercentile >= 80`                           | 停止新增买入，逐步卖出滚动仓，保留或人工处理底仓 |
| 趋势过热退出     | `currentPrice > MA200 * 1.15` 且估值 > 70             | 提示收网，避免高位重新开买单                     |
| 波动衰竭退出     | `atr20Pct < costCoverageStepPct * 3` 持续 20 个交易日 | 提示步长收益不足，建议暂停密集小网               |
| 逻辑破坏退出     | 跟踪指数、基金规模、溢价、流动性出现硬门槛违规        | 标记为不适合继续网格                             |
| 加码停止边界退出 | `currentPrice <= minPrice`                            | 停止加码并要求人工重评                           |

## 5. 指标体系

### 5.1 指标总览

ETF 网格适配度由六类指标组成。

| 类别   | 目的                   | 代表指标                              |
| ------ | ---------------------- | ------------------------------------- |
| 相关性 | 控制组合分散度         | 90 日 / 250 日收益率 Pearson 相关系数 |
| 波动性 | 判断是否有网格利润空间 | 年化波动率、20 日 ATR%、日均振幅      |
| 流动性 | 降低成交和清盘风险     | 日均成交额、基金规模、买卖价差        |
| 估值   | 控制开网位置           | PE/PB 五年历史百分位                  |
| 震荡性 | 剔除单边趋势标的       | ADX、区间宽度 / 路径长度              |
| 资金流 | 观察国家队代理信号     | 宽基 ETF 份额异动、季报持仓           |

### 5.2 相关性

#### 5.2.1 输入

每只 ETF 的后复权或不复权日收盘价序列。ETF 网格通常更关心交易价格本身，默认使用不复权收盘价；如数据源提供复权因子，指标计算可使用前复权并在数据元信息中标注。

#### 5.2.2 日收益率

```text
return[t] = close[t] / close[t - 1] - 1
```

#### 5.2.3 Pearson 相关系数

对任意两只 ETF `A`、`B`：

```text
corr(A, B, window)
= covariance(returnsA, returnsB)
/ (std(returnsA) * std(returnsB))
```

窗口：

| 窗口   | 含义                         |
| ------ | ---------------------------- |
| 90 日  | 短中期相关性，反映近期风格   |
| 250 日 | 约一年相关性，反映长期分散度 |

组合建议：

| 条件               | 解释                                     |
| ------------------ | ---------------------------------------- |
| 两两相关 `< 0.5`   | 较理想                                   |
| 相关在 `0.5 - 0.8` | 中性，需控制仓位                         |
| 相关 `>= 0.8`      | 高度同向，不应都作为同一网格组合的核心仓 |

### 5.3 波动性

#### 5.3.1 年化波动率

```text
dailyVolatility = std(dailyReturns over N days)
annualizedVolatility = dailyVolatility * sqrt(252)
```

默认窗口：

- `N = 90`：近期波动。
- `N = 250`：长期波动。

#### 5.3.2 ATR 和 ATR%

真实波幅：

```text
TR[t] = max(
  high[t] - low[t],
  abs(high[t] - close[t - 1]),
  abs(low[t] - close[t - 1])
)
```

20 日 ATR：

```text
ATR20 = average(TR over last 20 trading days)
ATR20Pct = ATR20 / close[t] * 100
```

小网步长推荐：

```text
recommendedSmallStepPct =
  clamp(
    max(costCoverageStepPct * 2, ATR20Pct * t0Factor),
    lowerBound,
    upperBound
  )
```

建议参数：

| ETF 类型 | `t0Factor` | `lowerBound`              | `upperBound`     |
| -------- | ---------- | ------------------------- | ---------------- |
| T+0 ETF  | `0.5`      | `costCoverageStepPct * 2` | `ATR20Pct * 1.2` |
| T+1 ETF  | `0.8`      | `costCoverageStepPct * 2` | `ATR20Pct * 1.5` |

解释：

- T+0 可日内回转，适合更密集小网。
- T+1 不能当日卖出，步长需要更宽以覆盖隔夜风险。

#### 5.3.3 日均振幅

```text
dailyRangePct[t] = (high[t] - low[t]) / close[t - 1] * 100
avgDailyRangePct20 = average(dailyRangePct over last 20 days)
```

用途：

- 与 ATR% 交叉验证。
- 如果 `avgDailyRangePct20 < costCoverageStepPct * 3`，密集网格意义下降。

### 5.4 流动性

#### 5.4.1 日均成交额

```text
avgTurnoverAmount20 = average(amount over last 20 trading days)
avgTurnoverAmount60 = average(amount over last 60 trading days)
```

推荐门槛：

```text
avgTurnoverAmount20 >= 100,000,000
```

低于 1 亿的 ETF 不建议作为默认网格标的，除非用户手动确认。  
硬剔除线为 `avgTurnoverAmount20 < 50,000,000`；介于 5000 万和 1 亿之间时允许展示，但必须降分并提示流动性风险。

#### 5.4.2 基金规模

```text
fundScale >= 500,000,000
```

5 亿是推荐门槛。硬剔除线为 `fundScale < 300,000,000`；介于 3 亿和 5 亿之间时允许展示，但必须降分并提示清盘或流动性弱化风险。

#### 5.4.3 IOPV 溢价率

```text
premiumDiscountPct = (marketPrice - iopv) / iopv * 100
```

规则：

| 条件                            | 处理           |
| ------------------------------- | -------------- |
| `abs(premiumDiscountPct) < 0.5` | 正常           |
| `0.5 <= abs(...) < 1`           | 风险提示       |
| `abs(...) >= 1`                 | 不建议开新网格 |

#### 5.4.4 买卖价差

```text
bidAskSpreadPct = (bestAsk - bestBid) / midPrice * 100
midPrice = (bestAsk + bestBid) / 2
```

建议：

- 普通 T+1 ETF：`bidAskSpreadPct <= 0.1%`。
- 跨境或商品 ETF 可放宽到 `0.2%`，但要提示。

### 5.5 震荡性

网格适合震荡，不适合单边趋势。需要剔除“看似波动大但一路单边”的标的。

#### 5.5.1 ADX

默认使用 14 日 ADX。

| ADX       | 含义                 | 网格处理   |
| --------- | -------------------- | ---------- |
| `< 20`    | 趋势弱，震荡概率更高 | 适合       |
| `20 - 25` | 中性                 | 可用       |
| `> 25`    | 趋势较强             | 降低适配度 |

#### 5.5.2 路径效率比

```text
rangeWidth = max(close over N) - min(close over N)
pathLength = sum(abs(close[t] - close[t - 1]) over N)
pathEfficiency = rangeWidth / pathLength
```

解释：

- 越接近 1，越像单边趋势。
- 越低，来回震荡越多。

建议：

| 条件                     | 处理                 |
| ------------------------ | -------------------- |
| `pathEfficiency <= 0.35` | 震荡性好             |
| `0.35 - 0.55`            | 中性                 |
| `> 0.55`                 | 趋势性强，降低适配度 |

### 5.6 估值门控

#### 5.6.1 估值字段

ETF 估值来自其跟踪指数，而不是 ETF 自身价格。

| 标的类型             | 主估值指标                     | 辅助指标                 |
| -------------------- | ------------------------------ | ------------------------ |
| 宽基指数 ETF         | PE                             | PB                       |
| 金融、地产、周期 ETF | PB                             | PE                       |
| 红利 ETF             | 股息率、PE                     | PB                       |
| 债券、黄金、货币 ETF | 不适用 PE/PB                   | 使用利率、金价或溢价指标 |
| 跨境 ETF             | 跟踪指数估值，需注意时区和汇率 | 溢价率                   |

#### 5.6.2 历史百分位

默认五年历史窗口。为避免 PE/PB 与股息率方向相反，统一输出 `valuationPercentile`，其含义是“便宜程度百分位”：数值越低代表越便宜，数值越高代表越贵。

```text
// PE/PB：数值越低越便宜
valuationPercentile
= count(historicalValue <= currentValue) / count(historicalValue) * 100

// 股息率：数值越高越便宜，因此反向计算
valuationPercentile
= count(historicalDividendYield >= currentDividendYield)
  / count(historicalDividendYield) * 100
```

规则：

| 百分位    | 状态 | 行为                                    |
| --------- | ---- | --------------------------------------- |
| `< 30`    | 低估 | 允许开网，若趋势也低可进入 `accumulate` |
| `30 - 60` | 中性 | 正常网格                                |
| `60 - 80` | 偏高 | 不建议新增买入，可只卖不买              |
| `>= 80`   | 高估 | 提示收网或暂停                          |

### 5.7 趋势指标

#### 5.7.1 MA200

```text
MA200 = average(close over last 200 trading days)
priceToMA200 = currentPrice / MA200 - 1
```

状态：

| 条件                            | `ma200State` |
| ------------------------------- | ------------ |
| `priceToMA200 > 0.03`           | `above`      |
| `-0.03 <= priceToMA200 <= 0.03` | `near`       |
| `priceToMA200 < -0.03`          | `below`      |

MA200 不直接决定买卖，只和估值百分位组合成节流阀。

### 5.8 汇金资金流代理指标

#### 5.8.1 数据现实

汇金或国家队直接持仓主要来自基金定期报告，存在 1 到 4 个月滞后。  
日频观察只能使用代理信号，不能当成确认事实。

#### 5.8.2 代理思路

跟踪 6 到 8 只宽基 ETF 的份额变化和溢价率：

- 沪深 300 ETF。
- 上证 50 ETF。
- 中证 500 ETF。
- 中证 1000 ETF。
- 创业板 ETF。
- 其他市场主流宽基 ETF。

候选 ETF 池必须可配置，不能硬编码在指标函数中。

#### 5.8.3 份额异动

```text
shareChange[t] = totalShares[t] - totalShares[t - 1]
shareChangePct[t] = shareChange[t] / totalShares[t - 1] * 100
zScore[t] = (shareChange[t] - mean(shareChange over 120 days)) / std(shareChange over 120 days)
```

异常规则：

| 条件                         | 信号               |
| ---------------------------- | ------------------ |
| `zScore >= 3` 且指数当日下跌 | 高强度申购代理信号 |
| `zScore >= 2`                | 中等申购代理信号   |
| 连续 3 日份额增长且大盘下跌  | 持续托底代理信号   |

输出必须写成“代理信号”，禁止写成“汇金已买入”。

### 5.9 综合网格适配度评分

评分只用于排序，不替代硬门槛。

总分 100：

| 类别     | 权重 | 评分规则摘要                               |
| -------- | ---- | ------------------------------------------ |
| 波动空间 | 25   | ATR%、年化波动、日均振幅越接近推荐区间越高 |
| 震荡性   | 20   | ADX 越低、路径效率越低越高                 |
| 流动性   | 20   | 成交额、规模、价差、溢价越好越高           |
| 估值位置 | 20   | 百分位越低越高，过高直接降分               |
| 分散价值 | 10   | 与已选组合相关性越低越高                   |
| 数据质量 | 5    | 数据新鲜、字段完整、源稳定越高             |

硬剔除条件：

```text
avgTurnoverAmount20 < 50,000,000
fundScale < 300,000,000
abs(premiumDiscountPct) >= 1
dataQualityScore < 60
```

建议入选条件：

```text
gridFitScore >= 70
avgTurnoverAmount20 >= 100,000,000
fundScale >= 500,000,000
valuationPercentile <= 60
```

## 6. 数据源映射

### 6.1 数据层原则

Phase 2 数据层必须遵守：

1. 免费源优先，但不假设免费源稳定。
2. 所有外部请求通过 Next.js API Routes 代理，前端不直接请求第三方源。
3. API Route 返回必须包含 `source`、`timestamp`、`stale`、`fallbackUsed`。
4. 日频数据默认缓存 24 小时，盘中数据使用短缓存和 stale-while-revalidate。
5. 主源失败自动降级备源，不能让单一免费源拖垮页面。
6. 指标计算放在 `src/lib/indicators/`，保持纯函数，便于单测。

### 6.2 字段映射总表

| 数据对象     | 字段                                             | 主源候选                          | 备源候选                       | 刷新频率       | 缓存建议                 | 质量校验                           |
| ------------ | ------------------------------------------------ | --------------------------------- | ------------------------------ | -------------- | ------------------------ | ---------------------------------- |
| ETF 元数据   | 代码、名称、交易所、基金公司、跟踪指数、上市日期 | 上交所/深交所产品页、基金公司公告 | 东方财富基金、天天基金         | 周频或手动刷新 | 7 天                     | 代码和交易所匹配，字段缺失则降级   |
| 交易规则     | T+0、最小交易单位、价格精度                      | 交易所规则、产品资料              | 券商公开资料、基金公告         | 低频           | 30 天                    | T+0 类型必须人工抽样校验           |
| ETF 日 K     | open/high/low/close/volume/amount                | 东方财富行情、交易所行情文件      | 新浪、腾讯                     | 每交易日       | 24 小时                  | 交易日连续性、价格非负、成交额非负 |
| ETF 实时报价 | 最新价、买一、卖一、成交额                       | 东方财富/新浪/腾讯实时行情        | 交易所延迟行情                 | 盘中           | 5 到 15 秒               | bid <= ask，最新价在合理区间       |
| ETF 份额     | 总份额、份额变化                                 | 基金公司每日公告、交易所基金信息  | 东方财富基金档案               | 日频           | 24 小时                  | 份额不可为负，异常变化打标         |
| ETF 规模     | 基金资产净值、规模                               | 基金定期报告、基金公司            | 东方财富、天天基金             | 季度或日频估算 | 1 到 7 天                | 规模低于门槛打标                   |
| IOPV/NAV     | IOPV、单位净值、溢价率                           | 交易所/基金公司                   | 东方财富、行情源               | 盘中或日频     | 盘中短缓存，日频 24 小时 | 溢价率异常打标                     |
| 指数 K 线    | 指数 OHLC                                        | 中证指数官网、交易所指数数据      | 东方财富指数行情               | 每交易日       | 24 小时                  | 与 ETF 跟踪指数匹配                |
| 指数估值     | PE、PB、股息率                                   | 中证指数官网、指数公司公开数据    | 东方财富指数估值、其他免费数据 | 每交易日       | 24 小时                  | 五年历史长度不足则标记低置信       |
| 交易日历     | 开闭市、节假日                                   | 上交所/深交所交易日历             | 第三方财经日历                 | 年度           | 30 天                    | 与 K 线日期交叉校验                |
| 基金报告     | 季报、半年报、年报持仓                           | 基金公司公告、巨潮资讯            | 东方财富公告                   | 季度           | 30 天                    | 报告期和披露日分离                 |

### 6.3 API Route 规划

建议路径：

| Route                          | 输入                            | 输出              | 用途                   |
| ------------------------------ | ------------------------------- | ----------------- | ---------------------- |
| `/api/market/etf-meta`         | `symbols[]`                     | ETF 元数据        | 筛选页和网格页基础信息 |
| `/api/market/etf-kline`        | `symbol, start, end, frequency` | ETF K 线          | ATR、波动、相关性      |
| `/api/market/etf-quote`        | `symbols[]`                     | 实时报价、bid/ask | 当前状态和价差         |
| `/api/market/etf-fund-flow`    | `symbols[], start, end`         | 份额、规模、溢价  | 汇金代理和流动性       |
| `/api/market/index-kline`      | `indexCode, start, end`         | 指数 K 线         | MA200、趋势            |
| `/api/market/index-valuation`  | `indexCode, start, end`         | PE/PB/股息率      | 估值百分位             |
| `/api/market/trading-calendar` | `exchange, year`                | 交易日历          | 数据完整性校验         |

统一响应结构：

```ts
interface MarketApiResponse<T> {
  data: T;
  source: string;
  sourceRank: "primary" | "backup";
  timestamp: string;
  stale: boolean;
  fallbackUsed: boolean;
  warnings: string[];
}
```

错误策略：

| 场景               | 响应                                                       |
| ------------------ | ---------------------------------------------------------- |
| 主源失败，备源成功 | `fallbackUsed = true`，HTTP 200，warnings 包含主源错误摘要 |
| 所有源失败，有缓存 | 返回缓存，`stale = true`                                   |
| 所有源失败，无缓存 | HTTP 503，前端展示数据不可用                               |
| 字段缺失           | HTTP 200，但 `warnings` 标注字段缺失，相关指标不计算       |

### 6.4 指标与数据字段依赖

| 指标            | 必需字段                 | 可选字段 | 缺失处理                         |
| --------------- | ------------------------ | -------- | -------------------------------- |
| 90/250 日相关性 | ETF 日收盘价             | 复权因子 | 少于窗口交易日则不计算           |
| 年化波动率      | ETF 日收盘价             | 复权因子 | 同上                             |
| ATR20%          | high、low、close         | 前收盘   | 少于 21 日不计算                 |
| 日均振幅        | high、low、prevClose     | 无       | 少于 20 日不计算                 |
| ADX14           | high、low、close         | 无       | 少于 30 日不计算                 |
| 路径效率        | close                    | 无       | 少于窗口不计算                   |
| 日均成交额      | amount                   | volume   | 缺失则流动性评分降为未知         |
| 溢价率          | marketPrice、IOPV 或 NAV | bid/ask  | 缺失则给出不可评估               |
| 估值百分位      | PE/PB 历史序列           | 股息率   | 少于 3 年低置信，少于 1 年不计算 |
| MA200           | 指数或 ETF close         | 无       | 少于 220 交易日不计算            |
| 汇金代理        | ETF 总份额、指数涨跌     | 溢价率   | 份额缺失则不输出代理信号         |

### 6.5 数据新鲜度

| 数据类型 | 新鲜标准             | 过期处理                      |
| -------- | -------------------- | ----------------------------- |
| 日 K     | 最近一个已收盘交易日 | 标记 stale，不阻止历史指标    |
| 盘中报价 | 15 秒到 1 分钟       | 超过 5 分钟标记 stale         |
| 指数估值 | 最近一个交易日或 T-1 | 超过 3 个交易日提示           |
| 基金规模 | 最近季度或最近日估算 | 超过 120 天提示               |
| 基金份额 | 最近一个交易日       | 超过 5 个交易日不输出日频代理 |
| 季报持仓 | 最近一期报告         | 明确显示报告期和披露日        |

### 6.6 数据源 spike 验收

Phase 2 前置 spike 必须输出数据源对比表，至少包含：

| 维度       | 说明                                       |
| ---------- | ------------------------------------------ |
| 可用字段   | 是否覆盖 K 线、成交额、份额、估值、IOPV    |
| 历史深度   | 是否满足五年估值百分位和 250 日指标        |
| 延迟       | 平均响应耗时、P95 响应耗时                 |
| 限流       | 连续请求阈值、是否封 IP、是否需 User-Agent |
| 字段稳定性 | 字段名是否变化、是否返回空值               |
| 合规风险   | 是否有明确反爬限制，是否只能做低频缓存     |
| 降级策略   | 对应备源和缓存策略                         |

未完成 spike 前，不允许把某个免费源写死为唯一数据源。

## 7. 模块落地契约

### 7.1 推荐目录

Phase 1 和 Phase 2 可以按以下目录拆分，避免继续把所有逻辑塞进 `grid-calculator.ts`。

```text
src/lib/grid/
  price-ladder.ts          # 价格线、兜底网、动态步长
  capital-allocation.ts    # 总弹药反推、买入金额、整手取整
  trade-cost.ts            # 佣金、滑点、成本覆盖步长
  aggregation.ts           # 跨层价位聚合
  stress-test.ts           # 压力测试、底仓拆分
  grid-strategy.ts         # 对外组合入口

src/lib/indicators/
  returns.ts               # 收益率
  volatility.ts            # 年化波动、ATR
  correlation.ts           # 相关性矩阵
  trend.ts                 # MA、ADX、路径效率
  valuation.ts             # PE/PB 百分位
  liquidity.ts             # 成交额、规模、价差、溢价
  fund-flow.ts             # ETF 份额异动代理
  score.ts                 # 网格适配度评分
```

### 7.2 对外计算入口

建议 Phase 1 最终提供一个主入口：

```ts
interface CalculateGridStrategyV2Input {
  params: GridStrategyParamsV2;
  options: GridStrategyOptionsV2;
  indicatorSnapshot?: EtfIndicatorSnapshot;
}

interface CalculateGridStrategyV2Result {
  amountPerGrid: number;
  legs: GridLeg[];
  aggregatedRows: AggregatedGridRow[];
  stressTest: StressTestV2;
  warnings: StrategyWarning[];
  state: GridStrategyState;
}
```

入口必须保持纯函数：

- 不访问网络。
- 不读取浏览器状态。
- 不依赖当前时间，除非通过参数传入。
- 同样输入必须得到同样输出。

### 7.3 指标快照类型

```ts
interface EtfIndicatorSnapshot {
  symbol: string;
  exchange: "SSE" | "SZSE";
  dataTimestamp: string;
  quote?: {
    currentPrice: number;
    bestBid?: number;
    bestAsk?: number;
    premiumDiscountPct?: number;
  };
  volatility?: {
    atr20Pct: number;
    annualizedVolatility90: number;
    annualizedVolatility250: number;
    avgDailyRangePct20: number;
  };
  liquidity?: {
    avgTurnoverAmount20: number;
    avgTurnoverAmount60: number;
    fundScale?: number;
    bidAskSpreadPct?: number;
  };
  valuation?: {
    metric: "PE" | "PB" | "DIVIDEND_YIELD" | "N/A";
    currentValue?: number;
    percentile?: number;
    historyYears?: number;
  };
  trend?: {
    ma200?: number;
    priceToMA200Pct?: number;
    ma200State?: "above" | "near" | "below";
    adx14?: number;
    pathEfficiency90?: number;
  };
  trading?: {
    isT0: boolean;
    tickSize: number;
    lotSize: number;
  };
  dataQualityScore: number;
  warnings: string[];
}
```

### 7.4 压力测试类型

```ts
interface StressTestV2 {
  totalBudget: number;
  amountPerGrid: number;
  totalBudgetRequired: number;
  budgetUsageRate: number;
  maxClusterCashDemand: number;
  totalBuyShares: number;
  totalSellShares: number;
  realizedGridProfit: number;
  realizedGridProfitRate: number;
  basePositionShares: number;
  basePositionCost: number;
  basePositionMarketValue: number;
  basePositionUnrealizedPnL: number;
  totalNetProfit: number;
  totalNetProfitRate: number;
  totalCommission: number;
  totalSlippageCost: number;
  costCoverageStepPct: number;
}
```

### 7.5 不变量

后续单测必须覆盖以下不变量：

```text
sum(leg.actualBuyAmount + leg.buyCommission) <= totalBudget
leg.buyShares >= 0
leg.sellShares >= 0
leg.reservedShares >= 0
leg.sellShares + leg.reservedShares == leg.buyShares
每层最后一档 buyPrice == lastGridPrice，且 lastGridPrice == round_up_to_tick(minPrice)；所有档 buyPrice >= minPrice
最低价兜底聚合组内每个网格层最多一条 leg
dynamicGridEnabled 时同层 index >= 2 的 stepRatio 大于 index 1（首档间距仍用 initialStep）
dynamicGridEnabled 时所有 stepRatio < 1 且 buyPrice > 0
currentPrice <= minPrice 时 state == stopped
聚合不改变 legs 数量和每条 leg 的 sellPrice
totalNetProfit == realizedGridProfit + basePositionUnrealizedPnL
```

## 8. 分阶段验收标准

### 8.1 Phase 1：计算器升级

交付物：

- 最低价兜底网。
- 总弹药反推 `amountPerGrid`。
- 跨层价位聚合。
- 交易成本模型。
- 留利底仓拆分。
- 动态步长（稳健 scale=0.3 / 抄底 scale=0.6）。
- 新单测覆盖本文关键边界。

DOD：

| 验收项             | 验证方式                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 总投入不超过总弹药 | 单测构造多组价格、步长、加码系数，断言 `totalBudgetRequired <= totalBudget`                                                                         |
| 最后一网价格规则   | 单测断言每层最后一档夹到 `minPrice`，且全部 `buyPrice >= minPrice`                                                                                  |
| 同层最低价去重     | 单测覆盖单个近价档、tick 阈值主导、连续相邻 tick、`minPrice` 非 tick 对齐及跨层 anchor 场景；断言最低价组每层只保留一条腿，且不误删上一聚合组普通档 |
| 聚合不破坏配对     | 单测断言聚合前后 `GridLeg` 数量和每条腿的卖出价不变                                                                                                 |
| 成本入模           | 单测断言佣金、滑点改变净利润，且成本覆盖步长可计算                                                                                                  |
| 底仓拆分           | 单测断言 `basePositionShares = sum(reservedShares)`                                                                                                 |
| 动态与静态可区分   | 单测同一参数下 `dynamicGridEnabled: true` 与 `false` 的 legs 或聚合结果不同                                                                         |
| 层内步长逐档放大   | 单测断言 `generateAllPriceLadders` 同层 `indexInLayer >= 2` 的 `stepRatio` 大于首档下行间距                                                         |
| 动态步长约束       | 单测断言动态模式下所有档位 `stepRatio < 1` 且 `buyPrice > 0`                                                                                        |
| 动态下兜底网       | 单测在 `dynamicGridEnabled: true` 时仍满足最后一网夹到 `minPrice`                                                                                   |
| 动态下总弹药反推   | 单测 `budgetMode: auto` 且动态开启时 `totalBudgetRequired <= totalBudget`                                                                           |
| 动态下聚合展示     | 单测默认参数：抄底模式无跨层组合行；稳健模式组合组数少于静态；聚合不破坏 legs 配对                                                                  |

### 8.2 Phase 2：数据层与指标计算

交付物：

- 数据源 spike 报告。
- API Routes 主备降级与缓存。
- `src/lib/indicators/` 纯函数指标。
- 指标单测。

DOD：

| 验收项             | 验证方式                                            |
| ------------------ | --------------------------------------------------- |
| 数据源可降级       | mock 主源失败，断言备源成功且 `fallbackUsed = true` |
| 指标可复算         | 固定样本数据单测 ATR、相关性、估值百分位            |
| 数据新鲜度可见     | API 响应和 UI 均展示 `timestamp` 和 `stale`         |
| 免费源不可用不崩页 | 所有源失败时返回 503 或缓存，前端展示错误状态       |

### 8.3 Phase 3：标的筛选仪表盘

交付物：

- 自选 ETF 池。
- 相关性矩阵。
- 波动/流动性散点。
- 估值温度计。
- 网格适配度评分。
- 一键带参跳转网格页。

DOD：

| 验收项         | 验证方式                                  |
| -------------- | ----------------------------------------- |
| 相关性矩阵正确 | 固定收益率样本单测 Pearson                |
| 硬门槛生效     | 低成交额、低规模、高溢价 ETF 被标记或剔除 |
| 跳转参数完整   | E2E 选择 ETF 后跳转网格页，参数被正确带入 |

### 8.4 Phase 4：汇金资金流观测

交付物：

- 宽基 ETF 份额变化表。
- 异动 z-score。
- 大盘涨跌叠加。
- 定期报告持仓校准。

DOD：

| 验收项       | 验证方式                                |
| ------------ | --------------------------------------- |
| 异动识别准确 | 固定份额样本单测 z-score                |
| 不误写事实   | UI 文案只说“代理信号”，不说“汇金已买入” |
| 报告期清晰   | 展示报告期和披露日                      |

### 8.5 Phase 5：趋势节流阀

交付物：

- MA200 与估值三态节流。
- 网格页状态提示。
- 参数建议联动。

DOD：

| 验收项             | 验证方式                                               |
| ------------------ | ------------------------------------------------------ |
| 三态状态正确       | 单测组合 MA200 和估值百分位                            |
| 不改变纯计算可用性 | 无数据时仍可手动生成网格，但显示缺少指标               |
| 只做节流不预测     | 代码中状态只影响买入开关和金额倍数，不生成主观买卖信号 |

## 9. 边界情况清单

后续实现必须逐项考虑。

| 场景                            | 期望处理                                             |
| ------------------------------- | ---------------------------------------------------- |
| `minPrice` 非常接近 `basePrice` | 只生成少量档位或直接提示区间过窄                     |
| `totalBudget` 过小              | 不生成 0 股档位，提示资金不足                        |
| tick 取整导致相邻档位同价       | 合并或跳过重复价，warnings 标注                      |
| 动态步长快速放大                | 不允许价格小于等于 0；最后一网夹到 `minPrice` 后停止 |
| 小网步长小于成本覆盖线          | 生成但红色警告                                       |
| ETF 溢价率异常                  | 不建议开新买单                                       |
| 数据缺失估值                    | 估值状态为 unknown，不阻止手动计算，但不输出开网建议 |
| T+0 字段不确定                  | 按 T+1 保守处理                                      |
| 季报持仓滞后                    | 展示披露日，不参与实时买卖建议                       |
| 免费源限流                      | 使用缓存或备源，展示 stale                           |

## 10. 给后续 AI 的实现顺序建议

为了最小影响，建议后续按以下顺序改代码：

1. 在 `src/types/grid.ts` 旁边新增 V2 类型，先不删除旧类型。
2. 新建 `src/lib/grid/`，把新计算逻辑写成纯函数。
3. 给 `price-ladder.ts` 写单测，先覆盖兜底网和动态步长。
4. 给 `capital-allocation.ts` 写单测，覆盖总弹药反推和整手取整。
5. 给 `trade-cost.ts` 写单测，覆盖 ETF 默认成本和成本覆盖步长。
6. 给 `aggregation.ts` 写单测，覆盖小+中、小+中+大聚合。
7. 给 `stress-test.ts` 写单测，覆盖底仓拆分。
8. 最后替换页面调用，并保留旧参数的兼容默认值。

第一条 PR 应只做 Phase 1 纯计算和单测，避免同时引入外部数据源。

## 11. 参考入口

以下入口仅作为 Phase 2 数据源 spike 的候选参考，不代表接口稳定性承诺：

- 上交所 ETF 产品页：`https://www.sse.com.cn/assortment/fund/etf/list/`
- 中证指数官网指数详情入口：`https://www.csindex.com.cn/`
- 深交所官网产品与市场数据入口：`https://www.szse.cn/`
- 东方财富、腾讯、新浪等免费行情源：可作为候选备源，必须经过限流、字段稳定性和历史深度实测。

## 12. 最终验收

本文档被视为 Phase 0 完成的标准：

- 已说明网格策略的第一性原理。
- 已精确定义最低价兜底网、资金反推、跨层聚合、成本、底仓、趋势节流。
- 已给出相关性、波动、流动性、估值、震荡性、汇金代理指标公式。
- 已给出数据字段和数据源映射。
- 已明确后续模块边界、类型契约、DOD 和边界情况。
