import type { Finding, LintResult } from '../types.js';

export interface PrettyOptions {
  color?: boolean;
}

function colors(enabled: boolean) {
  const wrap = (code: number) => (s: string) => (enabled ? `[${code}m${s}[0m` : s);
  return {
    red: wrap(31),
    yellow: wrap(33),
    green: wrap(32),
    dim: wrap(2),
    bold: wrap(1),
    cyan: wrap(36),
    underline: wrap(4),
  };
}

function groupByFile(findings: Finding[]): Map<string, Finding[]> {
  const map = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = map.get(f.file) ?? [];
    list.push(f);
    map.set(f.file, list);
  }
  return map;
}

/** Human-readable, ESLint-style output. */
export function reportPretty(result: LintResult, options: PrettyOptions = {}): string {
  const c = colors(options.color ?? false);
  const { findings, fileCount, errorCount, warningCount } = result;

  if (findings.length === 0) {
    const skills = `${fileCount} skill${fileCount === 1 ? '' : 's'}`;
    return c.green(`✓ skillspec: ${skills} checked, no problems found.`);
  }

  const lines: string[] = [];
  for (const [file, group] of groupByFile(findings)) {
    lines.push(c.underline(c.bold(file)));
    const locWidth = Math.max(...group.map((f) => `${f.line ?? ''}:${f.column ?? ''}`.length), 4);
    for (const f of group) {
      const loc = f.line ? `${f.line}:${f.column ?? 1}` : '';
      const sev = f.severity === 'error' ? c.red('error  ') : c.yellow('warning');
      lines.push(`  ${c.dim(loc.padEnd(locWidth))}  ${sev}  ${f.message}  ${c.dim(f.ruleId)}`);
    }
    lines.push('');
  }

  const parts: string[] = [];
  if (errorCount > 0) parts.push(c.red(`${errorCount} error${errorCount === 1 ? '' : 's'}`));
  if (warningCount > 0)
    parts.push(c.yellow(`${warningCount} warning${warningCount === 1 ? '' : 's'}`));
  const total = errorCount + warningCount;
  const summary = `${c.bold('✖')} ${total} problem${total === 1 ? '' : 's'} (${parts.join(', ')}) across ${fileCount} skill${fileCount === 1 ? '' : 's'}`;
  lines.push(errorCount > 0 ? c.red(summary) : c.yellow(summary));

  return lines.join('\n');
}
