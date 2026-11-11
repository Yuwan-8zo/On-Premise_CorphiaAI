import { expect, type Page } from '@playwright/test';

async function dismissOnboardingIfPresent(page: Page) {
  const dialog = page.getByRole('dialog', { name: /歡迎使用|welcome/i });
  if (await dialog.isVisible().catch(() => false)) {
    const skipBtn = dialog.getByRole('button', { name: /略過|skip/i });
    if (await skipBtn.isVisible().catch(() => false)) {
      await skipBtn.click();
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await expect(dialog).toBeHidden({ timeout: 10000 });
  }
}

export async function loginAs(page: Page, opts: { email: string; password: string }) {
  // 測試穩定性：清掉殘留的登入狀態，避免 /login 被自動導到 /（導致 selector 找不到）
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
  await page.reload();

  // 確保在 login tab（避免 register 的 confirm-password 讓 selector 變成 2 個）
  const loginTab = page.getByRole('button', { name: /^登入$/ });
  if (await loginTab.isVisible()) {
    await loginTab.click();
  }

  const emailBox = page.getByRole('textbox', { name: /信箱|email/i });
  await emailBox.waitFor({ state: 'visible', timeout: 15000 });
  await emailBox.fill(opts.email);
  await page.locator('input#password').fill(opts.password);

  // 送出按鈕有兩個「登入」（tab + submit），用 type=submit 精準指定
  await page.locator('button[type="submit"]').click();
  // 登入後可能導向 `/` 或 `/chat`（依產品預設入口而定），但不應停留在 `/login`
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

  // 首次登入常會出現新手導覽遮罩，會攔截點擊；測試先關掉它
  await dismissOnboardingIfPresent(page);
}

