/**
 * skillspec — lint Claude Agent SKILL.md files against Anthropic's spec.
 *
 * Public, stable API. The CLI (`skillspec`) and the GitHub Action are thin
 * wrappers over these functions; you can embed them in an editor extension,
 * a pre-commit hook, or your own tooling just as easily.
 */
export { lintFiles, lintText, lintDoc, lintSet, compareFindings } from './lint.js';
export { parseSkill } from './parse.js';
export { resolveOptions, DEFAULT_IGNORE, type ResolveInput } from './options.js';
export { loadConfig, type SkillspecConfig, type LoadedConfig } from './config.js';
export { discoverSkillFiles, type DiscoverResult } from './discover.js';
export { applyFixes } from './fix.js';
export {
  createWatcher,
  watchRoots,
  isRelevantChange,
  createDebouncer,
  type Watcher,
} from './watch.js';
export { RULES, SET_RULES, RULE_META, FIXABLE_RULES } from './rules/index.js';
export {
  formatResult,
  githubSummary,
  FORMATS,
  type Format,
  type ReportOptions,
} from './reporters/index.js';
export { estimateTokens, charLength } from './tokens.js';
export { VERSION } from './version.js';
export {
  LIMITS,
  PRESETS,
  DEFAULT_PRESET,
  SPEC_VERIFIED,
  NAME_PATTERN,
  OPEN_STANDARD_KEYS,
  CLAUDE_CODE_KEYS,
  type Preset,
} from './spec.js';

export type {
  Finding,
  Severity,
  ActiveSeverity,
  SkillDoc,
  Rule,
  SetRule,
  Options,
  ResolvedOptions,
  LintResult,
  ReportFn,
  SetReportFn,
} from './types.js';
