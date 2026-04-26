import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  // 為了測試順利，可以設定 auth 狀態（例如透過 storage state），這裡示範每次重登
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@corphia.com');
    await page.locator('input[type="password"]').fill('Admin123!');
    await page.getByRole('button', { name: /登入|login/i }).click();
    await expect(page).toHaveURL(/\/chat/);
  });

  test('流程 1：建立新對話 → 送出訊息 → 收到 AI 回覆', async ({ page }) => {
    // 點擊「新對話」按鈕
    const newChatBtn = page.getByRole('button', { name: /新對話|new chat/i });
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }

    // 找到輸入框
    const chatInput = page.locator('textarea');
    await expect(chatInput).toBeVisible();

    // 填寫訊息
    const testMessage = `Hello, this is a test from Playwright: ${Date.now()}`;
    await chatInput.fill(testMessage);

    // 送出
    await chatInput.press('Enter');

    // 驗證輸入框已被清空
    await expect(chatInput).toHaveValue('');

    // 驗證自己送出的訊息有出現
    await expect(page.locator(`text=${testMessage}`)).toBeVisible();

    // 驗證 AI 的回覆泡泡出現（因為需要等待串流或 API 回應，給予較長 timeout）
    // 這裡我們假設 AI 回覆元件會有特定的 class 或角色
    const aiResponse = page.locator('.message-bubble.ai').last();
    await expect(aiResponse).toBeVisible({ timeout: 15000 });
  });

  test('流程 2：刪除對話（含確認對話框）', async ({ page }) => {
    // 在側邊欄找到第一個對話
    const firstConversation = page.locator('.conversation-item').first();
    await expect(firstConversation).toBeVisible();

    // Hover 或點擊設定按鈕
    await firstConversation.hover();
    const deleteBtn = firstConversation.locator('button[title="刪除"], button[title="Delete"], .delete-btn');
    
    // 如果存在刪除按鈕就點擊
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      
      // 點擊確認彈出視窗的「確認」
      const confirmBtn = page.getByRole('button', { name: /確認|刪除|delete/i });
      await confirmBtn.click();
      
      // 驗證刪除成功的 Toast 或側邊欄數量減少
      await expect(page.locator('text=/已刪除/i').first()).toBeVisible();
    }
  });
});
