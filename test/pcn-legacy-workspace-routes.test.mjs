import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.mjs';

test('Next.js config contains temporary 307 redirects for legacy dossier workspace routes', async () => {
  assert.equal(typeof nextConfig.redirects, 'function', 'nextConfig must define redirects function');
  const redirects = await nextConfig.redirects();

  const legacyRedirects = redirects.filter(({ source }) => source.endsWith('/dossiers'));

  assert.deepEqual(legacyRedirects, [
    {
      source: '/pcn/dossiers',
      destination: '/pcn',
      permanent: false,
    },
    {
      source: '/pgd/dossiers',
      destination: '/pgd',
      permanent: false,
    },
  ]);
});
