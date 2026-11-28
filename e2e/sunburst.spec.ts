import { expect, test } from '@playwright/test';

test.describe('仓位旭日图', () => {
  test('填写金额并生成图表', async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto('/view/sunburst');

    await expect(page.getByRole('region', { name: '持仓配置' })).toBeVisible();

    await page.getByPlaceholder('请输入总投资额').fill('1000000');

    const leafInput = page
      .locator('div.flex.flex-wrap.items-center')
      .filter({ has: page.getByText('红利', { exact: true }) })
      .getByRole('spinbutton');
    await leafInput.fill('200000');

    await page.getByRole('button', { name: '生成图表' }).click();

    const chartSection = page.getByRole('region', { name: '旭日图预览' });
    await expect(chartSection).toBeVisible({ timeout: 15_000 });
    await expect(chartSection.locator('canvas')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByRole('button', { name: '下载图表 PNG' })).toBeEnabled();
  });
});
