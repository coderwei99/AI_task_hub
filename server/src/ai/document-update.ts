import { REQUIREMENT_DOC_MAX_LENGTH, SECTION_TITLES } from '@ai-task-hub/shared';

export const DOCUMENT_UNCHANGED = '===DOCUMENT_UNCHANGED===';
export const SECTION_UPDATES = '===SECTION_UPDATES===';

export function findDocumentSections(document: string) {
  // Only patch documents whose headings have unambiguous boundaries.
  const headings = [
    ...document.matchAll(/^ {0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|={2,}[ \t]*$|-{2,}[ \t]*$).*$/gm),
  ];
  if (
    headings.length !== SECTION_TITLES.length ||
    !headings.every((heading, index) => heading[0].trimEnd() === `## ${SECTION_TITLES[index]}`)
  ) {
    return null;
  }
  return headings.map((heading, index) => ({
    title: SECTION_TITLES[index],
    start: heading.index + heading[0].length,
    end: headings[index + 1]?.index ?? document.length,
  }));
}

export function applySectionUpdates(document: string, json: string): string | null {
  const sections = findDocumentSections(document);
  if (!sections) return null;

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > sections.length) return null;

  const updates = new Map<string, string>();
  for (const update of value) {
    if (!update || typeof update.title !== 'string' || typeof update.body !== 'string') return null;
    if (updates.has(update.title) || !sections.some(({ title }) => title === update.title))
      return null;
    const body = update.body.trim();
    if (!body || /^ {0,3}(?:#{1,6}(?:[ \t]|$)|`{3,}|~{3,}|={2,}[ \t]*$|-{2,}[ \t]*$)/m.test(body)) {
      return null;
    }
    updates.set(update.title, body);
  }

  let merged = document;
  for (const { title, start, end } of [...sections].reverse()) {
    const body = updates.get(title);
    const original = document.slice(start, end);
    if (body === undefined || original.trim() === body) continue;
    const leading = original.match(/^\s*/)?.[0] ?? '';
    const trailing = original.slice(leading.length).match(/\s*$/)?.[0] ?? '';
    merged =
      merged.slice(0, start) +
      (leading || '\n') +
      body +
      (trailing || (end < document.length ? '\n\n' : '')) +
      merged.slice(end);
  }
  return merged.length <= REQUIREMENT_DOC_MAX_LENGTH && findDocumentSections(merged)
    ? merged
    : null;
}
