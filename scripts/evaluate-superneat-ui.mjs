import { chromium } from '@playwright/test';

async function evaluateSuperneatUI() {
  const browser = await chromium.launch({ headless: true });
  
  // 1. DESKTOP VIEWPORT
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktopContext.newPage();
  
  // Login
  await page.goto('http://localhost:2357/pgdcn', { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').fill('luongxuanhung');
  await page.locator('input[type="password"]').fill('Abc123456');
  await page.locator('button:has-text("Đăng nhập hệ thống")').click();
  await page.waitForTimeout(3000);
  
  // Dashboard screenshot
  await page.screenshot({ path: 'eval-desktop-01-dashboard.png', fullPage: true });
  console.log('Saved eval-desktop-01-dashboard.png');

  // PCN Dossiers list (Compact 2-tier table)
  await page.goto('http://localhost:2357/pgdcn/pcn', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'eval-desktop-02-pcn-queue.png', fullPage: true });
  console.log('Saved eval-desktop-02-pcn-queue.png');

  // PCN Detail Workspace (65/35 split & horizontal rail)
  await page.goto('http://localhost:2357/pgdcn/pcn/dossiers/standard-dossier-qc4-dn-qc4-0583', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'eval-desktop-03-pcn-detail-65-35.png', fullPage: true });
  console.log('Saved eval-desktop-03-pcn-detail-65-35.png');

  // PGD Requests list
  await page.goto('http://localhost:2357/pgdcn/pgd', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'eval-desktop-04-pgd-queue.png', fullPage: true });
  console.log('Saved eval-desktop-04-pgd-queue.png');

  // PGD Detail Workspace with 7 stages
  const firstPgdLink = page.locator('a[href*="/pgdcn/pgd/"]').first();
  if (await firstPgdLink.count() > 0) {
    await firstPgdLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'eval-desktop-05-pgd-detail-7-stages.png', fullPage: true });
    console.log('Saved eval-desktop-05-pgd-detail-7-stages.png');
  } else {
    // Click table cell with code
    const codeBtn = page.locator('text=PGD-260913-01, text=PGD-260913-02, button:has-text("PGD-")').first();
    if (await codeBtn.count() > 0) {
      await codeBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'eval-desktop-05-pgd-detail-7-stages.png', fullPage: true });
      console.log('Saved eval-desktop-05-pgd-detail-7-stages.png');
    }
  }

  // 2. MOBILE VIEWPORT
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mPage = await mobileContext.newPage();
  
  await mPage.goto('http://localhost:2357/pgdcn', { waitUntil: 'networkidle' });
  await mPage.locator('input[type="text"]').fill('luongxuanhung');
  await mPage.locator('input[type="password"]').fill('Abc123456');
  await mPage.locator('button:has-text("Đăng nhập hệ thống")').click();
  await mPage.waitForTimeout(3000);
  await mPage.screenshot({ path: 'eval-mobile-01-dashboard.png', fullPage: true });
  console.log('Saved eval-mobile-01-dashboard.png');

  await mPage.goto('http://localhost:2357/pgdcn/pcn', { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(3000);
  await mPage.screenshot({ path: 'eval-mobile-02-pcn-queue.png', fullPage: true });
  console.log('Saved eval-mobile-02-pcn-queue.png');

  await mPage.goto('http://localhost:2357/pgdcn/pcn/dossiers/standard-dossier-qc4-dn-qc4-0583', { waitUntil: 'networkidle' });
  await mPage.waitForTimeout(3000);
  await mPage.screenshot({ path: 'eval-mobile-03-pcn-detail.png', fullPage: true });
  console.log('Saved eval-mobile-03-pcn-detail.png');

  await browser.close();
  console.log('Superneat UI/UX Browser Evaluation Completed!');
}

evaluateSuperneatUI().catch(e => {
  console.error(e);
  process.exit(1);
});
