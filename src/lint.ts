import { readFileSync } from 'node:fs';
import type { ActiveSeverity, Finding, LintResult, ResolvedOptions, SkillDoc } from './types.js';
import { parseSkill } from './parse.js';
import { RULES, SET_RULES } from './rules/index.js';
import { resolveOptions, type ResolveInput } from './options.js';
import { discoverSkillFiles } from './discover.js';

/** Order findings for display: by file, then line, then errors before warnings. */
export function compareFindings(a: Finding, b: Finding): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  const la = a.line ?? 0;
  const lb = b.line ?? 0;
  if (la !== lb) return la - lb;
  if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

/** Run all per-document rules against one parsed doc. */
export function lintDoc(doc: SkillDoc, options: ResolvedOptions): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    const severity = options.severities[rule.id] ?? rule.defaultSeverity;
    if (severity === 'off') continue;
    rule.check(doc, options, (message, opts) => {
      findings.push({
        ruleId: rule.id,
        severity: severity as ActiveSeverity,
        message,
        file: doc.file,
        line: opts?.line,
        column: opts?.column,
        data: opts?.data,
      });
    });
  }
  return findings;
}

/** Run all set-level (cross-skill) rules against the full set of docs. */
export function lintSet(docs: SkillDoc[], options: ResolvedOptions): Finding[] {
  const findings: Finding[] = [];
  for (const rule of SET_RULES) {
    const severity = options.severities[rule.id] ?? rule.defaultSeverity;
    if (severity === 'off') continue;
    rule.check(docs, options, (doc, message, opts) => {
      findings.push({
        ruleId: rule.id,
        severity: severity as ActiveSeverity,
        message,
        file: doc.file,
        line: opts?.line,
        column: opts?.column,
        data: opts?.data,
      });
    });
  }
  return findings;
}

/** Lint SKILL.md text directly, without touching the filesystem. */
export function lintText(file: string, raw: string, input: ResolveInput = {}): Finding[] {
  const options = resolveOptions(input);
  return lintDoc(parseSkill(file, raw), options).sort(compareFindings);
}

function tallyFromFindings(findings: Finding[]): { errorCount: number; warningCount: number } {
  let errorCount = 0;
  let warningCount = 0;
  for (const f of findings) {
    if (f.severity === 'error') errorCount++;
    else warningCount++;
  }
  return { errorCount, warningCount };
}

/**
 * Discover and lint SKILL.md files on disk. Reads each file, parses it, runs the
 * per-document rules, then the set-level rules across everything found.
 */
export function lintFiles(paths: string[], input: ResolveInput = {}): LintResult {
  const options = resolveOptions(input);
  const { files, missing } = discoverSkillFiles(paths, { ignore: options.ignore });

  const findings: Finding[] = [];
  const docs: SkillDoc[] = [];

  for (const path of missing) {
    findings.push({
      ruleId: 'path-not-found',
      severity: 'error',
      message: `Path not found: ${path}`,
      file: path,
    });
  }

  for (const file of files) {
    let raw: string;
    try {
      raw = readFileSync(file, 'utf8');
    } catch (err) {
      findings.push({
        ruleId: 'read-error',
        severity: 'error',
        message: `Could not read file: ${(err as Error).message}`,
        file,
      });
      continue;
    }
    const doc = parseSkill(file, raw);
    docs.push(doc);
    findings.push(...lintDoc(doc, options));
  }

  findings.push(...lintSet(docs, options));
  findings.sort(compareFindings);

  const { errorCount, warningCount } = tallyFromFindings(findings);
  return { findings, fileCount: docs.length, errorCount, warningCount };
}
