/**
 * The Anthropic Agent Skills spec, encoded as data.
 *
 * This is skillspec's reason to exist: a single, version-tracked place that
 * mirrors what Anthropic actually publishes for SKILL.md. When Anthropic
 * changes the spec, this file changes and the linter follows.
 *
 * Sources (verified {@link SPEC_VERIFIED}):
 *  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
 *  - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
 *  - https://code.claude.com/docs/en/skills
 *  - https://agentskills.io/specification
 *  - https://github.com/anthropics/skills
 */

/** The date the encoded constraints were last verified against the sources. */
export const SPEC_VERIFIED = '2026-06-20';

/** Hard limits straight from Anthropic / the Agent Skills open standard. */
export const LIMITS = {
  /** `name`: 1–64 characters. */
  nameMaxLength: 64,
  /** `description`: 1–1024 characters (counted as Unicode code points). */
  descriptionMaxLength: 1024,
  /** `compatibility`: 1–500 characters when present. */
  compatibilityMaxLength: 500,
  /** Recommended SKILL.md body cap: "under 500 lines". */
  bodyMaxLines: 500,
  /** Recommended Level-2 body budget: "under ~5,000 tokens". */
  bodyTokenBudget: 5000,
} as const;

/**
 * Valid `name`: lowercase letters, digits and single hyphens; no leading,
 * trailing, or consecutive hyphens. (Matches the open-standard charset and
 * the Claude API validator.)
 */
export const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Words the Claude API forbids inside a skill `name`. */
export const RESERVED_NAME_WORDS = ['anthropic', 'claude'] as const;

/** A `<…>` XML/HTML tag — disallowed by the Claude API in `name`/`description`. */
export const XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;

/** Frontmatter keys defined by the agentskills.io open standard. */
export const OPEN_STANDARD_KEYS = [
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
] as const;

/** Additional frontmatter keys understood by Claude Code. */
export const CLAUDE_CODE_KEYS = [
  ...OPEN_STANDARD_KEYS,
  'when_to_use',
  'disable-model-invocation',
  'user-invocable',
  'disallowed-tools',
  'model',
  'effort',
  'context',
  'agent',
  'argument-hint',
  'arguments',
  'hooks',
  'paths',
  'shell',
] as const;

/** Common misspellings → the correct key, used for "did you mean" hints. */
export const KEY_TYPOS: Record<string, string> = {
  allowed_tools: 'allowed-tools',
  allowedtools: 'allowed-tools',
  'allow-tools': 'allowed-tools',
  tools: 'allowed-tools',
  disallowed_tools: 'disallowed-tools',
  'disallow-tools': 'disallowed-tools',
  when_to_use_when: 'when_to_use',
  'when-to-use': 'when_to_use',
  whentouse: 'when_to_use',
  argument_hint: 'argument-hint',
  argumenthint: 'argument-hint',
  user_invocable: 'user-invocable',
  disable_model_invocation: 'disable-model-invocation',
  desc: 'description',
  summary: 'description',
  title: 'name',
};

/** Which standard a run is checking against. */
export type Preset = 'claude-code' | 'standard';

export interface PresetConfig {
  /** Frontmatter keys treated as recognized (others trip `unknown-frontmatter-key`). */
  knownKeys: readonly string[];
  /** Per-rule severity overrides applied on top of each rule's default. */
  severities: Record<string, 'error' | 'warning' | 'off'>;
}

/**
 * Presets tune how strict the run is.
 *  - `standard`: the agentskills.io open standard — `name` is required.
 *  - `claude-code` (default): Claude Code's superset — `name` is optional
 *    (it defaults to the directory name), so a missing `name` is a nudge,
 *    not an error, and the extra Claude Code keys are recognized.
 */
export const PRESETS: Record<Preset, PresetConfig> = {
  'claude-code': {
    knownKeys: CLAUDE_CODE_KEYS,
    severities: { 'name-required': 'warning' },
  },
  standard: {
    knownKeys: OPEN_STANDARD_KEYS,
    severities: {},
  },
};

/** The default preset when none is given. */
export const DEFAULT_PRESET: Preset = 'claude-code';
