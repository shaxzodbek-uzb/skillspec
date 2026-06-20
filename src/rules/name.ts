import type { Rule } from '../types.js';
import { NAME_PATTERN, RESERVED_NAME_WORDS, XML_TAG_PATTERN } from '../spec.js';
import { charLength } from '../tokens.js';
import { asString } from '../util.js';

export const nameRules: Rule[] = [
  {
    id: 'name-required',
    description:
      '`name` should be present (required by the Agent Skills standard and the Claude API).',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data['name']);
      if (name === null || name.trim() === '') {
        report(
          '`name` is missing. It is required by the Agent Skills standard and the Claude API; Claude Code defaults it to the directory name.',
          { line: doc.keyLines['name'] },
        );
      }
    },
  },
  {
    id: 'name-format',
    description:
      '`name` must be lowercase letters, digits and single hyphens (no leading/trailing/double hyphens).',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data['name']);
      if (name === null || name.trim() === '') return;
      if (!NAME_PATTERN.test(name)) {
        report(
          `\`name\` "${name}" must use only lowercase letters, digits and single hyphens, with no leading, trailing, or consecutive hyphens.`,
          { line: doc.keyLines['name'] },
        );
      }
    },
  },
  {
    id: 'name-length',
    description: '`name` must be at most 64 characters.',
    defaultSeverity: 'error',
    check(doc, options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data['name']);
      if (name === null) return;
      const len = charLength(name);
      if (len > options.nameMaxLength) {
        report(`\`name\` is ${len} characters; the maximum is ${options.nameMaxLength}.`, {
          line: doc.keyLines['name'],
        });
      }
    },
  },
  {
    id: 'name-matches-dir',
    description: '`name` must match the parent directory name.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data['name']);
      if (name === null || name.trim() === '') return;
      if (name !== doc.dirName) {
        report(
          `\`name\` "${name}" does not match the parent directory "${doc.dirName}". The spec requires them to be identical.`,
          { line: doc.keyLines['name'] },
        );
      }
    },
  },
  {
    id: 'name-reserved',
    description: '`name` must not contain the reserved words "anthropic" or "claude", or XML tags.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data['name']);
      if (name === null) return;
      const lower = name.toLowerCase();
      for (const word of RESERVED_NAME_WORDS) {
        if (lower.includes(word)) {
          report(
            `\`name\` contains the reserved word "${word}". The Claude API rejects skill names containing "anthropic" or "claude".`,
            { line: doc.keyLines['name'] },
          );
        }
      }
      if (XML_TAG_PATTERN.test(name)) {
        report('`name` must not contain XML/HTML tags.', { line: doc.keyLines['name'] });
      }
    },
  },
];
