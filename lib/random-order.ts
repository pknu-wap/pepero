// Keep existing cards in place; insert newly discovered cards at random positions.
export function randomOrder<T extends { id: string }>(previous: T[], incoming: T[]): T[] {
  const remaining = new Map(incoming.map(item => [item.id, item]));
  const ordered: T[] = [];
  for (const item of previous) {
    const updated = remaining.get(item.id);
    if (updated) {
      ordered.push(updated);
      remaining.delete(item.id);
    }
  }
  for (const item of remaining.values()) {
    ordered.splice(Math.floor(Math.random() * (ordered.length + 1)), 0, item);
  }
  return ordered;
}
