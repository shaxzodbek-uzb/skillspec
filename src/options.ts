import type { Options, ResolvedOptions, Severity } from './types.js';
import { DEFAULT_PRESET, LIMITS, PRESETS, type Preset } from './spec.js';
import { RULE_META } from './rules/index.js';

/** Directory names skipped during discovery unless explicitly targeted. */
export const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  '.next',
  '.turbo',
];

/** Options plus the preset selector (the preset isn't a per-rule override). */
export interface ResolveInput extends Options {
  preset?: Preset;
}

function toSeverity(value: Severity | boolean, fallback: Severity): Severity {
  if (value === true) return fallback;
  if (value === false) return 'off';
  return value;
}

/**
 * Merge, in increasing priority: rule defaults → preset overrides → user config.
 * Produces a fully-concrete {@link ResolvedOptions} the rules can rely on.
 */
export function resolveOptions(input: ResolveInput = {}): ResolvedOptions {
  const preset = input.preset ?? DEFAULT_PRESET;
  const presetCfg = PRESETS[preset];

  const severities: Record<string, Severity> = {};
  for (const meta of RULE_META) severities[meta.id] = meta.defaultSeverity;
  for (const [id, sev] of Object.entries(presetCfg.severities)) severities[id] = sev;
  if (input.rules) {
    for (const [id, value] of Object.entries(input.rules)) {
      severities[id] = toSeverity(value, severities[id] ?? 'warning');
    }
  }

  return {
    severities,
    nameMaxLength: input.nameMaxLength ?? LIMITS.nameMaxLength,
    descriptionMaxLength: input.descriptionMaxLength ?? LIMITS.descriptionMaxLength,
    descriptionMinLength: input.descriptionMinLength ?? 20,
    bodyMaxLines: input.bodyMaxLines ?? LIMITS.bodyMaxLines,
    bodyTokenBudget: input.bodyTokenBudget ?? LIMITS.bodyTokenBudget,
    knownKeys: [...presetCfg.knownKeys, ...(input.knownKeys ?? [])],
    ignore: [...DEFAULT_IGNORE, ...(input.ignore ?? [])],
    preset,
  };
}
