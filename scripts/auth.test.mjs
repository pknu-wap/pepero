import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const previous = process.cwd();
const temporary = mkdtempSync(join(tmpdir(), 'pepero-auth-'));
process.chdir(temporary);
try {
  const { createSession, readSession, deleteSession } = await import('../lib/auth.ts');
  const user = { id: '12345', name: '테스트' };
  const token = createSession(user);
  assert.deepEqual(readSession(token), user);
  assert.equal(readSession('../test'), null);
  assert.equal(readSession('a'.repeat(64)), null);
  const folder = join(temporary, '.data/sessions');
  const file = join(folder, readdirSync(folder)[0]);
  assert.ok(!file.includes(token));
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  saved.expires = Date.now() - 1;
  writeFileSync(file, JSON.stringify(saved));
  assert.equal(readSession(token), null);
  const fresh = createSession(user);
  deleteSession(fresh);
  assert.equal(readSession(fresh), null);
  console.log('PASS: opaque sessions, invalid tokens, expiration, logout revocation');
} finally {
  process.chdir(previous);
  rmSync(temporary, { recursive: true, force: true });
}
