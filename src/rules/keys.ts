import type { Rule } from '../types.js';
import { KEY_TYPOS } from '../spec.js';
import { charLength } from '../tokens.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const keyRules: Rule[] = [
  {
    id: 'unknown-frontmatter-key',
    description:
      'Frontmatter keys outside the recognized set are flagged (some clients reject them).',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      if (doc.data == null) return;
      const known = new Set(options.knownKeys);
      for (const key of Object.keys(doc.data)) {
        // `version` is owned by the version-placement rule.
        if (key === 'version' || known.has(key)) continue;
        const suggestion = KEY_TYPOS[key] ?? KEY_TYPOS[key.toLowerCase()];
        const hint = suggestion && known.has(suggestion) ? ` Did you mean "${suggestion}"?` : '';
        report(`Unknown frontmatter key "${key}".${hint}`, { line: doc.keyLines[key] });
      }
    },
  },
  {
    id: 'allowed-tools-format',
    description: '`allowed-tools` must be a space-separated string or a YAML list.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!('allowed-tools' in doc.data)) return;
      const value = doc.data['allowed-tools'];
      const ok =
        typeof value === 'string' ||
        (Array.isArray(value) && value.every((v) => typeof v === 'string'));
      const line = doc.keyLines['allowed-tools'];
      if (!ok) {
        report(
          '`allowed-tools` should be a space-separated string (e.g. "Bash(git:*) Read") or a YAML list of strings.',
          { line },
        );
      } else if (typeof value === 'string' && value.trim() === '') {
        report('`allowed-tools` is empty; remove it or list the tools to pre-approve.', { line });
      } else if (typeof value === 'string' && value.includes(',')) {
        report(
          '`allowed-tools` looks comma-separated; tools must be space-separated (e.g. "Bash(git:*) Read"). Commas become part of the tool name.',
          { line },
        );
      }
    },
  },
  {
    id: 'compatibility-length',
    description: '`compatibility` must be within the spec character limit.',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      if (doc.data == null) return;
      const value = doc.data['compatibility'];
      if (typeof value !== 'string') return;
      const len = charLength(value);
      if (len > options.compatibilityMaxLength) {
        report(
          `\`compatibility\` is ${len} characters; the maximum is ${options.compatibilityMaxLength}.`,
          { line: doc.keyLines['compatibility'] },
        );
      }
    },
  },
  {
    id: 'metadata-type',
    description: '`metadata` must be a mapping of string keys to string values.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!('metadata' in doc.data)) return;
      const value = doc.data['metadata'];
      if (!isPlainObject(value)) {
        report('`metadata` must be a mapping (key: value pairs), not a list or scalar.', {
          line: doc.keyLines['metadata'],
        });
        return;
      }
      for (const [k, v] of Object.entries(value)) {
        if (typeof v !== 'string') {
          const got = v === null ? 'null' : Array.isArray(v) ? 'list' : typeof v;
          report(
            `\`metadata.${k}\` must be a string value (got ${got}); the spec defines metadata as a string-valued mapping. Quote it, e.g. version: "1.0".`,
            { line: doc.keyLines['metadata'] },
          );
        }
      }
    },
  },
  {
    id: 'version-placement',
    description: '`version` is not a top-level field; it belongs under `metadata`.',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!('version' in doc.data)) return;
      report(
        '`version` is not a recognized top-level field. Move it under `metadata` (e.g. `metadata.version: "1.0"`).',
        { line: doc.keyLines['version'] },
      );
    },
  },
];
