import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.describe('网格策略', () => {
  test('默认参数可生成策略结果', async ({ page }) => {
    await page.goto('/view/grid');

    await page.getByRole('button', { name: '生成策略' }).click();

    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/共 \d+ 个网格档位/)).toBeVisible();
    await expect(page.getByRole('button', { name: '修改参数' })).toBeVisible();
    await expect(page.locator('#grid-primary-kpis')).toBeVisible();
  });

  test('结果态可打开参数抽屉并重新生成', async ({ page }) => {
    await page.goto('/view/grid');
    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByRole('button', { name: '修改参数' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('当前结果')).toBeVisible();
    await expect(page.getByText('未保存')).toBeVisible();
    await expect(page.getByRole('heading', { name: '策略优势推演' })).toBeVisible();

    await page.getByRole('button', { name: '修改参数' }).click();
    await page.locator('#basePrice').fill('1.25');
    await page.keyboard.press('Escape');
    await expect(page.locator('.grid-summary-bar__dirty-chip')).toBeVisible();
    await expect(page.getByRole('button', { name: '去重新生成' })).toBeVisible();

    await page.getByRole('button', { name: '去重新生成' }).click();
    await expect(
      page.getByRole('button', { name: '重新生成', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: '重新生成', exact: true }).click();
    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: '修改参数' })).toBeVisible();
  });

  test('生成后表格处于全宽结果区', async ({ page }) => {
    await page.goto('/view/grid');
    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });

    const table = page.locator('.grid-result-table');
    const container = page.locator('.site-container--grid');
    const tableBox = await table.boundingBox();
    const containerBox = await container.boundingBox();
    expect(tableBox).not.toBeNull();
    expect(containerBox).not.toBeNull();
    // 全宽结果：表格宽度应接近内容容器（允许 padding）
    expect(tableBox!.width).toBeGreaterThan(containerBox!.width * 0.55);
  });

  test('生成后可下载网格表格 PNG', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/view/grid');
    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });

    const hint = page.getByText(
      '同价位小/中/大网已合并为聚合组；展开后可对各档记账'
    );
    const downloadBtn = page.getByRole('button', { name: '下载表格' });
    const table = page.locator('.grid-result-table');

    await expect(hint).toBeVisible();
    await expect(downloadBtn).toBeVisible();

    const hintBox = await hint.boundingBox();
    const btnBox = await downloadBtn.boundingBox();
    const tableBox = await table.boundingBox();
    expect(hintBox).not.toBeNull();
    expect(btnBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    expect(hintBox!.x).toBeLessThan(btnBox!.x);
    expect(hintBox!.y).toBeLessThan(tableBox!.y);
    expect(btnBox!.y).toBeLessThan(tableBox!.y);

    const visibleExpandableGroupCount = await page
      .locator(
        '[aria-label="网格结果表，可横向滚动"]:not([aria-hidden="true"]) .ant-table-row-expand-icon-collapsed'
      )
      .count();
    expect(visibleExpandableGroupCount).toBeGreaterThan(0);
    const downloadPromise = page.waitForEvent('download');

    await downloadBtn.click();
    await expect(
      page.locator(
        '[aria-hidden="true"] .grid-result-expanded-table'
      )
    ).toHaveCount(visibleExpandableGroupCount);
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const png = await readFile(downloadPath!);
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png.byteLength).toBeGreaterThan(1000);
    expect(png.readUInt32BE(16)).toBeGreaterThan(0);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(8192);
    expect(png.readUInt32BE(20)).toBeGreaterThan(0);
    await expect(page.getByText(/已下载 网格策略-/)).toBeVisible({
      timeout: 15_000,
    });
    expect(pageErrors).toEqual([]);
  });

  test('下载表格后保持用户手动展开的聚合组', async ({ page }) => {
    await page.goto('/view/grid');
    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });

    const expandBtn = page.getByRole('button', { name: '展开行' }).first();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();
    await expect(page.getByRole('button', { name: '关闭行' }).first()).toBeVisible();

    await page.getByRole('button', { name: '下载表格' }).click();
    await expect(page.getByText(/已下载 网格策略-/)).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('button', { name: '关闭行' }).first()).toBeVisible();
    await expect(page.locator('.grid-result-expanded-table tbody tr')).not.toHaveCount(
      0
    );
  });

  test('全部收起时下载表格不改变页面展开状态', async ({ page }) => {
    await page.goto('/view/grid');
    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByText('网格计算结果')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: '关闭行' })).toHaveCount(0);

    await page.getByRole('button', { name: '下载表格' }).click();
    await expect(page.getByText(/已下载 网格策略-/)).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole('button', { name: '关闭行' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '展开行' }).first()).toBeVisible();
  });

  test('最低价不低于基准价时禁用生成并展示错误', async ({ page }) => {
    await page.goto('/view/grid');

    await page.locator('#minPrice').fill('1.5');
    await page.locator('#basePrice').fill('1');

    const errorAlert = page.getByRole('alert').filter({ hasText: '参数校验未通过' });
    await expect(errorAlert).toContainText('最低价必须小于基准价');
    await expect(page.getByRole('button', { name: '生成策略' })).toBeDisabled();
  });

  test('未登录保存与我的策略弹出网格登录弹窗', async ({ page }) => {
    await page.goto('/view/grid');
    await expect(page.getByRole('button', { name: '我的策略' })).toBeVisible();

    await page.getByRole('button', { name: '我的策略' }).click();
    const libraryLogin = page.getByRole('dialog', { name: '登录以查看我的策略' });
    await expect(libraryLogin).toBeVisible();
    await expect(page.getByText(/家庭账号|已授权/)).toHaveCount(0);
    await libraryLogin.getByRole('button', { name: 'Close' }).click();
    await expect(libraryLogin).toBeHidden();

    await page.getByRole('button', { name: '生成策略' }).click();
    await expect(page.getByRole('button', { name: '保存策略' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: '保存策略' })).toBeEnabled();
    await page.getByRole('button', { name: '保存策略' }).click();
    const saveLogin = page.getByRole('dialog', { name: '登录以保存网格策略' });
    await expect(saveLogin).toBeVisible();
    await expect(page.getByText(/家庭账号|已授权/)).toHaveCount(0);
  });
});
