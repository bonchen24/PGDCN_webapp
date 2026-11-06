import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const baseUrl = process.env.PGDCN_UX_BASE_URL || process.env.PGDCN_LOGIN_TEST_BASE_URL;

test('TVCI login logo loads as a visible landscape wordmark', {
  skip: baseUrl ? false : 'Set PGDCN_UX_BASE_URL or PGDCN_LOGIN_TEST_BASE_URL to a running PGDCN app',
}, async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const logoResponses = [];

    page.on('response', (response) => {
      if (new URL(response.url()).pathname !== '/tvci_logo.jpg') return;

      logoResponses.push({
        status: response.status(),
        contentType: response.headers()['content-type'] || null,
      });
    });

    const pageResponse = await page.goto(new URL('/login', baseUrl).toString(), {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    assert.equal(pageResponse?.status(), 200, 'The login page should load successfully');

    const logo = page.locator('img[alt="Logo TVCI"]');
    assert.equal(await logo.count(), 1, 'The login page should render one TVCI logo');
    assert.equal(await logo.isVisible(), true, 'The TVCI logo should be visible');

    const dimensions = await logo.evaluate((image) => ({
      complete: image.complete,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }));
    assert.equal(dimensions.complete, true, 'The TVCI logo image should finish loading');
    assert.ok(dimensions.width > 0, 'The TVCI logo should have decoded image data');
    assert.ok(
      dimensions.width > dimensions.height,
      `The login should use the landscape TVCI wordmark; received ${dimensions.width}x${dimensions.height}`,
    );
    assert.deepEqual(logoResponses, [{ status: 200, contentType: 'image/jpeg' }]);
  } finally {
    await browser.close();
  }
});
