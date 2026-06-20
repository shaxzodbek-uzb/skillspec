/**
 * Core types shared across the linter.
 *
 * The data model is deliberately small: a {@link SkillDoc} is a parsed
 * SKILL.md file, a {@link Rule} inspects it and emits {@link Finding}s, and a
 * reporter turns findings into output.
 */

/** How loud a rule is. `'off'` disables it. */
export type Severity = 'error' | 'warning' | 'off';

/** A severity a finding can actually carry (a disabled rule emits nothing). */
export type ActiveSeverity = 'error' | 'warning';

/** A single problem found in a SKILL.md file. */
export interface Finding {
  /** Stable rule identifier, e.g. `"description-length"`. */
  ruleId: string;
  /** Effective severity after config overrides. */
  severity: ActiveSeverity;
  /** Human-readable, one-line explanation. */
  message: string;
  /** Path to the offending file (as discovered — usually relative to cwd). */
  file: string;
  /** 1-based line number, when the rule can pinpoint one. */
  line?: number;
  /** 1-based column number, when known. */
  column?: number;
  /** Optional machine-readable extras (used by the JSON reporter). */
  data?: Record<string, unknown>;
}

/** A SKILL.md file parsed into the pieces every rule needs. */
export interface SkillDoc {
  /** Path as given to the linter (relative to cwd where possible). */
  file: string;
  /** Absolute path to the containing directory. */
  dir: string;
  /** Basename of the containing directory (compared against `name`). */
  dirName: string;
  /** Full file contents, with a leading UTF-8 BOM stripped if present. */
  raw: string;
  /** Whether a leading UTF-8 BOM was found and stripped. */
  hadBom: boolean;
  /** Whether the file uses CRLF (`\r\n`) line endings anywhere. */
  hasCrlf: boolean;
  /** True when a well-formed `---` … `---` frontmatter block was found. */
  hasFrontmatter: boolean;
  /** True when an opening `---` was found but never closed. */
  unterminatedFrontmatter: boolean;
  /** Raw text between the frontmatter fences (null when absent). */
  frontmatterRaw: string | null;
  /** Parsed frontmatter object (null when missing or unparseable). */
  data: Record<string, unknown> | null;
  /** YAML parse error, if the frontmatter failed to parse. */
  yamlError: { message: string; line?: number; column?: number } | null;
  /** Body text after the closing fence (or the whole file if no frontmatter). */
  body: string;
  /** 1-based file line where the body begins. */
  bodyStartLine: number;
  /** Map of top-level frontmatter key → 1-based file line, for precise reports. */
  keyLines: Record<string, number>;
}

/** Report callback handed to a rule; `ruleId`, `severity` and `file` are filled in by the runner. */
export type ReportFn = (
  message: string,
  opts?: { line?: number; column?: number; data?: Record<string, unknown> },
) => void;

/** A single check. Rules are pure: same input → same findings. */
export interface Rule {
  /** Stable, kebab-case identifier used in config and output. */
  id: string;
  /** One-line description shown in `--rules` and the docs table. */
  description: string;
  /** Severity used when config doesn't override it. */
  defaultSeverity: ActiveSeverity;
  /** Inspect a doc and call `report` for every problem. */
  check(doc: SkillDoc, options: ResolvedOptions, report: ReportFn): void;
}

/** Report callback for a set-level rule: names the offending doc explicitly. */
export type SetReportFn = (
  doc: SkillDoc,
  message: string,
  opts?: { line?: number; column?: number; data?: Record<string, unknown> },
) => void;

/** A check that runs once over the whole set of skills (cross-skill concerns). */
export interface SetRule {
  id: string;
  description: string;
  defaultSeverity: ActiveSeverity;
  /** Inspect every doc together and report cross-skill problems. */
  check(docs: SkillDoc[], options: ResolvedOptions, report: SetReportFn): void;
}

/** User-facing configuration (from a config file, package.json, or the API). */
export interface Options {
  /** Per-rule severity overrides. `true`→default, `false`/`'off'`→disabled. */
  rules?: Record<string, Severity | boolean>;
  /** Max characters allowed in `name`. Default 64. */
  nameMaxLength?: number;
  /** Max characters allowed in `description`. Default 1024. */
  descriptionMaxLength?: number;
  /** Below this, `description` is flagged as too thin to trigger on. Default 20. */
  descriptionMinLength?: number;
  /** Max characters allowed in `compatibility`. Default 500. */
  compatibilityMaxLength?: number;
  /** Soft cap on SKILL.md body lines before suggesting progressive disclosure. Default 500. */
  bodyMaxLines?: number;
  /** Approximate token budget for the SKILL.md body. Default 5000. */
  bodyTokenBudget?: number;
  /** Extra frontmatter keys to treat as known (silences `unknown-frontmatter-key`). */
  knownKeys?: string[];
  /** Glob-like path fragments to skip during discovery. */
  ignore?: string[];
}

/** Options with every field resolved to a concrete value. */
export interface ResolvedOptions {
  severities: Record<string, Severity>;
  nameMaxLength: number;
  descriptionMaxLength: number;
  descriptionMinLength: number;
  compatibilityMaxLength: number;
  bodyMaxLines: number;
  bodyTokenBudget: number;
  knownKeys: string[];
  ignore: string[];
  /** Which spec preset this run is checking against. */
  preset: 'claude-code' | 'standard';
}

/** Aggregate outcome for one lint run. */
export interface LintResult {
  findings: Finding[];
  /** Number of SKILL.md files inspected. */
  fileCount: number;
  errorCount: number;
  warningCount: number;
}
