/** @jest-environment node */

import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyAmountVisibilityProvider } from '@/components/family/family-amount-visibility';
import { FamilyAmountVisibilityButton } from '@/components/family/family-amount-visibility-toggle';

describe('FamilyOverviewPage amount visibility contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/family/family-overview-page.tsx'),
    'utf8'
  );

  it('标题旁用统一的显隐切换按钮（眼睛图标叠层 crossfade），默认隐藏，并用 Provider 包裹', () => {
    // 眼睛图标硬编码已收口进 FamilyAmountVisibilityButton，页面只负责挂载与持有状态
    expect(source).toContain('FamilyAmountVisibilityButton');
    // 防回退：页面源码不再直接引用眼睛图标
    expect(source).not.toContain('EyeFilled');
    expect(source).not.toContain('EyeInvisibleFilled');
    expect(source).toContain('family-finance-header__title-row');
    expect(source).toContain('FamilyAmountVisibilityProvider');
    expect(source).toContain(
      'const [amountsVisible, setAmountsVisible] = useState(false)'
    );
    expect(source).not.toContain('<Switch');
  });

  it('桑基图金额显隐走 FamilyChartAmountFade 原地淡切，不随显隐重挂载', () => {
    expect(source).toContain('FamilyChartAmountFade');
    // 防回退到 key={amountsVisible} 整图重挂载方案
    expect(source).not.toContain('key={amountsVisible');
  });
});

describe('FamilyAmountVisibilityButton eye icon contract', () => {
  it('图标收口在按钮组件内：两层眼睛图标叠放 crossfade（micro 档）', () => {
    const toggleSource = readFileSync(
      join(
        process.cwd(),
        'src/components/family/family-amount-visibility-toggle.tsx'
      ),
      'utf8'
    );

    expect(toggleSource).toContain('EyeFilled');
    expect(toggleSource).toContain('EyeInvisibleFilled');
    // 叠层切换只过渡 opacity/transform，时长走 motion token
    expect(toggleSource).toContain("'opacity, transform'");
    expect(toggleSource).toContain('var(--motion-duration-micro)');
  });

  it('输出含眼睛图标与显隐 aria-label，aria-pressed 随状态翻转', () => {
    const hiddenHtml = renderToStaticMarkup(
      createElement(FamilyAmountVisibilityProvider, {
        value: false,
        children: createElement(FamilyAmountVisibilityButton, {
          onToggle: () => {},
        }),
      })
    );
    expect(hiddenHtml).toContain('aria-label="显示金额"');
    expect(hiddenHtml).toContain('aria-pressed="false"');
    // 两层眼睛图标（可见/隐藏）同时挂载，靠 opacity 切换而非条件渲染
    expect(hiddenHtml.match(/<svg[\s>]/g)).toHaveLength(2);

    const shownHtml = renderToStaticMarkup(
      createElement(FamilyAmountVisibilityProvider, {
        value: true,
        children: createElement(FamilyAmountVisibilityButton, {
          onToggle: () => {},
        }),
      })
    );
    expect(shownHtml).toContain('aria-label="隐藏金额"');
    expect(shownHtml).toContain('aria-pressed="true"');
    expect(shownHtml.match(/<svg[\s>]/g)).toHaveLength(2);
  });
});
