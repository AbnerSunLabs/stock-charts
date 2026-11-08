import { expect, test } from '@playwright/test';

/** 关联标的折线布局：ETF 与场外基金齐全时一行两列，窄屏折回单列。 */
test.describe('指数点位跟踪 · 关联标的布局', () => {
  test('中证传媒：两张折线一行两列并在窄屏折回单列', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/view/index-levels?index=399971.SZ');

    const row = page.locator('.etf-fund-row');
    await expect(row).toBeVisible();
    await expect(row.locator(':scope > section')).toHaveCount(2);
    // 名称互为子串，改用代码断言各自在列
    await expect(row.getByText('512980')).toBeVisible();
    await expect(row.getByText('004752')).toBeVisible();
    const fund = row.getByRole('link', { name: '广发中证传媒ETF联接A' });
    await expect(fund).toBeVisible();
    await expect(fund).toHaveAttribute('href', 'https://qieman.com/longwin/funds/004752?prodCode=LONG_WIN');

    // 宽屏：两列等宽分轨
    expect(await countGridTracks(page, row)).toBe(2);

    // ≤1100px 断点：与总览区同档折回单列
    await page.setViewportSize({ width: 1000, height: 900 });
    expect(await countGridTracks(page, row)).toBe(1);
  });

  test('美元兑人民币：招行汇买与汇卖一行两列并在窄屏折回单列', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/view/index-levels?index=USDCNH.OTH');

    const row = page.locator('.etf-fund-row');
    await expect(row).toBeVisible();
    const sections = row.locator(':scope > section');
    await expect(sections).toHaveCount(2);
    await expect(sections.nth(0).getByText('USD.ASK')).toBeVisible();
    await expect(sections.nth(1).getByText('USD.BID')).toBeVisible();
    await expect(sections.nth(0).getByLabel('查看说明')).toBeVisible();
    await expect(sections.nth(1).getByLabel('查看说明')).toBeVisible();
    expect(await countGridTracks(page, row)).toBe(2);

    await page.setViewportSize({ width: 1000, height: 900 });
    expect(await countGridTracks(page, row)).toBe(1);
  });

  test('证券公司：证券ETF与场外基金一行两列', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/view/index-levels?index=399975.SZ');

    const row = page.locator('.etf-fund-row');
    await expect(row).toBeVisible();
    await expect(row.locator(':scope > section')).toHaveCount(2);
    await expect(row.getByText('512880')).toBeVisible();
    await expect(row.getByText('502010')).toBeVisible();
    const fund = row.getByRole('link', { name: '易方达中证全指证券公司指数(LOF)A' });
    await expect(fund).toBeVisible();
    await expect(fund).toHaveAttribute('href', 'https://qieman.com/longwin/funds/502010?prodCode=LONG_WIN');
    expect(await countGridTracks(page, row)).toBe(2);
  });

  test('中证500：未配置关联标的时不渲染该区块', async ({ page }) => {
    await page.goto('/view/index-levels');
    await expect(page.locator('.etf-fund-row')).toHaveCount(0);
  });
});

/** 读取网格分轨数：fr 轨道在计算样式里已解析为像素值。 */
async function countGridTracks(page: import('@playwright/test').Page, row: import('@playwright/test').Locator): Promise<number> {
  const columns = await row.evaluate(el => getComputedStyle(el).gridTemplateColumns);
  return columns.split(' ').filter(track => track.length > 0).length;
}
