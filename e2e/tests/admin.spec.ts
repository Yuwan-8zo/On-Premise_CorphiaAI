import { test, expect } from '@playwright/test';

test.describe('Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 使用管理員帳號登入
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('engineer@corphia.com');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.getByRole('button', { name: /登入|login/i }).click();
    await expect(page).toHaveURL(/\/chat/);
    
    // 切換到管理員儀表板
    await page.getByRole('link', { name: /管理|admin/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('流程 1：查看系統監控儀表板', async ({ page }) => {
    // 檢查標題
    await expect(page.getByRole('heading', { name: /系統監控|system/i }).first()).toBeVisible();

    // 檢查卡片數據（使用者總數、對話數等）
    await expect(page.locator('text=/總使用者|Total Users/i')).toBeVisible();
    await expect(page.locator('text=/系統記憶體|Memory/i')).toBeVisible();
  });

  test('流程 2：切換至用戶管理', async ({ page }) => {
    // 點擊「用戶管理」分頁
    const usersTab = page.getByRole('tab', { name: /用戶|users/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
      
      // 檢查表格
      await expect(page.locator('table')).toBeVisible();
      await expect(page.locator('text=/email|電子郵件/i').first()).toBeVisible();
    }
  });
});
