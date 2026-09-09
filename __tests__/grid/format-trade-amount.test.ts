import { formatTradeAmount } from '@/lib/grid/format-trade-amount';

describe('formatTradeAmount', () => {
  it('应格式化价×量为两位小数', () => {
    expect(formatTradeAmount(0.823, 6300)).toBe('5,184.90');
  });

  it('无效输入应显示破折号', () => {
    expect(formatTradeAmount(undefined, 6300)).toBe('—');
    expect(formatTradeAmount(0.823, 0)).toBe('—');
  });
});
