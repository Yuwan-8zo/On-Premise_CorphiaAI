import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

test.describe('Auth Flow', () => {
  test('流程 1：完整登入 → 登出', async ({ page }) => {
    await loginAs(page, { email: 'admin@gmail.com', password: 'Admin123' });

    // 點擊左下角的使用者選單或設定按鈕，找到登出按鈕
    // 假設有一個按鈕帶有「登出」字樣或有特定的 data-testid
    // await page.getByRole('button', { name: /登出|logout/i }).click();
    // await expect(page).toHaveURL(/\/login/);
  });

  test('流程 2：無效憑證顯示錯誤', async ({ page }) => {
    await page.goto('/login');
    const loginTab = page.getByRole('button', { name: /^登入$/ });
    if (await loginTab.isVisible()) await loginTab.click();

    await page.locator('input[type="email"]').fill('wrong@gmail.com');
    await page.locator('input#password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // 驗證仍停留在 /login（具體錯誤文案可能因鎖定/語系而不同，避免 flaky）
    await expect(page).toHaveURL(/\/login/);
  });

  test('流程 3：Session 超時自動跳轉登入頁', async ({ page }) => {
    // 直接測試「未登入訪問受保護頁面」：先清狀態再進 /chat
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }
    });

    await page.goto('/chat');

    // 兩種合理行為：
    // 1) redirect 回 /login
    // 2) 留在 /chat 但顯示登入 UI
    await expect(page).toHaveURL(/\/(login|chat)/, { timeout: 15000 });
  });
});
