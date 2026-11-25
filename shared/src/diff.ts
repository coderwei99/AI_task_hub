export interface DiffLine {
  kind: 'equal' | 'remove' | 'add';
  text: string;
  oldLine?: number;
  newLine?: number;
}

/** Line-based LCS with bounded memory for large documents. */
export function diffLines(before: string, after: string): DiffLine[] {
  const split = (text: string) => text === '' ? [] : text.replace(/\r\n/g, '\n').split('\n');
  const a = split(before), b = split(after);
  let start = 0, end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (end < a.length - start && end < b.length - start && a[a.length - end - 1] === b[b.length - end - 1]) end++;
  const rows: DiffLine[] = [];
  let oldLine = 1, newLine = 1;
  const emit = (kind: DiffLine['kind'], text: string) => rows.push({ kind, text,
    oldLine: kind === 'add' ? undefined : oldLine++, newLine: kind === 'remove' ? undefined : newLine++ });
  for (let i = 0; i < start; i++) emit('equal', a[i]);
  const x = a.slice(start, a.length - end), y = b.slice(start, b.length - end);
  if ((x.length + 1) * (y.length + 1) > 1_000_000) {
    // Avoid quadratic allocation and UI stalls; preserve exact content in a coarse diff.
    x.forEach((line) => emit('remove', line));
    y.forEach((line) => emit('add', line));
  } else {
    const table = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
    for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--)
      table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) { emit('equal', x[i++]); j++; }
      else if (i < x.length && (j === y.length || table[i + 1][j] >= table[i][j + 1])) emit('remove', x[i++]);
      else emit('add', y[j++]);
    }
  }
  for (let i = a.length - end; i < a.length; i++) emit('equal', a[i]);
  return rows;
}
