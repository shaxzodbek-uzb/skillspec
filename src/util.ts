/** Coerce a frontmatter value to a string, or null if absent / not scalar. */
export function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/** Normalize text for fuzzy comparison: lowercase, collapse whitespace, strip punctuation. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard similarity over the unique word sets of two strings (0–1). */
export function wordJaccard(a: string, b: string): number {
  const sa = new Set(normalizeText(a).split(' ').filter(Boolean));
  const sb = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}
