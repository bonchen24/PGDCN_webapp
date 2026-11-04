import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium, expect, type Page } from '@playwright/test';

let bundle: string;
async function withPicker(run: (page: Page) => Promise<void>, props = {}) {
  assert.ok(fs.existsSync('components/DossierOwnerAssignmentPicker.tsx'), 'confirmed owner picker must exist');
  bundle ||= (await build({
    stdin: {
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import Picker from './components/DossierOwnerAssignmentPicker';
        window.mount = (props) => {
          window.calls = [];
          createRoot(document.getElementById('fixture')).render(React.createElement(Picker, {
            options: [{username:'dang', displayName:'Đặng Ánh'}, {username:'binh', displayName:'Bình Nguyễn'}],
            ownerUsername: '', ownerDisplayName: '', canAssign:true, compact:true,
            onAssign: username => { window.calls.push(username); return new Promise((resolve,reject) => {
              window.resolveAssign = resolve; window.rejectAssign = () => reject(new Error('Không thể lưu phân công'));
            }); }, ...props
          }));
        };`,
      resolveDir: process.cwd(), loader: 'tsx',
    }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  })).outputFiles[0].text;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
    // Preserve the production positioning utilities without running a Next server.
    // Otherwise collapsing the listbox on pointerdown moves the cancel button
    // between pointerdown and click, which cannot occur with its absolute layout.
    await page.setContent(`<style>
      .relative { position:relative } .absolute { position:absolute } .fixed { position:fixed }
      [role=dialog] { top:80px;left:16px;width:350px;background:white }
      [role=listbox] { top:100%;left:0;right:0;background:white;z-index:50;max-height:224px;overflow:auto }
      form > div:first-child { min-height:280px }
    </style><div id="fixture" style="height:32px;overflow:hidden"></div><button id="outside">Ngoài</button>`);
    await page.addScriptTag({ content: bundle });
    await page.evaluate((value) => (window as any).mount(value), props);
    await run(page);
  } finally { await browser.close(); }
}

test('unassigned manager has an explicit CTA; dialog is portaled, focused and cancel restores focus', async () => {
  await withPicker(async (page) => {
    const trigger = page.getByRole('button', { name: 'Phân công người thực hiện' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Phân công người thực hiện' });
    await expect(dialog).toBeVisible();
    assert.equal(await page.locator('#fixture [role="dialog"]').count(), 0);
    await expect(page.getByRole('combobox', { name: 'Tìm nhân viên' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Xác nhận phân công' })).toBeDisabled();
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert.deepEqual(await page.evaluate(() => (window as any).calls), []);
  });
});

test('assigned owner keeps compact transfer action; unchanged owner cannot be confirmed', async () => {
  await withPicker(async (page) => {
    await expect(page.getByText('Đặng Ánh', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Chuyển người thực hiện' }).click();
    await expect(page.getByRole('button', { name: 'Xác nhận phân công' })).toBeDisabled();
    await page.getByRole('button', { name: 'Hủy' }).click();
  }, { ownerUsername: 'dang', ownerDisplayName: 'Đặng Ánh' });
});

test('read-only and disabled controls cannot start assignment', async () => {
  await withPicker(async (page) => {
    await expect(page.getByText('Chưa gán người thực hiện', { exact: true })).toBeVisible();
    assert.equal(await page.getByRole('button', { name: 'Phân công người thực hiện' }).count(), 0);
  }, { canAssign: false });
  await withPicker(async (page) => {
    await expect(page.getByRole('button', { name: 'Phân công người thực hiện' })).toBeDisabled();
  }, { disabled: true });
});

test('Vietnamese search and keyboard selection only stage assignment until explicit confirmation', async () => {
  await withPicker(async (page) => {
    await page.getByRole('button', { name: 'Phân công người thực hiện' }).click();
    const search = page.getByRole('combobox', { name: 'Tìm nhân viên' });
    await search.fill('dang anh');
    await expect(page.getByRole('option', { name: /Đặng Ánh/ })).toBeVisible();
    assert.equal(await page.getByRole('option', { name: /Bình/ }).count(), 0);
    await search.press('ArrowDown');
    await search.press('Enter');
    assert.deepEqual(await page.evaluate(() => (window as any).calls), []);
    await expect(page.getByRole('button', { name: 'Xác nhận phân công' })).toBeEnabled();
    await page.getByRole('button', { name: 'Xác nhận phân công' }).click();
    assert.deepEqual(await page.evaluate(() => (window as any).calls), ['dang']);
  });
});

test('saving blocks duplicate submissions and dismissal; success closes only after mutation resolves', async () => {
  await withPicker(async (page) => {
    await page.getByRole('button', { name: 'Phân công người thực hiện' }).click();
    await page.getByRole('option', { name: /Đặng Ánh/ }).click();
    await page.getByRole('button', { name: 'Xác nhận phân công' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(page.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Hủy' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    assert.deepEqual(await page.evaluate(() => (window as any).calls), ['dang']);
    await page.evaluate(() => (window as any).resolveAssign());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Đã phân công cho Đặng Ánh');
  });
});

test('failed mutation leaves dialog and selection available with an inline error', async () => {
  await withPicker(async (page) => {
    await page.getByRole('button', { name: 'Phân công người thực hiện' }).click();
    await page.getByRole('option', { name: /Đặng Ánh/ }).click();
    await page.getByRole('button', { name: 'Xác nhận phân công' }).click();
    await page.evaluate(() => (window as any).rejectAssign());
    await expect(page.getByRole('alert')).toHaveText('Không thể lưu phân công');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận phân công' })).toBeEnabled();
    await page.getByRole('button', { name: 'Hủy' }).click();
  });
});
