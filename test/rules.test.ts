import { describe, it, expect } from 'vitest';
import { lintText, type ResolveInput } from '../src/index';

const GOOD_DESC =
  'Demonstrates a clean skill that passes every rule. Use when the user needs a baseline example for the skillspec test suite.';
const GOOD_BODY = '# Demo\n\nBody content that is sufficiently long to be useful.';
const DEMO_FILE = 'skills/demo/SKILL.md';

function skill(
  opts: {
    name?: string | null;
    description?: string | null;
    body?: string;
    extra?: string;
  } = {},
): string {
  const { name = 'demo', description = GOOD_DESC, body = GOOD_BODY, extra } = opts;
  const lines = ['---'];
  if (name !== null) lines.push(`name: ${name}`);
  if (description !== null) lines.push(`description: ${description}`);
  if (extra) lines.push(extra);
  lines.push('---', '', body);
  return lines.join('\n') + '\n';
}

function ids(raw: string, file = DEMO_FILE, input?: ResolveInput): Set<string> {
  return new Set(lintText(file, raw, input).map((f) => f.ruleId));
}

describe('clean baseline', () => {
  it('produces no findings', () => {
    expect(lintText(DEMO_FILE, skill())).toEqual([]);
  });
});

describe('name rules', () => {
  it('name-required when name is absent', () => {
    expect(ids(skill({ name: null }))).toContain('name-required');
  });
  it('name-format for non-kebab names', () => {
    expect(ids(skill({ name: 'Demo_Skill' }))).toContain('name-format');
  });
  it('name-length over 64 chars', () => {
    expect(ids(skill({ name: 'a'.repeat(65) }))).toContain('name-length');
  });
  it('name-matches-dir when name != directory', () => {
    const got = ids(skill({ name: 'other' }));
    expect(got).toContain('name-matches-dir');
    expect(got).not.toContain('name-format');
  });
  it('name-reserved for "claude"/"anthropic"', () => {
    const got = ids(skill({ name: 'claude-helper' }), 'skills/claude-helper/SKILL.md');
    expect(got).toContain('name-reserved');
    expect(got).not.toContain('name-matches-dir');
  });
});

describe('description rules', () => {
  it('description-required when absent', () => {
    expect(ids(skill({ description: null }))).toContain('description-required');
  });
  it('description-length over 1024 chars', () => {
    expect(ids(skill({ description: 'x'.repeat(1100) }))).toContain('description-length');
  });
  it('description-min-length when too thin', () => {
    expect(ids(skill({ description: 'Too short.' }))).toContain('description-min-length');
  });
  it('description-trigger when no "when to use" cue', () => {
    const got = ids(
      skill({
        description:
          'Formats and beautifies source code across many languages and frameworks producing tidy output.',
      }),
    );
    expect(got).toContain('description-trigger');
    expect(got).not.toContain('description-min-length');
  });
  it('description-third-person flags first/second person', () => {
    const got = ids(
      skill({
        description: 'I help you format your code. Use when the user wants formatting applied.',
      }),
    );
    expect(got).toContain('description-third-person');
    expect(got).not.toContain('description-trigger');
  });
  it('description-no-xml flags embedded tags', () => {
    expect(
      ids(
        skill({ description: 'Wraps content in <div> tags. Use when the user wants HTML output.' }),
      ),
    ).toContain('description-no-xml');
  });
});

describe('body rules', () => {
  it('body-present when body is empty', () => {
    expect(ids(skill({ body: '' }))).toContain('body-present');
  });
  it('body-max-lines over the line cap', () => {
    expect(ids(skill({ body: 'line\n'.repeat(600) }))).toContain('body-max-lines');
  });
  it('body-token-budget over the token cap', () => {
    const got = ids(skill({ body: 'lorem ipsum dolor '.repeat(2000) }));
    expect(got).toContain('body-token-budget');
    expect(got).not.toContain('body-max-lines');
  });
});

describe('frontmatter key rules', () => {
  it('unknown-frontmatter-key for an unrecognized key', () => {
    expect(ids(skill({ extra: 'author: Blaze' }))).toContain('unknown-frontmatter-key');
  });
  it('suggests the correct key for a typo', () => {
    const findings = lintText(DEMO_FILE, skill({ extra: 'allowed_tools: Read' }));
    const f = findings.find((x) => x.ruleId === 'unknown-frontmatter-key');
    expect(f?.message).toContain('allowed-tools');
  });
  it('allowed-tools-format for a non-string/list value', () => {
    expect(ids(skill({ extra: 'allowed-tools: 123' }))).toContain('allowed-tools-format');
  });
  it('accepts a YAML-list allowed-tools', () => {
    expect(ids(skill({ extra: 'allowed-tools:\n  - Read\n  - Bash' }))).not.toContain(
      'allowed-tools-format',
    );
  });
  it('compatibility-length over 500 chars', () => {
    expect(ids(skill({ extra: `compatibility: ${'x'.repeat(600)}` }))).toContain(
      'compatibility-length',
    );
  });
  it('metadata-type when metadata is not a map', () => {
    expect(ids(skill({ extra: 'metadata: just-a-string' }))).toContain('metadata-type');
  });
  it('version-placement for a top-level version', () => {
    const got = ids(skill({ extra: 'version: "1.0"' }));
    expect(got).toContain('version-placement');
    expect(got).not.toContain('unknown-frontmatter-key');
  });
});

describe('structure and encoding rules', () => {
  it('filename when not exactly SKILL.md', () => {
    expect(ids(skill(), 'skills/demo/skill.md')).toContain('filename');
  });
  it('frontmatter-present when missing', () => {
    expect(ids('# Just markdown, no frontmatter\n')).toContain('frontmatter-present');
  });
  it('frontmatter-valid on a YAML error', () => {
    expect(ids('---\nname: demo\n\tbad: indent\n---\nbody\n')).toContain('frontmatter-valid');
  });
  it('no-bom when a BOM is present', () => {
    expect(ids('﻿' + skill())).toContain('no-bom');
  });
  it('line-endings on CRLF', () => {
    expect(ids(skill().replace(/\n/g, '\r\n'))).toContain('line-endings');
  });
  it('final-newline when missing', () => {
    expect(ids(skill().replace(/\n+$/, ''))).toContain('final-newline');
  });
});
