import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const dossier = read('components/PcnDossierDetailView.tsx');
const handover = read('components/PcnSampleHandoverModal.tsx');
const bundle = read('components/PcnSampleRequestBundleModal.tsx');
const personalSettings = read('components/PcnPersonalSettingsPanel.tsx');

test('PCN business surfaces give every descendant control a visible keyboard focus ring', () => {
  const roots = [
    dossier.match(/<div data-testid="pcn-dossier-focus-shell"[^>]*>/)?.[0],
    handover.match(/<section className="[^"]*" role="dialog"[^>]*>/)?.[0],
    bundle.match(/<div className="[^"]*" role="dialog"[^>]*>/)?.[0],
    personalSettings.match(/<section className="[^"]*" role="dialog"[^>]*>/)?.[0],
  ];

  assert.ok(roots.filter(Boolean).length === 4, 'all four PCN surfaces should expose their interactive root');
  assert.ok(roots[0]?.includes("role={standalone ? undefined : 'dialog'}"), 'modal dossier detail keeps dialog semantics');
  assert.ok(roots[0]?.includes('aria-modal={standalone ? undefined : true}'), 'modal dossier detail exposes modal state');
  assert.ok(roots[0]?.includes("aria-labelledby={standalone ? undefined : 'pcn-dossier-detail-title'}"), 'modal dossier detail names its visible title');
  for (const [index, root] of roots.entries()) {
    assert.ok(root?.includes('[&_*:focus-visible]:ring-2'), `surface ${index + 1} needs a descendant focus-visible ring`);
    assert.ok(root?.includes('[&_*:focus-visible]:ring-offset-2'), `surface ${index + 1} needs focus separation from its background`);
  }
});

test('PCN business dialogs preserve labels and keep long content between fixed header and footer', () => {
  for (const source of [handover, bundle, personalSettings]) {
    assert.ok(/role="dialog"/.test(source), 'each PCN business modal keeps dialog semantics');
    assert.ok(/aria-modal="true"/.test(source), 'each PCN business modal is modal');
    assert.ok(/aria-labelledby=/.test(source), 'each PCN business modal has an associated title');
  }

  assert.ok(/<main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto/.test(handover), 'handover body scrolls independently');
  assert.ok(/<header className="[^"]*shrink-0/.test(handover), 'handover header stays visible');
  assert.ok(/<footer className="[^"]*shrink-0/.test(handover), 'handover footer stays visible');
  assert.ok(/<div className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto/.test(bundle), 'bundle body scrolls independently');
  assert.ok(/<div className="[^"]*shrink-0[^"]*border-t border-slate-200 bg-slate-50/.test(bundle), 'bundle footer stays visible');
  assert.ok(/<main className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto/.test(personalSettings), 'settings body scrolls independently');
  const settingsBodyEnd = personalSettings.indexOf('</main>');
  const settingsFooter = personalSettings.indexOf('<footer className="mt-4 flex shrink-0');
  assert.ok(settingsBodyEnd >= 0 && settingsFooter > settingsBodyEnd, 'settings footer stays outside its scroll body');
});

test('PYC sample table keeps its local horizontal-scroll contract and busy state', () => {
  assert.ok(/data-testid="sample-request-bundle-lines" className="mobile-scroll-x[^\"]*overflow-x-auto/.test(bundle), 'sample table keeps local horizontal scrolling');
  assert.ok(/<table className="min-w-\[1380px\]/.test(bundle), 'sample table remains wider than its scroll viewport');
  assert.ok(/aria-busy={isSubmitting}/.test(bundle), 'bundle dialog keeps busy state');
  assert.ok(bundle.includes('mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-current'), 'PYC dispatch retry remains a 44px mobile action');
  assert.ok(dossier.includes('mobile-touch-target min-h-11 rounded-md bg-emerald-600 px-3 py-2'), 'dossier milestone save remains a 44px mobile action');
});


test('decision labels and validation feedback use readable compact type', () => {
  assert.ok(handover.includes('text-[11px] font-black uppercase tracking-wide text-slate-600'), 'handover field labels use at least 11px');
  assert.ok(/role="alert" className="mt-2 text-\[11px\] font-bold text-rose-700/.test(personalSettings), 'settings errors use at least 11px');
  assert.ok(/data-testid="mapping-line-issue"[^>]*text-\[11px\]/.test(bundle), 'PYC row validation uses at least 11px');
  assert.ok(!/text-\[(?:8|9|10)px\]/.test(dossier), 'dossier decision copy no longer uses 8–10px type');
});
