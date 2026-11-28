/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('FamilyLedgerPage amount visibility contract', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/components/family/family-ledger-page.tsx'),
    'utf8'
  );

  it('标题旁用统一的显隐切换按钮（眼睛图标叠层 crossfade），默认隐藏，并用 Provider 包裹', () => {
    // 眼睛图标硬编码已收口进 FamilyAmountVisibilityButton（渲染契约由
    // amount-visibility-ui.test.ts 覆盖），页面只负责挂载与持有状态
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

  it('表格金额列走 FamilyAmountText 同宽掩码淡切，不整列重挂载', () => {
    expect(source).toContain('FamilyAmountText');
    expect(source).not.toContain('key={amountsVisible');
  });
});
