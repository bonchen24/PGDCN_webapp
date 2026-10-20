import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readRoute = (relativePath: string) => {
  const url = new URL(`../${relativePath}`, import.meta.url);
  assert.equal(fs.existsSync(url), true, `Next.js App Router handler must exist: ${relativePath}`);
  return fs.readFileSync(url, 'utf8');
};

test('Next.js App Router exposes database health without credentials', () => {
  const health = readRoute('app/api/db/health/route.ts');

  assert.match(health, /export async function GET\(\)/);
  assert.match(health, /pool\.query\('SELECT current_database\(\) AS database_name'\)/);
  assert.match(health, /profile,/);
  assert.match(health, /databaseName:\s*result\.rows\[0\]\?\.database_name\s*\|\|\s*null/);
  assert.doesNotMatch(health, /POSTGRES_PASSWORD|password\s*:/i);
});

test('PCN App Router session handler enforces authentication and protected cookies', () => {
  const session = readRoute('app/api/auth/pcn-session/route.ts');

  assert.match(session, /export async function GET\(request: NextRequest\)/);
  assert.match(session, /const user = getSessionUser\(request\)/);
  assert.match(session, /if \(!user\)\s*\{\s*return jsonUnauthorized/);
  assert.match(session, /export async function POST\(request: NextRequest\)/);
  assert.match(session, /authenticatePcnUser\(username, password\)/);
  assert.match(session, /response\.cookies\.set\(\{\s*name: PCN_SESSION_COOKIE,[\s\S]*?httpOnly: true,[\s\S]*?sameSite: 'lax',[\s\S]*?secure: isSecure/);
  assert.match(session, /export async function DELETE\(\)/);
  assert.match(session, /maxAge: 0/);
});
