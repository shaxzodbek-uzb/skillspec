import { describe, it, expect } from 'vitest';
import { formatResult, type LintResult } from '../src/index';

const RESULT: LintResult = {
  findings: [
    {
      ruleId: 'name-format',
      severity: 'error',
      message: 'bad name, with commas: and colons',
      file: 'skills/a/SKILL.md',
      line: 2,
      column: 1,
    },
    {
      ruleId: 'description-trigger',
      severity: 'warning',
      message: 'add a trigger\nsecond line',
      file: 'skills/a/SKILL.md',
      line: 3,
      column: 1,
    },
  ],
  fileCount: 1,
  errorCount: 1,
  warningCount: 1,
};

const CLEAN: LintResult = { findings: [], fileCount: 3, errorCount: 0, warningCount: 0 };

describe('json reporter', () => {
  it('emits a stable, parseable shape', () => {
    const out = JSON.parse(formatResult('json', RESULT));
    expect(out.tool).toBe('skillspec');
    expect(out.summary).toEqual({ fileCount: 1, errorCount: 1, warningCount: 1 });
    expect(out.findings).toHaveLength(2);
    expect(out.findings[0].ruleId).toBe('name-format');
  });
});

describe('github reporter', () => {
  const out = formatResult('github', RESULT);
  it('emits error and warning workflow commands', () => {
    expect(out).toContain('::error ');
    expect(out).toContain('::warning ');
    expect(out).toContain('title=skillspec/name-format');
    expect(out).toContain('file=skills/a/SKILL.md');
    expect(out).toContain('line=2');
  });
  it('escapes newlines in the message body', () => {
    expect(out).toContain('add a trigger%0Asecond line');
  });
});

describe('sarif reporter', () => {
  it('emits valid SARIF 2.1.0', () => {
    const sarif = JSON.parse(formatResult('sarif', RESULT));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].tool.driver.name).toBe('skillspec');
    expect(sarif.runs[0].results).toHaveLength(2);
    expect(sarif.runs[0].results[0].ruleId).toBe('name-format');
    expect(sarif.runs[0].results[0].level).toBe('error');
    expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(10);
  });
});

describe('pretty reporter', () => {
  it('renders findings without color', () => {
    const out = formatResult('pretty', RESULT, { color: false });
    expect(out).toContain('skills/a/SKILL.md');
    expect(out).toContain('name-format');
    expect(out).toContain('2 problems');
    expect(out).not.toContain(''); // no ANSI escape sequences
  });
  it('renders a friendly clean message', () => {
    const out = formatResult('pretty', CLEAN, { color: false });
    expect(out).toContain('no problems found');
    expect(out).toContain('3 skills');
  });
});
