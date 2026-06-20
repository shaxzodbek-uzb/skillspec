import type { Rule, SetRule } from '../types.js';
import { frontmatterRules, FIXABLE_RULES } from './frontmatter.js';
import { nameRules } from './name.js';
import { descriptionRules } from './description.js';
import { bodyRules } from './body.js';
import { keyRules } from './keys.js';
import { setRules } from './set.js';

/** Per-document rules, in a stable, readable order. */
export const RULES: Rule[] = [
  ...frontmatterRules,
  ...nameRules,
  ...descriptionRules,
  ...bodyRules,
  ...keyRules,
];

/** Cross-skill (set-level) rules. */
export const SET_RULES: SetRule[] = [...setRules];

export { FIXABLE_RULES };

/** Lightweight metadata for every rule (used by `--rules` and the config layer). */
export const RULE_META: {
  id: string;
  description: string;
  defaultSeverity: 'error' | 'warning';
}[] = [...RULES, ...SET_RULES].map((r) => ({
  id: r.id,
  description: r.description,
  defaultSeverity: r.defaultSeverity,
}));
