import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Poem = { id: string; name: string; lines: string[]; created: number; voters: string[] };
const directory = join(process.cwd(), '.data');
const file = join(directory, 'poems.json');
// ponytail: synchronous atomic writes support one Node server; use a database for multiple instances.
export function readPoems(): Poem[] {
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  return [{
    id: 'sample-3',
    name: '바삭바삭',
    lines: ['빼빼로는 나눠 먹으라지만', '빼앗길 수 없는 마지막 한 개', '로딩 중입니다, 양심이'],
    created: 1794355200003,
    voters: [],
  }];
}
export function savePoems(poems: Poem[]) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(poems));
  renameSync(file + '.tmp', file);
}
