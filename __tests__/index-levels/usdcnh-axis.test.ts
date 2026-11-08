import { domainOf, labelOf } from '@/components/index-levels/index-level-chart';

const rows = [
  { tradeDate: '2024-01-02', close: 7.1 },
  { tradeDate: '2026-11-06', close: 6.67 },
];

describe('美元兑人民币纵轴', () => {
  it('从 6 起，上沿包住收盘', () => {
    expect(domainOf(rows, 'USDCNH.OTH')).toEqual([6, 8]);
  });

  it('刻度保留两位小数', () => {
    expect(labelOf(6.5, 'USDCNH.OTH', rows)).toBe('6.50');
  });

  it('其他 .OTH 指数仍从 0 起', () => {
    expect(domainOf([{ tradeDate: '2024-01-02', close: 5200 }], 'SPX.OTH')[0]).toBe(0);
  });
});
