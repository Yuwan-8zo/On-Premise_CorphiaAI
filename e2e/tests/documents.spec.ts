import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

test.describe('Documents Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, { email: 'admin@gmail.com', password: 'Admin123' });
    
    // 直接導向文件頁（避免導覽列因版型/權限變動造成 selector 不穩）
    await page.goto('/documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  test('流程 1：確保文件列表有顯示', async ({ page }) => {
    // 檢查是否有選檔/上傳按鈕（此頁目前顯示為 "Choose File"）
    await expect(page.getByRole('button', { name: /choose file|選擇|上傳|upload/i })).toBeVisible();

    // 檢查列表區塊存在（此頁是卡片清單而非 table）
    await expect(page.getByRole('heading', { name: /已上傳文件/i })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: /搜尋檔名/i })).toBeVisible();
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
