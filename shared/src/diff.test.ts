import { describe, expect, it } from 'vitest';
import { diffLines } from './diff';

describe('diffLines', () => {
  it('相同行保留双侧行号', () => {
    expect(diffLines('A', 'A')).toEqual([{ kind: 'equal', text: 'A', oldLine: 1, newLine: 1 }]);
    expect(diffLines('', '')).toEqual([]);
  });
  it('替换行先删除后新增，并保留上下文', () => {
    const rows = diffLines('A\nB\nC', 'A\nD\nC');
    expect(rows.map((r) => r.kind)).toEqual(['equal', 'remove', 'add', 'equal']);
    expect(rows[3]).toMatchObject({ oldLine: 3, newLine: 3 });
  });
  it('处理新增、删除、重复行、中文及换行', () => {
    for (const [a, b] of [
      ['', '新增'],
      ['删除', ''],
      ['A\nA\nB', 'A\nB\nB'],
      ['甲\r\n乙\n', '甲\n丙'],
    ]) {
      const rows = diffLines(a, b);
      expect(
        rows
          .filter((r) => r.kind !== 'add')
          .map((r) => r.text)
          .join('\n'),
      ).toBe(a.replace(/\r\n/g, '\n'));
      expect(
        rows
          .filter((r) => r.kind !== 'remove')
          .map((r) => r.text)
          .join('\n'),
      ).toBe(b);
    }
  });
  it('大文档降级仍保留完整内容', () => {
    const a = Array.from({ length: 1100 }, (_, i) => `旧${i}`).join('\n');
    const b = Array.from({ length: 1100 }, (_, i) => `新${i}`).join('\n');
    expect(diffLines(a, b)).toHaveLength(2200);
  });
});
