import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '../app/api/pgdcn/drafting-ai/route.ts';
import { getSessionSecret } from '../lib/server/auth.ts';
import { createPcnSessionToken } from '../utils/pcnAuth.ts';

type Equal<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual] ? true : false
  : false;
type Assert<T extends true> = T;
type DraftingAiPostAcceptsNextRequest = Assert<Equal<Parameters<typeof POST>[0], NextRequest>>;

function request(body: unknown, scopes: Array<'PCN' | 'PGD'> = ['PCN']): NextRequest {
  const token = createPcnSessionToken({
    username: 'drafting-test',
    name: 'Drafting Test',
    role: 'staff',
    systemRole: 'staff',
    active: true,
    departmentScopes: scopes,
  } as any, getSessionSecret());

  return new NextRequest('http://localhost/api/pgdcn/drafting-ai', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `pcn_certification_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

const baseInput = {
  domain: 'PCN',
  mode: 'PROOFREAD',
  templateCode: 'FORM-01',
  fieldKey: 'description',
  fieldLabel: 'Description',
  originalText: 'This is a draft description.',
};

test('drafting AI requires an authenticated PCN session before reading the request body', async () => {
  let bodyAccessed = false;
  const req = {
    headers: new Headers(),
    get body() {
      bodyAccessed = true;
      return null;
    },
  } as unknown as NextRequest;

  const response = await POST(req);

  assert.equal(response.status, 401);
  assert.equal(bodyAccessed, false);
});

test('drafting AI rejects PGD requests from a PCN-only user', async () => {
  const response = await POST(request({ ...baseInput, domain: 'PGD' }));

  assert.equal(response.status, 403);
});

test('drafting AI rejects PCN requests from a PGD-only user', async () => {
  const response = await POST(request({ ...baseInput }, ['PGD']));

  assert.equal(response.status, 403);
});

test('drafting AI rejects unknown modes with a clear 400 response', async () => {
  const response = await POST(request({ ...baseInput, mode: 'TRANSLATE' }));

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /mode|chế độ|không hợp lệ/i);
});

test('drafting AI returns a warning and no rewrite for decision fields', async () => {
  const response = await POST(request({
    ...baseInput,
    fieldKey: 'approvalDecision',
    fieldLabel: 'Approval decision',
    originalText: 'Approved.',
  }));

  assert.equal(response.status, 200);
  const output = await response.json();
  assert.equal(output.suggestedText, null);
  assert.equal(output.applied, false);
  assert.equal(typeof output.explanation, 'string');
  assert.ok(output.warnings.length > 0);
});

test('drafting AI rejects text that exceeds the field limit', async () => {
  const response = await POST(request({ ...baseInput, originalText: 'x'.repeat(6001) }));

  assert.equal(response.status, 400);
});

test('drafting AI never echoes a credential-like value supplied in text', async () => {
  const credentialLikeValue = `AIza${'a'.repeat(35)}`;
  const response = await POST(request({ ...baseInput, originalText: `Text ${credentialLikeValue}` }));
  const responseText = await response.text();

  assert.equal(response.status, 400);
  assert.equal(responseText.includes(credentialLikeValue), false);
});
