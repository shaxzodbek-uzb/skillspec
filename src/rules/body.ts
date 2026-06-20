import type { Rule } from '../types.js';
import { estimateTokens } from '../tokens.js';

export const bodyRules: Rule[] = [
  {
    id: 'body-present',
    description: 'The SKILL.md body (instructions after the frontmatter) must not be empty.',
    defaultSeverity: 'error',
    check(doc, _options, report) {
      // Only meaningful once we have well-formed frontmatter to sit under.
      if (!doc.hasFrontmatter) return;
      if (doc.body.trim() === '') {
        report(
          'The body is empty. After the frontmatter, add the instructions Claude should follow when the skill is loaded.',
          { line: doc.bodyStartLine },
        );
      }
    },
  },
  {
    id: 'body-max-lines',
    description: 'Keep the SKILL.md body under ~500 lines; move detail into linked files.',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      const lines = doc.body.replace(/\n$/, '').split('\n').length;
      if (doc.body.trim() !== '' && lines > options.bodyMaxLines) {
        report(
          `Body is ${lines} lines; Anthropic recommends under ${options.bodyMaxLines}. Split detail into reference files and link them (progressive disclosure).`,
          { line: doc.bodyStartLine },
        );
      }
    },
  },
  {
    id: 'body-token-budget',
    description: 'Keep the SKILL.md body within the ~5,000-token Level-2 budget (approximate).',
    defaultSeverity: 'warning',
    check(doc, options, report) {
      if (doc.body.trim() === '') return;
      const tokens = estimateTokens(doc.body);
      if (tokens > options.bodyTokenBudget) {
        report(
          `Body is ~${tokens} tokens (estimate); the recommended Level-2 budget is ~${options.bodyTokenBudget}. Trim it or move detail into on-demand reference files.`,
          { line: doc.bodyStartLine },
        );
      }
    },
  },
];
