import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintText, parseSkill, resolveOptions } from '../src/index';

function ids(file: string, raw: string): Set<string> {
  return new Set(lintText(file, raw).map((f) => f.ruleId));
}

const F = 'skills/demo/SKILL.md';
const body = '\n\n# Demo\n\nSufficiently long body content.\n';

describe('parse: CRLF line numbers (regression)', () => {
  const lf = '---\nname: demo\ndescription: A demo skill.\nlicense: MIT\n---\nbody\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  it('reports identical key line numbers for LF and CRLF', () => {
    const expected = { name: 2, description: 3, license: 4 };
    expect(parseSkill('SKILL.md', lf).keyLines).toEqual(expected);
    expect(parseSkill('SKILL.md', crlf).keyLines).toEqual(expected);
  });
});

describe('parse: empty / comment-only frontmatter (regression)', () => {
  it('treats empty frontmatter as valid-but-empty', () => {
    const doc = parseSkill('SKILL.md', '---\n---\n\nbody\n');
    expect(doc.hasFrontmatter).toBe(true);
    expect(doc.data).toEqual({});
    expect(doc.yamlError).toBeNull();
  });
  it('does not emit frontmatter-valid for empty frontmatter, but does flag missing keys', () => {
    const got = ids(F, '---\n---\n\nbody\n');
    expect(got).not.toContain('frontmatter-valid');
    expect(got).toContain('name-required');
    expect(got).toContain('description-required');
  });
});

describe('description-third-person: acronyms (regression)', () => {
  const trigger = 'Use when the user needs it.';
  it('does not flag uppercase acronyms (US, I/O, ME)', () => {
    expect(
      ids(F, `---\nname: demo\ndescription: Generates US-format invoices. ${trigger}\n---${body}`),
    ).not.toContain('description-third-person');
    expect(
      ids(F, `---\nname: demo\ndescription: Handles I/O and AWS calls. ${trigger}\n---${body}`),
    ).not.toContain('description-third-person');
  });
  it('still flags lowercase pronouns and sentence-initial pronouns', () => {
    expect(
      ids(F, `---\nname: demo\ndescription: Formats your code nicely. ${trigger}\n---${body}`),
    ).toContain('description-third-person');
    expect(
      ids(F, `---\nname: demo\ndescription: We generate the reports. ${trigger}\n---${body}`),
    ).toContain('description-third-person');
  });
});

describe('metadata-type: non-string values (regression)', () => {
  it('flags a numeric metadata value', () => {
    expect(
      ids(
        F,
        `---\nname: demo\ndescription: A demo skill. Use when the user wants it.\nmetadata:\n  version: 1.0\n---${body}`,
      ),
    ).toContain('metadata-type');
  });
  it('accepts a quoted string metadata value', () => {
    expect(
      ids(
        F,
        `---\nname: demo\ndescription: A demo skill. Use when the user wants it.\nmetadata:\n  version: "1.0"\n---${body}`,
      ),
    ).not.toContain('metadata-type');
  });
});

describe('allowed-tools: comma-separated string (regression)', () => {
  it('flags a comma-separated allowed-tools string', () => {
    expect(
      ids(
        F,
        `---\nname: demo\ndescription: A demo skill. Use when the user wants it.\nallowed-tools: "Bash, Read, Write"\n---${body}`,
      ),
    ).toContain('allowed-tools-format');
  });
  it('accepts a space-separated allowed-tools string', () => {
    expect(
      ids(
        F,
        `---\nname: demo\ndescription: A demo skill. Use when the user wants it.\nallowed-tools: Bash(git:*) Read\n---${body}`,
      ),
    ).not.toContain('allowed-tools-format');
  });
});

describe('options: compatibilityMaxLength is wired', () => {
  it('defaults to 500 and is configurable', () => {
    expect(resolveOptions().compatibilityMaxLength).toBe(500);
    expect(resolveOptions({ compatibilityMaxLength: 100 }).compatibilityMaxLength).toBe(100);
  });
});

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const cliIt = existsSync(CLI) ? it : it.skip;

describe('cli flag parsing (regression)', () => {
  let dir: string;
  let warnDir: string;
  function setup() {
    const root = mkdtempSync(join(tmpdir(), 'skillspec-rf-'));
    dir = join(root, 'alpha');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: alpha\ndescription: A clean alpha skill. Use when the user wants the alpha example.\n---\n\n# Body\n\ncontent.\n',
    );
    // one warning (unknown key), zero errors
    warnDir = join(root, 'beta');
    mkdirSync(warnDir, { recursive: true });
    writeFileSync(
      join(warnDir, 'SKILL.md'),
      '---\nname: beta\ndescription: A clean beta skill. Use when the user wants the beta example.\nauthor: Blaze\n---\n\n# Body\n\ncontent.\n',
    );
  }

  cliIt('accepts --format=json (inline value)', () => {
    setup();
    const out = execFileSync(process.execPath, [CLI, dir, '--format=json'], { encoding: 'utf8' });
    expect(JSON.parse(out).tool).toBe('skillspec');
  });

  cliIt('accepts -- as end-of-options', () => {
    setup();
    const out = execFileSync(process.execPath, [CLI, '--no-color', '--', dir], {
      encoding: 'utf8',
    });
    expect(out).toContain('no problems found');
  });

  cliIt('--quiet does not bypass the --max-warnings gate', () => {
    setup();
    expect(() =>
      execFileSync(
        process.execPath,
        [CLI, warnDir, '--quiet', '--max-warnings', '0', '--no-color'],
        {
          encoding: 'utf8',
        },
      ),
    ).toThrow();
  });
});
