import type { LintResult } from '../types.js';

/** Escape a value for the body of a workflow command. */
function escapeData(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/** Escape a value for a workflow-command property. */
function escapeProperty(value: string): string {
  return escapeData(value).replace(/,/g, '%2C').replace(/:/g, '%3A');
}

/**
 * GitHub Actions workflow annotations. Printed to stdout, these surface as
 * inline error/warning markers on the PR diff and in the run log.
 */
export function reportGithub(result: LintResult): string {
  return result.findings
    .map((f) => {
      const command = f.severity === 'error' ? 'error' : 'warning';
      const props = [
        `title=${escapeProperty(`skillspec/${f.ruleId}`)}`,
        `file=${escapeProperty(f.file)}`,
      ];
      if (f.line) props.push(`line=${f.line}`);
      if (f.column) props.push(`col=${f.column}`);
      return `::${command} ${props.join(',')}::${escapeData(f.message)}`;
    })
    .join('\n');
}

/** A Markdown summary suitable for `$GITHUB_STEP_SUMMARY`. */
export function githubSummary(result: LintResult): string {
  const { fileCount, errorCount, warningCount, findings } = result;
  const lines: string[] = ['## skillspec'];

  if (findings.length === 0) {
    lines.push(
      '',
      `✅ **${fileCount}** skill${fileCount === 1 ? '' : 's'} checked — no problems found.`,
    );
    return lines.join('\n');
  }

  const icon = errorCount > 0 ? '❌' : '⚠️';
  lines.push(
    '',
    `${icon} **${errorCount}** error${errorCount === 1 ? '' : 's'}, **${warningCount}** warning${warningCount === 1 ? '' : 's'} across **${fileCount}** skill${fileCount === 1 ? '' : 's'}.`,
    '',
    '| Severity | File | Line | Rule | Message |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const f of findings) {
    const sev = f.severity === 'error' ? '🔴 error' : '🟡 warning';
    const loc = f.line ? String(f.line) : '';
    const msg = f.message.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${sev} | \`${f.file}\` | ${loc} | \`${f.ruleId}\` | ${msg} |`);
  }
  return lines.join('\n');
}
