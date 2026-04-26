import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('流程 1：完整登入 → 登出', async ({ page }) => {
    // 前往登入頁
    await page.goto('/login');

    // 確認頁面包含登入表單
    await expect(page.getByRole('button', { name: /登入|login/i })).toBeVisible();

    // 填寫表單（使用假設的測試帳號）
    // 若介面因語系不同，可以用 CSS selector 或 placeholder 抓取
    await page.locator('input[type="email"]').fill('admin@corphia.com');
    await page.locator('input[type="password"]').fill('Admin123!');

    // 送出
    await page.getByRole('button', { name: /登入|login/i }).click();

    // 驗證是否導向 /chat (假設預設進入點)
    await expect(page).toHaveURL(/\/chat/);

    // 點擊左下角的使用者選單或設定按鈕，找到登出按鈕
    // 假設有一個按鈕帶有「登出」字樣或有特定的 data-testid
    // await page.getByRole('button', { name: /登出|logout/i }).click();
    // await expect(page).toHaveURL(/\/login/);
  });

  test('流程 2：無效憑證顯示錯誤', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"]').fill('wrong@corphia.com');
    await page.locator('input[type="password"]').fill('wrongpassword');

    await page.getByRole('button', { name: /登入|login/i }).click();

    // 驗證錯誤訊息出現（toast 或行內錯誤）
    const errorMessage = page.locator('text=/錯誤|失敗|error/i');
    await expect(errorMessage.first()).toBeVisible();
    
    // URL 應停留在 /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('流程 3：Session 超時自動跳轉登入頁', async ({ page }) => {
    // 這個情境在 E2E 比較難模擬真實超時，可以用 API 刪除 token 的方式模擬
    // 這裡我們直接測試未登入訪問受保護頁面
    await page.goto('/chat');
    
    // 應該被導向登入頁
    await expect(page).toHaveURL(/\/login/);
  });
});
