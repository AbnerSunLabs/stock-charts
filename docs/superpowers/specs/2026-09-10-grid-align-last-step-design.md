# 最后一档对齐步长

> 日期：2026-09-10  
> 范围：网格价格线收尾；步长面板开关  
> Demo：`output/grid-min-price-soft-floor-demo.html`（已确认）  
> 状态：已实现

## 行为

参数 `alignLastGridToStep`（默认 `false`，写入 `config.params`，无新表）。

| 开关 | 文案 | 最后一档 |
| --- | --- | --- |
| 关 | 对齐步长 | 夹到 `minPrice`（现状） |
| 开 | 对齐步长 | 按步长继续；第一档买入价 `< minPrice` 留下后该层停止，不改写成最低价。达最大档数且仍高于最低价时，不再补一档贴最低价 |

细则只在开关旁 `HelpTooltip`。结果表列不变，跌幅随价格线变化。

`minPrice` 仍用于校验、市价 `stopped`、最大亏损粗估。
