import assert from 'node:assert/strict';
import test from 'node:test';

import { POST } from '../app/api/generate-docx/route.ts';

test('DOCX generation rejects requests without a PCN session before parsing the body', async () => {
  let bodyParsed = false;
  const request = {
    headers: new Headers(),
    json: async () => {
      bodyParsed = true;
      return {};
    },
  } as any;

  const response = await POST(request);

  assert.equal(response.status, 401);
  assert.equal(bodyParsed, false);
});
