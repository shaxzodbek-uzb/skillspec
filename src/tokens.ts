/**
 * Approximate token counting.
 *
 * skillspec runs offline in CI, so it can't call Anthropic's tokenizer. The
 * estimate below is intentionally conservative and is only used for *advisory*
 * budget warnings (the body's ~5k-token Level-2 budget). The authoritative
 * checks — `name` ≤ 64 chars, `description` ≤ 1024 chars — are exact character
 * counts and never rely on this.
 *
 * Heuristic: blends a chars/4 estimate (Anthropic's own rule of thumb for
 * English) with a word-count estimate, taking the larger so code- and
 * punctuation-heavy bodies aren't undercounted.
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  const chars = [...text].length; // code points, not UTF-16 units
  const words = text.match(/\S+/g)?.length ?? 0;
  const byChars = Math.ceil(chars / 4);
  const byWords = Math.ceil(words * 1.3);
  return Math.max(byChars, byWords);
}

/** Count Unicode code points (so emoji / non-BMP chars count as 1, like the spec's char limits). */
export function charLength(text: string): number {
  return [...text].length;
}
