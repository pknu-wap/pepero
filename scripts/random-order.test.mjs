import assert from 'node:assert/strict';
import { randomOrder } from '../lib/random-order.ts';
const originalRandom = Math.random;
try {
  Math.random = () => 0;
  const items = [{ id: 'a', votes: 0 }, { id: 'b', votes: 0 }, { id: 'c', votes: 0 }];
  const ordered = randomOrder([], items);
  assert.deepEqual(ordered.map(p => p.id), ['c', 'b', 'a']);
  const updated = randomOrder(ordered, items.map(p => ({ ...p, votes: 1 })));
  assert.deepEqual(updated.map(p => p.id), ['c', 'b', 'a']);
  assert.ok(updated.every(p => p.votes === 1));
  assert.deepEqual(randomOrder(updated, [{ id: 'b', votes: 2 }, { id: 'd', votes: 0 }]).map(p => p.id), ['d', 'b']);
  assert.deepEqual(randomOrder(updated, []), []);
  assert.deepEqual(items.map(p => p.id), ['a', 'b', 'c']);
  console.log('PASS: random insertion, stable updates, removal, no input mutation');
} finally {
  Math.random = originalRandom;
}
