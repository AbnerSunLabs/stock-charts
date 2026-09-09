/** 网格策略成交流水领域类型 */

export type GridStrategyTradeSide = 'buy' | 'sell';

/** 已持久化的一笔流水 */
export interface GridStrategyTrade {
  id: string;
  strategyId: string;
  levelKey: string;
  side: GridStrategyTradeSide;
  price: number;
  qty: number;
  tradeDate: string;
  createdAt: string;
}

/** 新建流水载荷 */
export interface GridStrategyTradeCreatePayload {
  strategyId: string;
  levelKey: string;
  side: GridStrategyTradeSide;
  price: number;
  qty: number;
  tradeDate: string;
}
