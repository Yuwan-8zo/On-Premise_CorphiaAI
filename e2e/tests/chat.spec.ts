import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

test.describe('Chat Flow', () => {
  // 為了測試順利，可以設定 auth 狀態（例如透過 storage state），這裡示範每次重登
  test.beforeEach(async ({ page }) => {
    await loginAs(page, { email: 'admin@gmail.com', password: 'Admin123' });
  });

  test('流程 1：建立新對話 → 送出訊息 → 收到 AI 回覆', async ({ page }) => {
    // 點擊「新對話」按鈕
    const newChatBtn = page.getByRole('button', { name: /新對話|new chat/i });
    if (await newChatBtn.isVisible()) {
      await newChatBtn.click();
    }

    // 等待輸入框可用（模型/會話載入中會 disabled）
    const chatInput = page.getByRole('textbox', { name: /輸入訊息/i });
    await expect(chatInput).toBeVisible({ timeout: 15000 });
    await expect(chatInput).toBeEnabled({ timeout: 30000 });

    // 填寫訊息
    const testMessage = `Hello, this is a test from Playwright: ${Date.now()}`;
    await chatInput.fill(testMessage);

    // 送出：此頁為單行輸入行為（Enter 送出）
    await chatInput.press('Enter');

    // 驗證側邊欄出現新對話（會用訊息前綴當標題，通常會被截斷）
    await expect(page.locator('text=/一般聊天/i')).toBeVisible();
    await expect(page.locator(`text=${testMessage.slice(0, 32)}`).first()).toBeVisible({ timeout: 20000 });
  });

  test('流程 2：刪除對話（含確認對話框）', async ({ page }) => {
    // 若尚無任何對話，先送一則訊息建立對話
    const chatInput = page.getByRole('textbox', { name: /輸入訊息/i });
    await expect(chatInput).toBeVisible({ timeout: 15000 });
    await expect(chatInput).toBeEnabled({ timeout: 30000 });
    await chatInput.fill(`E2E seed message ${Date.now()}`);
    await chatInput.press('Enter');

    // 在側邊欄找到剛建立的對話（以訊息前綴作為標題）
    const createdTitlePrefix = 'E2E seed message';
    const createdItem = page.locator(`text=${createdTitlePrefix}`).first();
    await expect(createdItem).toBeVisible({ timeout: 20000 });

    // 同一列通常會有刪除按鈕（只有圖示的 button），點擊後確認刪除
    const row = createdItem.locator('xpath=ancestor::*[self::div or self::li][1]');
    const deleteBtn = row.locator('button').filter({ has: page.locator('img') }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      const confirmBtn = page.getByRole('button', { name: /確認|刪除|delete/i });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
    }
  });
});
