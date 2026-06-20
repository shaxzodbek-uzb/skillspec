import { basename } from 'node:path';
import type { Rule } from '../types.js';

/** Structural and encoding rules — the file shell around the frontmatter. */
export const frontmatterRules: Rule[] = [
  {
    id: 'frontmatter-present',
    description: 'SKILL.md must open with a `---` … `---` YAML frontmatter block.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.hasFrontmatter) return;
      if (doc.unterminatedFrontmatter) {
        report(
          'Frontmatter is opened with `---` but never closed. Add a closing `---` on its own line.',
          { line: 1 },
        );
        return;
      }
      report(
        'No YAML frontmatter found. A skill must begin with a `---` block declaring at least `name` and `description`.',
        { line: 1 },
      );
    },
  },
  {
    id: 'frontmatter-valid',
    description: 'The frontmatter must be a YAML mapping that parses without errors.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (!doc.hasFrontmatter || !doc.yamlError) return;
      report(`Frontmatter is not valid YAML: ${doc.yamlError.message}`, {
        line: doc.yamlError.line ?? 1,
        column: doc.yamlError.column,
      });
    },
  },
  {
    id: 'filename',
    description: 'The skill file must be named exactly `SKILL.md` (uppercase).',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      const name = basename(doc.file);
      if (name === 'SKILL.md') return;
      if (name.toLowerCase() === 'skill.md') {
        report(`Skill file must be named "SKILL.md", found "${name}".`, { line: 1 });
      }
    },
  },
  {
    id: 'no-bom',
    description: 'The file must not start with a UTF-8 byte-order mark.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.hadBom) {
        report(
          'File starts with a UTF-8 BOM, which pushes the opening `---` off byte 0 and breaks frontmatter detection in some tools. (fixable: --fix)',
          { line: 1 },
        );
      }
    },
  },
  {
    id: 'line-endings',
    description: 'Prefer LF line endings over CRLF.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.hasCrlf) {
        report('File uses CRLF line endings; prefer LF. (fixable: --fix)', { line: 1 });
      }
    },
  },
  {
    id: 'final-newline',
    description: 'The file should end with a single trailing newline.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.raw.length > 0 && !doc.raw.endsWith('\n')) {
        report('Missing final newline at end of file. (fixable: --fix)');
      }
    },
  },
];

/** Rule IDs whose findings can be auto-fixed by rewriting the file. */
export const FIXABLE_RULES = ['no-bom', 'line-endings', 'final-newline'] as const;
