import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnSidebar from '../components/PgdcnSidebar';
import type { PcnUserAccount } from '../types';

const sidebarMarkup = renderToStaticMarkup(createElement(PgdcnSidebar, {
  currentUser: {
    username: 'reviewer',
    name: 'Nguyễn An',
    role: 'staff',
    departmentScopes: ['PCN'],
    professionalRoleCodes: [],
  } as PcnUserAccount,
  activeTarget: { domain: 'PCN', section: 'operations' },
  collapsed: false,
  mobileOpen: false,
  onToggle: () => undefined,
  onNavigate: () => undefined,
  onCloseMobile: () => undefined,
  onLogout: () => undefined,
}));

function parseOklch(theme: string, token: string): [number, number, number] {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = theme.match(new RegExp(`--color-${escapedToken}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\);`));
  assert.ok(match, `Missing Tailwind OKLCH token: ${token}`);

  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hue = Number(match[3]) * (Math.PI / 180);
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const toSrgb = (linear: number) => {
    const bounded = Math.min(1, Math.max(0, linear));
    return bounded <= 0.0031308 ? 12.92 * bounded : 1.055 * bounded ** (1 / 2.4) - 0.055;
  };

  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linearize = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

test('selected PCN navigation label keeps WCAG AA contrast on the active background', () => {
  const selectedButton = sidebarMarkup.match(/<button(?=[^>]*aria-label="Sổ dữ liệu PCN")(?=[^>]*aria-current="page")[^>]*>/)?.[0] || '';
  assert.match(selectedButton, /bg-emerald-700 text-white/);

  const theme = fs.readFileSync(new URL('../node_modules/tailwindcss/theme.css', import.meta.url), 'utf8');
  const backgroundLuminance = relativeLuminance(parseOklch(theme, 'emerald-700'));
  const whiteLuminance = 1;
  const contrastRatio = (whiteLuminance + 0.05) / (backgroundLuminance + 0.05);

  assert.ok(contrastRatio >= 4.5, `Expected at least 4.5:1 contrast, received ${contrastRatio.toFixed(2)}:1`);
});
