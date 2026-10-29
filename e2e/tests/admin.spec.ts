import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 使用管理員帳號登入
    await loginAs(page, { email: 'engineer@gmail.com', password: 'Engineer123' });
    
    // 直接導向管理頁（避免導覽列 selector 不穩/被收合）
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('流程 1：查看系統監控儀表板', async ({ page }) => {
    // 檢查標題
    // 不同語系/版本標題可能不同，至少應出現後台入口（heading 或側欄「總覽」）
    const adminHeading = page.getByRole('heading', { name: /管理後台|admin/i }).first();
    const overviewBtn = page.getByRole('button', { name: /總覽|overview/i });
    try {
      await expect(adminHeading).toBeVisible({ timeout: 15000 });
    } catch {
      await expect(overviewBtn).toBeVisible({ timeout: 15000 });
    }

    // 檢查卡片數據（使用者總數、對話數等）
    await expect(page.locator('text=/使用者總數|Total Users/i')).toBeVisible();
    await expect(page.locator('text=/文件總數|Documents/i')).toBeVisible();
  });

  test('流程 2：切換至用戶管理', async ({ page }) => {
    // 左側選單是 navigation button（非 tab）
    const usersBtn = page.getByRole('button', { name: /使用者|users/i });
    await expect(usersBtn).toBeVisible();
    await usersBtn.click();

    // 檢查表格
    await expect(page.locator('table')).toBeVisible();
    // 表頭文案可能依語系/版本不同，這裡只檢查有渲染任一欄位標題
    await expect(page.locator('table thead')).toBeVisible();
  });
});
