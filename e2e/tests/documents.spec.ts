import { test, expect } from '@playwright/test';

test.describe('Documents Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@corphia.com');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.getByRole('button', { name: /登入|login/i }).click();
    await expect(page).toHaveURL(/\/chat/);
    
    // 切換到文件管理頁面
    await page.getByRole('link', { name: /文件|documents/i }).click();
    await expect(page).toHaveURL(/\/documents/);
  });

  test('流程 1：確保文件列表有顯示', async ({ page }) => {
    // 檢查是否有上傳按鈕
    await expect(page.getByRole('button', { name: /上傳|upload/i })).toBeVisible();

    // 檢查表格或列表的存在
    const tableOrList = page.locator('table, .grid');
    await expect(tableOrList).toBeVisible();
  });

  // 實際檔案上傳在 E2E 會需要先準備好檔案
  /*
  test('流程 2：上傳文件', async ({ page }) => {
    // 監聽 file chooser
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /上傳|upload/i }).click(),
    ]);

    await fileChooser.setFiles('tests/fixtures/sample.txt');
    // 驗證進度條與成功訊息
    await expect(page.locator('text=/上傳成功/i')).toBeVisible();
  });
  */
});
