import {
  formatGridAmount,
  formatGridPrice,
  formatSignedGridAmount,
} from '@/lib/grid/format-grid-amount';

describe('formatGridAmount', () => {
  it('整数不补小数', () => {
    expect(formatGridAmount(2600)).toBe('2,600');
  });

  it('最多保留两位小数', () => {
    expect(formatGridAmount(7221.256)).toBe('7,221.26');
    expect(formatGridAmount(7221.2)).toBe('7,221.2');
  });

  it('非有限值显示破折号', () => {
    expect(formatGridAmount(Number.NaN)).toBe('—');
  });
});

describe('formatSignedGridAmount', () => {
  it('正数加 +', () => {
    expect(formatSignedGridAmount(7221.2)).toBe('+7,221.2');
  });

  it('负数与零不加 +', () => {
    expect(formatSignedGridAmount(-10.15)).toBe('-10.15');
    expect(formatSignedGridAmount(0)).toBe('0');
  });
});

describe('formatGridPrice', () => {
  it('按 priceUnit 保留报价位数，不截成两位', () => {
    expect(formatGridPrice(0.607, 0.001)).toBe('0.607');
    expect(formatGridPrice(1.2, 0.01)).toBe('1.20');
  });
});
