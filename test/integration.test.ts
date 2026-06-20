import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintFiles, discoverSkillFiles } from '../src/index';

const CLI = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const hasDist = existsSync(CLI);
const cliIt = hasDist ? it : it.skip;

let root: string;

function writeSkill(
  dir: string,
  frontmatter: string,
  body = '# Body\n\nSufficiently long body content.\n',
) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}`);
}

const cleanDesc =
  'Does a clean, well-described job. Use when the user wants the clean example behavior.';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'skillspec-it-'));

  writeSkill(join(root, 'skills', 'alpha'), `name: alpha\ndescription: ${cleanDesc}`);
  writeSkill(join(root, 'skills', 'bravo'), 'name: Bad_Name\ndescription: short', '');
  writeSkill(
    join(root, 'skills', 'node_modules', 'pkg', 'ignored'),
    `name: ignored\ndescription: ${cleanDesc}`,
  );

  writeSkill(join(root, 'dupes', 'one'), `name: shared\ndescription: ${cleanDesc}`);
  writeSkill(join(root, 'dupes', 'two'), `name: shared\ndescription: ${cleanDesc}`);

  const collideDesc =
    'Searches the project for files matching a glob pattern and prints their paths. Use when the user wants to locate files by name.';
  writeSkill(
    join(root, 'collide', 'search-files'),
    `name: search-files\ndescription: ${collideDesc}`,
  );
  writeSkill(join(root, 'collide', 'find-files'), `name: find-files\ndescription: ${collideDesc}`);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('discoverSkillFiles', () => {
  it('finds nested SKILL.md files', () => {
    const { files } = discoverSkillFiles([join(root, 'skills')], { ignore: ['node_modules'] });
    expect(files.length).toBe(2);
    expect(files.some((f) => f.endsWith('alpha/SKILL.md') || f.endsWith('alpha\\SKILL.md'))).toBe(
      true,
    );
  });
  it('respects the ignore list', () => {
    const withIgnore = discoverSkillFiles([join(root, 'skills')], { ignore: ['node_modules'] });
    const without = discoverSkillFiles([join(root, 'skills')]);
    expect(without.files.length).toBe(3);
    expect(withIgnore.files.length).toBe(2);
  });
  it('reports missing paths', () => {
    const { missing } = discoverSkillFiles([join(root, 'does-not-exist')]);
    expect(missing).toHaveLength(1);
  });
});

describe('lintFiles', () => {
  it('counts files and finds errors in a broken skill', () => {
    const result = lintFiles([join(root, 'skills')], { ignore: ['node_modules'] });
    expect(result.fileCount).toBe(2);
    expect(result.errorCount).toBeGreaterThan(0);
  });
  it('detects duplicate names across the set', () => {
    const result = lintFiles([join(root, 'dupes')]);
    expect(result.findings.some((f) => f.ruleId === 'duplicate-name')).toBe(true);
  });
  it('detects trigger collisions across the set', () => {
    const result = lintFiles([join(root, 'collide')]);
    expect(result.findings.some((f) => f.ruleId === 'trigger-collision')).toBe(true);
  });
});

describe('cli', () => {
  cliIt('exits 0 on a clean skill', () => {
    const out = execFileSync(process.execPath, [CLI, join(root, 'skills', 'alpha'), '--no-color'], {
      encoding: 'utf8',
    });
    expect(out).toContain('no problems found');
  });

  cliIt('exits 1 on a broken skill', () => {
    expect(() =>
      execFileSync(process.execPath, [CLI, join(root, 'skills', 'bravo'), '--no-color'], {
        encoding: 'utf8',
      }),
    ).toThrow();
  });

  cliIt('emits valid JSON with --format json', () => {
    const out = execFileSync(
      process.execPath,
      [CLI, join(root, 'skills', 'alpha'), '--format', 'json'],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(out).tool).toBe('skillspec');
  });

  cliIt('applies fixes with --fix', () => {
    const dir = join(root, 'fixme');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\r\nname: fixme\r\ndescription: ${cleanDesc}\r\n---\r\n\r\n# Body\r\n\r\ncontent`,
    );
    execFileSync(process.execPath, [CLI, dir, '--fix', '--format', 'json'], { encoding: 'utf8' });
    const after = readFileSync(join(dir, 'SKILL.md'), 'utf8');
    expect(after).not.toContain('\r\n');
    expect(after.endsWith('\n')).toBe(true);
  });
});
