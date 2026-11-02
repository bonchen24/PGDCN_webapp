import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:2357/pgdcn', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').fill('luongxuanhung');
  await page.locator('input[type="password"]').fill('Abc123456');
  await page.locator('button:has-text("Đăng nhập hệ thống")').click();
  await page.waitForTimeout(2000);

  // Navigate to PGD requests list
  await page.goto('http://localhost:2357/pgdcn/pgd', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on the first request code (e.g., PGD-260913-02)
  const codeCell = page.locator('text=PGD-260913-02').first();
  if (await codeCell.count() > 0) {
    await codeCell.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'eval-desktop-05-pgd-detail-7-stages.png', fullPage: true });
    console.log('Saved eval-desktop-05-pgd-detail-7-stages.png');

    // Mobile view of the same opened dossier
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'eval-mobile-04-pgd-detail-7-stages.png', fullPage: true });
    console.log('Saved eval-mobile-04-pgd-detail-7-stages.png');
  } else {
    console.log('PGD-260913-02 not found!');
  }

  await browser.close();
}

main().catch(console.error);
