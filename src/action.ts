import { appendFileSync } from 'node:fs';
import process from 'node:process';
import type { Options, Severity } from './types.js';
import type { Preset } from './spec.js';
import { lintFiles } from './lint.js';
import { reportGithub, githubSummary } from './reporters/github.js';

/** Read an action input the way @actions/core does, tolerating hyphen/underscore. */
function getInput(name: string, fallback = ''): string {
  const primary = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  const alt = `INPUT_${name.replace(/[ -]/g, '_').toUpperCase()}`;
  const value = process.env[primary] ?? process.env[alt];
  return (value ?? fallback).trim();
}

function getBool(name: string): boolean {
  return ['true', '1', 'yes'].includes(getInput(name).toLowerCase());
}

function parseRuleOverrides(raw: string): Record<string, Severity> {
  const out: Record<string, Severity> = {};
  for (const part of raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = part.lastIndexOf(':');
    if (idx <= 0) continue;
    const id = part.slice(0, idx);
    let sev = part.slice(idx + 1) as Severity | 'warn';
    if (sev === 'warn') sev = 'warning';
    if (sev === 'error' || sev === 'warning' || sev === 'off') out[id] = sev;
  }
  return out;
}

function appendTo(envVar: string, content: string): void {
  const file = process.env[envVar];
  if (file) {
    try {
      appendFileSync(file, content);
    } catch {
      /* non-fatal */
    }
  }
}

function run(): void {
  // Split on newlines/commas only (not spaces) so directory paths containing
  // spaces survive intact.
  const paths = getInput('paths')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const preset = getInput('preset') as Preset | '';
  const options: Options & { preset?: Preset } = {
    rules: parseRuleOverrides(getInput('rules')),
  };
  if (preset === 'claude-code' || preset === 'standard') options.preset = preset;

  const result = lintFiles(paths, options);

  const annotations = reportGithub(result);
  if (annotations) process.stdout.write(`${annotations}\n`);

  appendTo('GITHUB_STEP_SUMMARY', `${githubSummary(result)}\n`);
  appendTo(
    'GITHUB_OUTPUT',
    `error-count=${result.errorCount}\nwarning-count=${result.warningCount}\nfile-count=${result.fileCount}\n`,
  );

  const maxWarnings = Number(getInput('max-warnings', '-1'));
  const failOnWarnings = getBool('fail-on-warnings');
  const overWarnings =
    (Number.isFinite(maxWarnings) && maxWarnings >= 0 && result.warningCount > maxWarnings) ||
    (failOnWarnings && result.warningCount > 0);

  process.stdout.write(
    `::notice title=skillspec::Checked ${result.fileCount} skill(s): ${result.errorCount} error(s), ${result.warningCount} warning(s)\n`,
  );

  if (result.errorCount > 0 || overWarnings) {
    const reason =
      result.errorCount === 0
        ? `Failing on ${result.warningCount} warning(s) (warning gate exceeded)`
        : `Found ${result.errorCount} error(s) and ${result.warningCount} warning(s)`;
    process.stdout.write(`::error title=skillspec::${reason}\n`);
    process.exitCode = 1;
  }
}

try {
  run();
} catch (err) {
  process.stdout.write(`::error title=skillspec::${(err as Error).message}\n`);
  process.exitCode = 1;
}
