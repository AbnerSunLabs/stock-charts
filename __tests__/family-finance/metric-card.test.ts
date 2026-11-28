/** @jest-environment node */

import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyAmountVisibilityProvider } from '@/components/family/family-amount-visibility';
import { FamilyFinanceMetricCard } from '@/components/family/family-finance-metric-card';

describe('FamilyFinanceMetricCard', () => {
  it('renders the label, formatted amount, hint, and scoped tone class', () => {
    const html = renderToStaticMarkup(
      createElement(FamilyFinanceMetricCard, {
        label: '总资产',
        value: 123456,
        tone: 'primary',
        loading: false,
        hint: '家庭当前资产合计',
      })
    );

    expect(html).toContain('总资产');
    expect(html).toContain('¥123,456.00');
    expect(html).toContain('家庭当前资产合计');
    expect(html).toContain('family-finance-metric--primary');
    expect(html).toContain('family-finance-monetary-value');
  });

  it('Provider 隐藏态展示层渲染 ****，真实金额只留在同宽占位层', () => {
    const html = renderToStaticMarkup(
      createElement(FamilyAmountVisibilityProvider, {
        value: false,
        children: createElement(FamilyFinanceMetricCard, {
          label: '总资产',
          value: 123456,
          tone: 'primary',
          loading: false,
          hint: '家庭当前资产合计',
        }),
      })
    );

    expect(html).toContain('****');
    // 同宽掩码：明文只出现一次，且位于 aria-hidden 的不可见占位层（撑宽防抖、不向读屏暴露）
    expect(html.match(/¥123,456\.00/g)).toHaveLength(1);
    expect(html).toContain('aria-hidden="true"');
    // 展示层走 blur(6px)+opacity 掩码淡切
    expect(html).toContain('blur(6px)');
  });

  it('renders negative values with the negative tone and formatted amount', () => {
    const html = renderToStaticMarkup(
      createElement(FamilyFinanceMetricCard, {
        label: '净资产',
        value: -123456,
        tone: 'negative',
        loading: false,
        hint: '总资产扣除总负债',
      })
    );

    expect(html).toContain('family-finance-metric--negative');
    expect(html).toContain('- ¥123,456.00');
  });

  it('renders the loading skeleton without the amount', () => {
    const html = renderToStaticMarkup(
      createElement(FamilyFinanceMetricCard, {
        label: '总资产',
        value: 123456,
        tone: 'primary',
        loading: true,
        hint: '家庭当前资产合计',
      })
    );

    expect(html).toContain('ant-skeleton');
    expect(html).not.toContain('¥123,456.00');
  });
});

describe('FamilyLedgerPage source contract', () => {
  it('keeps KPI summaries out of the ledger and preserves both responsive tables', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/family/family-ledger-page.tsx'),
      'utf8'
    );

    expect(source).not.toContain('FamilyFinanceMetricCard');
    expect(source).not.toContain('Statistic');
    expect(source).not.toContain('总资产');
    expect(source).not.toContain('总负债');
    expect(source).not.toContain('净资产');
    expect(source.match(/scroll=\{\{ x: 'max-content' \}\}/g)).toHaveLength(2);
  });
});

describe('FamilyFinanceMetricCard motion contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/family/family-finance-metric-card.tsx'),
    'utf8'
  );
  // 微闪关键帧已收口到 FamilyMotionStyles（页面渲染一次），组件只引用动画名
  const motionStylesSource = readFileSync(
    join(process.cwd(), 'src/components/family/family-motion.tsx'),
    'utf8'
  );

  it('数值变化用 key 微闪（0.4→1），不做滚动计数器', () => {
    // key=value：新值到达时重放一次微闪关键帧；金融数据忌误导读数，禁 count-up
    expect(source).toContain('key={value}');
    expect(source).toContain('familyMetricValueIn');
    expect(motionStylesSource).toContain('from { opacity: 0.4; }');
    // 关键帧定义只允许存在一处（FamilyMotionStyles），组件内禁止再内联注入
    expect(source).not.toContain('from { opacity: 0.4; }');
    expect(source).not.toContain('requestAnimationFrame');
  });

  it('骨架→内容淡入、min-h 防弹跳、首屏卡片 stagger', () => {
    expect(source).toContain("animationName: 'viewFadeIn'");
    expect(source).toContain('min-h-[124px]');
    expect(source).toContain('var(--motion-stagger-card)');
    // 文本金额统一走 FamilyAmountText（显隐由其自行淡切）
    expect(source).toContain('FamilyAmountText');
  });
});
