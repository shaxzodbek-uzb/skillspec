import { describe, it, expect } from 'vitest';
import { lintText, resolveOptions } from '../src/index';

const NO_NAME =
  '---\ndescription: A skill with no name field, long enough to pass the minimum.\n---\n\n# Body\ntext\n';

describe('presets', () => {
  it('claude-code treats a missing name as a warning', () => {
    const f = lintText('skills/x/SKILL.md', NO_NAME, { preset: 'claude-code' }).find(
      (x) => x.ruleId === 'name-required',
    );
    expect(f?.severity).toBe('warning');
  });

  it('standard treats a missing name as an error', () => {
    const f = lintText('skills/x/SKILL.md', NO_NAME, { preset: 'standard' }).find(
      (x) => x.ruleId === 'name-required',
    );
    expect(f?.severity).toBe('error');
  });

  it('standard does not recognize Claude Code-only keys', () => {
    const raw =
      '---\nname: x\ndescription: A clean enough description. Use when the user wants this.\nmodel: sonnet\n---\n\n# Body\ntext\n';
    const claudeCode = new Set(
      lintText('skills/x/SKILL.md', raw, { preset: 'claude-code' }).map((f) => f.ruleId),
    );
    const standard = new Set(
      lintText('skills/x/SKILL.md', raw, { preset: 'standard' }).map((f) => f.ruleId),
    );
    expect(claudeCode).not.toContain('unknown-frontmatter-key');
    expect(standard).toContain('unknown-frontmatter-key');
  });
});

describe('rule overrides', () => {
  const bad =
    '---\nname: Bad_Name\ndescription: A clean enough description here. Use when the user wants this.\n---\n\n# Body\ntext\n';

  it('disables a rule with "off"', () => {
    const ids = new Set(
      lintText('skills/Bad_Name/SKILL.md', bad, { rules: { 'name-format': 'off' } }).map(
        (f) => f.ruleId,
      ),
    );
    expect(ids).not.toContain('name-format');
  });

  it('disables a rule with boolean false', () => {
    const ids = new Set(
      lintText('skills/Bad_Name/SKILL.md', bad, { rules: { 'name-format': false } }).map(
        (f) => f.ruleId,
      ),
    );
    expect(ids).not.toContain('name-format');
  });

  it('can downgrade an error to a warning', () => {
    const f = lintText('skills/Bad_Name/SKILL.md', bad, {
      rules: { 'name-format': 'warning' },
    }).find((x) => x.ruleId === 'name-format');
    expect(f?.severity).toBe('warning');
  });
});

describe('resolveOptions', () => {
  it('fills concrete defaults', () => {
    const o = resolveOptions();
    expect(o.nameMaxLength).toBe(64);
    expect(o.descriptionMaxLength).toBe(1024);
    expect(o.bodyMaxLines).toBe(500);
    expect(o.preset).toBe('claude-code');
    expect(o.knownKeys).toContain('allowed-tools');
  });

  it('honors custom limits', () => {
    const o = resolveOptions({ nameMaxLength: 32, knownKeys: ['x-custom'] });
    expect(o.nameMaxLength).toBe(32);
    expect(o.knownKeys).toContain('x-custom');
  });
});
