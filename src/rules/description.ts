import type { Rule } from '../types.js';
import { XML_TAG_PATTERN } from '../spec.js';
import { charLength } from '../tokens.js';
import { asString } from '../util.js';

/** Whole-word first/second-person markers that signal a non-third-person voice. */
const PERSON_MARKERS =
  /\b(i'?m|i'?ll|i'?ve|i can|i will|you'?ll|you'?re|you can|you should|let'?s|let me|use me)\b/i;
const BARE_PRONOUNS = /\b(i|we|our|us|my|me|your|you)\b/i;

/** Cues that the description says *when* to use the skill, not only what it does. */
const TRIGGER_CUES =
  /\b(use (this|when|it|for)|when |whenever|trigger|triggers|if the user|for (creating|editing|reading|working|building|generating|analy|converting|processing|handling)|ideal for|helpful when|applies when|invoke|activate)\b/i;

export const descriptionRules: Rule[] = [
  {
    id: 'description-required',
    description: '`description` must be present and non-empty.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null || desc.trim() === '') {
        report(
          '`description` is missing or empty. It is required (1–1024 chars) and is the only thing Claude reads to decide whether to load the skill.',
          { line: doc.keyLines['description'] },
        );
      }
    },
  },
  {
    id: 'description-length',
    description: '`description` must be at most 1024 characters.',
    defaultSeverity: 'error',
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null) return;
      const len = charLength(desc);
      if (len > options.descriptionMaxLength) {
        report(
          `\`description\` is ${len} characters; the maximum is ${options.descriptionMaxLength}. Move detail into the body and keep the description to its trigger.`,
          { line: doc.keyLines['description'] },
        );
      }
    },
  },
  {
    id: 'description-min-length',
    description: '`description` should be substantial enough to trigger reliably.',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null || desc.trim() === '') return;
      const len = charLength(desc.trim());
      if (len < options.descriptionMinLength) {
        report(
          `\`description\` is only ${len} characters — too thin for Claude to match reliably. Say what the skill does and when to use it.`,
          { line: doc.keyLines['description'] },
        );
      }
    },
  },
  {
    id: 'description-trigger',
    description: '`description` should state *when* to use the skill, not only what it does.',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null) return;
      const trimmed = desc.trim();
      // Only nudge once the description is long enough to be worth nudging.
      if (charLength(trimmed) < options.descriptionMinLength) return;
      if (!TRIGGER_CUES.test(trimmed)) {
        report(
          'No trigger cue found in `description`. Add when to use it, e.g. "Use when the user …", so Claude knows when to load the skill.',
          { line: doc.keyLines['description'] },
        );
      }
    },
  },
  {
    id: 'description-third-person',
    description:
      '`description` must be written in the third person (it is injected into the system prompt).',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null) return;
      const m = PERSON_MARKERS.exec(desc) ?? BARE_PRONOUNS.exec(desc);
      if (m) {
        report(
          `\`description\` reads as first/second person ("${m[0]}"). Write it in the third person, e.g. "Extracts …. Use when the user …".`,
          { line: doc.keyLines['description'] },
        );
      }
    },
  },
  {
    id: 'description-no-xml',
    description: '`description` must not contain XML/HTML tags (the Claude API rejects them).',
    defaultSeverity: 'warning',
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data['description']);
      if (desc === null) return;
      if (XML_TAG_PATTERN.test(desc)) {
        report('`description` contains an XML/HTML tag, which the Claude API rejects.', {
          line: doc.keyLines['description'],
        });
      }
    },
  },
];
