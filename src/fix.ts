/**
 * Mechanical auto-fixes. Each corresponds to a fixable rule and operates on the
 * original file text (BOM included), so fixes are applied to fresh bytes from
 * disk, not the BOM-stripped parse buffer.
 */
export function applyFixes(original: string, firedRuleIds: Set<string>): string {
  let out = original;
  if (firedRuleIds.has('no-bom') && out.startsWith('﻿')) {
    out = out.slice(1);
  }
  if (firedRuleIds.has('line-endings')) {
    out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }
  if (firedRuleIds.has('final-newline')) {
    out = out.replace(/\n*$/, '') + '\n';
  }
  return out;
}
