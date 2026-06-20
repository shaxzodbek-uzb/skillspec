import { basename, dirname, resolve } from 'node:path';
import { parseDocument, isMap, isScalar } from 'yaml';
import type { SkillDoc } from './types.js';

const BOM = '﻿';

/** 1-based line number of a character offset within `text`. */
function lineAt(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) line++;
  }
  return line;
}

/**
 * Parse a SKILL.md file (given its raw contents and path) into a {@link SkillDoc}.
 *
 * Pure and synchronous — no filesystem access — so it is trivial to unit-test
 * and to drive from an editor extension with an in-memory buffer.
 */
export function parseSkill(file: string, rawInput: string): SkillDoc {
  const hadBom = rawInput.startsWith(BOM);
  const raw = hadBom ? rawInput.slice(BOM.length) : rawInput;
  const hasCrlf = raw.includes('\r\n');

  const dir = dirname(resolve(file));
  const doc: SkillDoc = {
    file,
    dir,
    dirName: basename(dir),
    raw,
    hadBom,
    hasCrlf,
    hasFrontmatter: false,
    unterminatedFrontmatter: false,
    frontmatterRaw: null,
    data: null,
    yamlError: null,
    body: raw,
    bodyStartLine: 1,
    keyLines: {},
  };

  // Frontmatter must be the very first thing in the file. The opening fence is
  // a line that is exactly `---` (trailing whitespace tolerated).
  const opening = /^---[ \t]*\r?\n/.exec(raw);
  if (!opening) {
    return doc; // no frontmatter at all
  }

  const fmStart = opening[0].length; // offset where frontmatter body begins
  // Closing fence: a line that is exactly `---` or `...`. Group 1 is the
  // preceding newline (or start of string), group 2 the fence, group 3 the
  // trailing newline (or end of string).
  const afterOpen = raw.slice(fmStart);
  const closeMatch = /(^|\n)(---|\.\.\.)[ \t]*(\r?\n|$)/.exec(afterOpen);

  if (!closeMatch) {
    doc.unterminatedFrontmatter = true;
    doc.body = afterOpen;
    doc.bodyStartLine = lineAt(raw, fmStart);
    return doc;
  }

  const leadingNewline = closeMatch[1] ?? '';
  const fmEnd = fmStart + closeMatch.index + leadingNewline.length; // offset of the fence start
  const frontmatterRaw = raw.slice(fmStart, fmEnd).replace(/\r\n/g, '\n');

  // Body starts after the whole closing-fence line (fence + trailing newline).
  const fenceLineLen = closeMatch[0].length - leadingNewline.length;
  const bodyOffset = fmEnd + fenceLineLen;
  const body = raw.slice(bodyOffset);

  doc.hasFrontmatter = true;
  doc.frontmatterRaw = frontmatterRaw;
  doc.body = body;
  doc.bodyStartLine = lineAt(raw, bodyOffset);

  // Parse the YAML. We parse the frontmatter substring on its own, then map
  // offsets back to file lines so reports land on the right line.
  const parsed = parseDocument(frontmatterRaw, { prettyErrors: false });

  if (parsed.errors.length > 0) {
    const err = parsed.errors[0]!;
    const relOffset = err.pos?.[0] ?? 0;
    doc.yamlError = {
      message: err.message.replace(/\s+at line \d+.*$/s, ''),
      line: lineAt(raw, fmStart + relOffset),
    };
    return doc;
  }

  const contents = parsed.contents;
  if (!isMap(contents)) {
    // e.g. frontmatter is a scalar or a list, not a mapping of keys.
    doc.data = {};
    doc.yamlError = {
      message: 'frontmatter must be a YAML mapping of key: value pairs',
      line: lineAt(raw, fmStart),
    };
    return doc;
  }

  const data: Record<string, unknown> = {};
  for (const item of contents.items) {
    const keyNode = item.key;
    if (!isScalar(keyNode)) continue;
    const key = String(keyNode.value);
    data[key] = parsed.toJS({ maxAliasCount: 100 })?.[key];
    const start = keyNode.range?.[0];
    if (typeof start === 'number') {
      doc.keyLines[key] = lineAt(raw, fmStart + start);
    }
  }
  doc.data = data;

  return doc;
}
