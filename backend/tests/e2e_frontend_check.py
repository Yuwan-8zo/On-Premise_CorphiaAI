import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

async def run():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        print("Navigating to http://localhost:5173 ...")
        try:
            await page.goto("http://localhost:5173", timeout=30000)
            
            # Wait for content to load
            await page.wait_for_selector("text=Corphia AI", timeout=10000)
            print("Page title found.")
            
            # Check for login form
            email_input = await page.wait_for_selector('input[type="email"]')
            password_input = await page.wait_for_selector('input[type="password"]')
            
            if email_input and password_input:
                print("Login form fields found.")
            
            # Create screenshots directory
            screenshot_dir = Path("screenshots")
            screenshot_dir.mkdir(exist_ok=True)
            
            # Take screenshot
            screenshot_path = screenshot_dir / "login_success.png"
            await page.screenshot(path=str(screenshot_path))
            print(f"Screenshot saved to {screenshot_path.absolute()}")
            
        except Exception as e:
            print(f"Test failed: {e}")
            await page.screenshot(path="screenshots/error.png")
            print("Error screenshot saved.")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
