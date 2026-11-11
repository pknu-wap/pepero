import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export type User = { id: string; name: string };
export const SESSION_COOKIE = 'pepero-session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
const directory = join(process.cwd(), '.data', 'sessions');
function sessionPath(token: string) {
  return join(directory, createHash('sha256').update(token).digest('hex') + '.json');
}
export function createSession(user: User) {
  const token = randomBytes(32).toString('hex');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(sessionPath(token), JSON.stringify({ version: 2, user, expires: Date.now() + SESSION_SECONDS * 1000 }), { mode: 0o600 });
  return token;
}
export function readSession(token?: string): User | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const session = JSON.parse(readFileSync(sessionPath(token), 'utf8'));
    if (session.version !== 2 || typeof session.expires !== 'number' || session.expires <= Date.now()) {
      deleteSession(token);
      return null;
    }
    if (typeof session.user?.id !== 'string' || typeof session.user?.name !== 'string') return null;
    return session.user;
  } catch { return null; }
}
export function deleteSession(token?: string) {
  if (token && /^[a-f0-9]{64}$/.test(token)) rmSync(sessionPath(token), { force: true });
}
