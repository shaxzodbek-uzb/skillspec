/**
 * Core types shared across the linter.
 *
 * The data model is deliberately small: a {@link SkillDoc} is a parsed
 * SKILL.md file, a {@link Rule} inspects it and emits {@link Finding}s, and a
 * reporter turns findings into output.
 */
/** How loud a rule is. `'off'` disables it. */
type Severity = 'error' | 'warning' | 'off';
/** A severity a finding can actually carry (a disabled rule emits nothing). */
type ActiveSeverity = 'error' | 'warning';
/** A single problem found in a SKILL.md file. */
interface Finding {
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
interface SkillDoc {
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
    yamlError: {
        message: string;
        line?: number;
        column?: number;
    } | null;
    /** Body text after the closing fence (or the whole file if no frontmatter). */
    body: string;
    /** 1-based file line where the body begins. */
    bodyStartLine: number;
    /** Map of top-level frontmatter key → 1-based file line, for precise reports. */
    keyLines: Record<string, number>;
}
/** Report callback handed to a rule; `ruleId`, `severity` and `file` are filled in by the runner. */
type ReportFn = (message: string, opts?: {
    line?: number;
    column?: number;
    data?: Record<string, unknown>;
}) => void;
/** A single check. Rules are pure: same input → same findings. */
interface Rule {
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
type SetReportFn = (doc: SkillDoc, message: string, opts?: {
    line?: number;
    column?: number;
    data?: Record<string, unknown>;
}) => void;
/** A check that runs once over the whole set of skills (cross-skill concerns). */
interface SetRule {
    id: string;
    description: string;
    defaultSeverity: ActiveSeverity;
    /** Inspect every doc together and report cross-skill problems. */
    check(docs: SkillDoc[], options: ResolvedOptions, report: SetReportFn): void;
}
/** User-facing configuration (from a config file, package.json, or the API). */
interface Options {
    /** Per-rule severity overrides. `true`→default, `false`/`'off'`→disabled. */
    rules?: Record<string, Severity | boolean>;
    /** Max characters allowed in `name`. Default 64. */
    nameMaxLength?: number;
    /** Max characters allowed in `description`. Default 1024. */
    descriptionMaxLength?: number;
    /** Below this, `description` is flagged as too thin to trigger on. Default 20. */
    descriptionMinLength?: number;
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
interface ResolvedOptions {
    severities: Record<string, Severity>;
    nameMaxLength: number;
    descriptionMaxLength: number;
    descriptionMinLength: number;
    bodyMaxLines: number;
    bodyTokenBudget: number;
    knownKeys: string[];
    ignore: string[];
    /** Which spec preset this run is checking against. */
    preset: 'claude-code' | 'standard';
}
/** Aggregate outcome for one lint run. */
interface LintResult {
    findings: Finding[];
    /** Number of SKILL.md files inspected. */
    fileCount: number;
    errorCount: number;
    warningCount: number;
}

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
declare const SPEC_VERIFIED = "2026-06-20";
/** Hard limits straight from Anthropic / the Agent Skills open standard. */
declare const LIMITS: {
    /** `name`: 1–64 characters. */
    readonly nameMaxLength: 64;
    /** `description`: 1–1024 characters (counted as Unicode code points). */
    readonly descriptionMaxLength: 1024;
    /** `compatibility`: 1–500 characters when present. */
    readonly compatibilityMaxLength: 500;
    /** Recommended SKILL.md body cap: "under 500 lines". */
    readonly bodyMaxLines: 500;
    /** Recommended Level-2 body budget: "under ~5,000 tokens". */
    readonly bodyTokenBudget: 5000;
};
/**
 * Valid `name`: lowercase letters, digits and single hyphens; no leading,
 * trailing, or consecutive hyphens. (Matches the open-standard charset and
 * the Claude API validator.)
 */
declare const NAME_PATTERN: RegExp;
/** Frontmatter keys defined by the agentskills.io open standard. */
declare const OPEN_STANDARD_KEYS: readonly ["name", "description", "license", "compatibility", "metadata", "allowed-tools"];
/** Additional frontmatter keys understood by Claude Code. */
declare const CLAUDE_CODE_KEYS: readonly ["name", "description", "license", "compatibility", "metadata", "allowed-tools", "when_to_use", "disable-model-invocation", "user-invocable", "disallowed-tools", "model", "effort", "context", "agent", "argument-hint", "arguments", "hooks", "paths", "shell"];
/** Which standard a run is checking against. */
type Preset = 'claude-code' | 'standard';
interface PresetConfig {
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
declare const PRESETS: Record<Preset, PresetConfig>;
/** The default preset when none is given. */
declare const DEFAULT_PRESET: Preset;

/** Directory names skipped during discovery unless explicitly targeted. */
declare const DEFAULT_IGNORE: string[];
/** Options plus the preset selector (the preset isn't a per-rule override). */
interface ResolveInput extends Options {
    preset?: Preset;
}
/**
 * Merge, in increasing priority: rule defaults → preset overrides → user config.
 * Produces a fully-concrete {@link ResolvedOptions} the rules can rely on.
 */
declare function resolveOptions(input?: ResolveInput): ResolvedOptions;

/** Order findings for display: by file, then line, then errors before warnings. */
declare function compareFindings(a: Finding, b: Finding): number;
/** Run all per-document rules against one parsed doc. */
declare function lintDoc(doc: SkillDoc, options: ResolvedOptions): Finding[];
/** Run all set-level (cross-skill) rules against the full set of docs. */
declare function lintSet(docs: SkillDoc[], options: ResolvedOptions): Finding[];
/** Lint SKILL.md text directly, without touching the filesystem. */
declare function lintText(file: string, raw: string, input?: ResolveInput): Finding[];
/**
 * Discover and lint SKILL.md files on disk. Reads each file, parses it, runs the
 * per-document rules, then the set-level rules across everything found.
 */
declare function lintFiles(paths: string[], input?: ResolveInput): LintResult;

/**
 * Parse a SKILL.md file (given its raw contents and path) into a {@link SkillDoc}.
 *
 * Pure and synchronous — no filesystem access — so it is trivial to unit-test
 * and to drive from an editor extension with an in-memory buffer.
 */
declare function parseSkill(file: string, rawInput: string): SkillDoc;

/** Config object shape: lint options plus an optional preset selector. */
type SkillspecConfig = Options & {
    preset?: Preset;
};
interface LoadedConfig {
    config: SkillspecConfig;
    /** Path the config was read from, or null when no config was found. */
    path: string | null;
}
/**
 * Find and load configuration. With an explicit path, that file is used.
 * Otherwise walks up from `cwd` looking for a `.skillspecrc[.json]`,
 * `skillspec.config.json`, or a `skillspec` field in `package.json`.
 * Returns empty options when nothing is found — skillspec is zero-config.
 */
declare function loadConfig(explicitPath?: string, cwd?: string): LoadedConfig;

interface DiscoverOptions {
    /** Directory basenames and simple globs to skip. */
    ignore?: string[];
    /** Base directory for relative paths. Defaults to `process.cwd()`. */
    cwd?: string;
}
interface DiscoverResult {
    /** Discovered SKILL.md files, as paths relative to `cwd` where possible, sorted. */
    files: string[];
    /** Explicitly-requested paths that do not exist. */
    missing: string[];
}
/**
 * Find every SKILL.md under the given paths. A file path is taken as-is; a
 * directory is walked recursively. With no paths, walks `cwd`.
 */
declare function discoverSkillFiles(paths: string[], options?: DiscoverOptions): DiscoverResult;

/**
 * Mechanical auto-fixes. Each corresponds to a fixable rule and operates on the
 * original file text (BOM included), so fixes are applied to fresh bytes from
 * disk, not the BOM-stripped parse buffer.
 */
declare function applyFixes(original: string, firedRuleIds: Set<string>): string;

/** Rule IDs whose findings can be auto-fixed by rewriting the file. */
declare const FIXABLE_RULES: readonly ["no-bom", "line-endings", "final-newline"];

/** Per-document rules, in a stable, readable order. */
declare const RULES: Rule[];
/** Cross-skill (set-level) rules. */
declare const SET_RULES: SetRule[];

/** Lightweight metadata for every rule (used by `--rules` and the config layer). */
declare const RULE_META: {
    id: string;
    description: string;
    defaultSeverity: 'error' | 'warning';
}[];

interface PrettyOptions {
    color?: boolean;
}

/** A Markdown summary suitable for `$GITHUB_STEP_SUMMARY`. */
declare function githubSummary(result: LintResult): string;

type Format = 'pretty' | 'json' | 'github' | 'sarif';
declare const FORMATS: Format[];
interface ReportOptions extends PrettyOptions {
}
/** Render a lint result in the requested format. */
declare function formatResult(format: Format, result: LintResult, options?: ReportOptions): string;

/**
 * Approximate token counting.
 *
 * skillspec runs offline in CI, so it can't call Anthropic's tokenizer. The
 * estimate below is intentionally conservative and is only used for *advisory*
 * budget warnings (the body's ~5k-token Level-2 budget). The authoritative
 * checks — `name` ≤ 64 chars, `description` ≤ 1024 chars — are exact character
 * counts and never rely on this.
 *
 * Heuristic: blends a chars/4 estimate (Anthropic's own rule of thumb for
 * English) with a word-count estimate, taking the larger so code- and
 * punctuation-heavy bodies aren't undercounted.
 */
declare function estimateTokens(text: string): number;
/** Count Unicode code points (so emoji / non-BMP chars count as 1, like the spec's char limits). */
declare function charLength(text: string): number;

/**
 * Package version. Kept in sync with package.json by a unit test
 * (see test/version.test.ts) so the two never drift.
 */
declare const VERSION = "0.1.0";

export { type ActiveSeverity, CLAUDE_CODE_KEYS, DEFAULT_IGNORE, DEFAULT_PRESET, type DiscoverResult, FIXABLE_RULES, FORMATS, type Finding, type Format, LIMITS, type LintResult, type LoadedConfig, NAME_PATTERN, OPEN_STANDARD_KEYS, type Options, PRESETS, type Preset, RULES, RULE_META, type ReportFn, type ReportOptions, type ResolveInput, type ResolvedOptions, type Rule, SET_RULES, SPEC_VERIFIED, type SetReportFn, type SetRule, type Severity, type SkillDoc, type SkillspecConfig, VERSION, applyFixes, charLength, compareFindings, discoverSkillFiles, estimateTokens, formatResult, githubSummary, lintDoc, lintFiles, lintSet, lintText, loadConfig, parseSkill, resolveOptions };
