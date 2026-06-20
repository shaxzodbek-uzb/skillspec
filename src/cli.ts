#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import type { Options, Severity } from './types.js';
import { loadConfig } from './config.js';
import { lintFiles } from './lint.js';
import { applyFixes } from './fix.js';
import { FIXABLE_RULES, RULE_META } from './rules/index.js';
import { formatResult, FORMATS, type Format } from './reporters/index.js';
import { VERSION } from './version.js';
import { SPEC_VERIFIED } from './spec.js';
import type { Preset } from './spec.js';

// Exit quietly when our output is piped into a reader that closes early
// (e.g. `skillspec --rules | head`), instead of crashing with EPIPE.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

interface CliArgs {
  paths: string[];
  format?: Format;
  preset?: Preset;
  config?: string;
  fix: boolean;
  quiet: boolean;
  color?: boolean;
  maxWarnings: number;
  ruleOverrides: Record<string, Severity>;
  showHelp: boolean;
  showVersion: boolean;
  listRules: boolean;
}

const HELP = `skillspec ${VERSION} — lint Claude Agent SKILL.md files against Anthropic's spec

Usage:
  skillspec [paths...] [options]

Arguments:
  paths                 Files or directories to lint. Default: discover SKILL.md
                        files under the current directory.

Options:
  -f, --format <fmt>    Output format: ${FORMATS.join(', ')} (default: pretty,
                        or github when run inside GitHub Actions).
      --preset <name>   Spec preset: claude-code (default) or standard.
      --config <path>   Use a specific config file.
      --fix             Apply mechanical fixes (BOM, CRLF, final newline) in place.
      --rule <id:sev>   Override a rule severity (error|warning|off). Repeatable.
      --max-warnings <n> Fail if warnings exceed n (default: -1, never).
      --quiet           Report errors only; ignore warnings.
      --no-color        Disable colored output.
      --rules           List all rules and exit.
  -v, --version         Print version and exit.
  -h, --help            Show this help and exit.

Exit codes: 0 = clean, 1 = problems found, 2 = usage error.
Docs: https://github.com/shaxzodbek-uzb/skillspec`;

function fail(message: string): never {
  process.stderr.write(`skillspec: ${message}\n`);
  process.exit(2);
}

function normalizeSeverity(value: string): Severity {
  if (value === 'warn') return 'warning';
  if (value === 'error' || value === 'warning' || value === 'off') return value;
  fail(`invalid severity "${value}" (expected error, warning, or off)`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    paths: [],
    fix: false,
    quiet: false,
    maxWarnings: -1,
    ruleOverrides: {},
    showHelp: false,
    showVersion: false,
    listRules: false,
  };

  const next = (i: number, flag: string): string => {
    const value = argv[i + 1];
    if (value === undefined) fail(`missing value for ${flag}`);
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-h':
      case '--help':
        args.showHelp = true;
        break;
      case '-v':
      case '-V':
      case '--version':
        args.showVersion = true;
        break;
      case '--rules':
        args.listRules = true;
        break;
      case '-f':
      case '--format': {
        const value = next(i++, arg);
        if (!FORMATS.includes(value as Format)) fail(`unknown format "${value}"`);
        args.format = value as Format;
        break;
      }
      case '--preset': {
        const value = next(i++, arg);
        if (value !== 'claude-code' && value !== 'standard') fail(`unknown preset "${value}"`);
        args.preset = value;
        break;
      }
      case '--config':
        args.config = next(i++, arg);
        break;
      case '--fix':
        args.fix = true;
        break;
      case '--quiet':
        args.quiet = true;
        break;
      case '--color':
        args.color = true;
        break;
      case '--no-color':
        args.color = false;
        break;
      case '--max-warnings': {
        const value = Number(next(i++, arg));
        if (!Number.isFinite(value)) fail('--max-warnings expects a number');
        args.maxWarnings = value;
        break;
      }
      case '--rule': {
        const value = next(i++, arg);
        const idx = value.lastIndexOf(':');
        if (idx <= 0) fail(`--rule expects <id:severity>, got "${value}"`);
        const id = value.slice(0, idx);
        args.ruleOverrides[id] = normalizeSeverity(value.slice(idx + 1));
        break;
      }
      default:
        if (arg.startsWith('-')) fail(`unknown option "${arg}"`);
        args.paths.push(arg);
    }
  }
  return args;
}

function listRules(): void {
  process.stdout.write(`skillspec rules (spec verified ${SPEC_VERIFIED})\n\n`);
  const width = Math.max(...RULE_META.map((r) => r.id.length));
  for (const r of RULE_META) {
    const sev = r.defaultSeverity === 'error' ? 'error  ' : 'warning';
    process.stdout.write(`  ${r.id.padEnd(width)}  ${sev}  ${r.description}\n`);
  }
}

function runFixes(paths: string[], options: Options & { preset?: Preset }): number {
  const pre = lintFiles(paths, options);
  const byFile = new Map<string, Set<string>>();
  for (const f of pre.findings) {
    if ((FIXABLE_RULES as readonly string[]).includes(f.ruleId)) {
      const set = byFile.get(f.file) ?? new Set<string>();
      set.add(f.ruleId);
      byFile.set(f.file, set);
    }
  }
  let fixedFiles = 0;
  for (const [file, ids] of byFile) {
    let original: string;
    try {
      original = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const fixed = applyFixes(original, ids);
    if (fixed !== original) {
      writeFileSync(file, fixed);
      fixedFiles++;
    }
  }
  return fixedFiles;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.showHelp) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (args.showVersion) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (args.listRules) {
    listRules();
    return;
  }

  // Resolve options: config file < CLI overrides.
  let fileConfig;
  try {
    fileConfig = loadConfig(args.config).config;
  } catch (err) {
    fail((err as Error).message);
  }
  const options: Options & { preset?: Preset } = {
    ...fileConfig,
    preset: args.preset ?? fileConfig.preset,
    rules: { ...fileConfig.rules, ...args.ruleOverrides },
  };

  const inActions = process.env.GITHUB_ACTIONS === 'true';
  const format: Format = args.format ?? (inActions ? 'github' : 'pretty');

  if (args.fix) {
    const fixedFiles = runFixes(args.paths, options);
    if (fixedFiles > 0 && format === 'pretty') {
      process.stdout.write(`skillspec: applied fixes to ${fixedFiles} file(s)\n\n`);
    }
  }

  let result = lintFiles(args.paths, options);
  if (args.quiet) {
    const findings = result.findings.filter((f) => f.severity === 'error');
    result = { ...result, findings, warningCount: 0 };
  }

  const color =
    args.color ?? (format === 'pretty' && Boolean(process.stdout.isTTY) && !process.env.NO_COLOR);
  const output = formatResult(format, result, { color });
  if (output) process.stdout.write(`${output}\n`);

  const overWarnings = args.maxWarnings >= 0 && result.warningCount > args.maxWarnings;
  process.exit(result.errorCount > 0 || overWarnings ? 1 : 0);
}

main();
