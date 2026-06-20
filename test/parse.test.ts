import { describe, it, expect } from 'vitest';
import { parseSkill } from '../src/parse';

describe('parseSkill', () => {
  it('parses well-formed frontmatter and body', () => {
    const doc = parseSkill(
      'skills/demo/SKILL.md',
      '---\nname: demo\ndescription: A demo.\n---\n\n# Body\nhello\n',
    );
    expect(doc.hasFrontmatter).toBe(true);
    expect(doc.dirName).toBe('demo');
    expect(doc.data).toEqual({ name: 'demo', description: 'A demo.' });
    expect(doc.body.trim()).toBe('# Body\nhello');
    expect(doc.yamlError).toBeNull();
  });

  it('records 1-based file line numbers for each key', () => {
    const doc = parseSkill('SKILL.md', '---\nname: demo\ndescription: A demo.\n---\nbody\n');
    expect(doc.keyLines['name']).toBe(2);
    expect(doc.keyLines['description']).toBe(3);
    expect(doc.bodyStartLine).toBe(5);
  });

  it('detects a missing frontmatter block', () => {
    const doc = parseSkill('SKILL.md', '# Just markdown\nno frontmatter here\n');
    expect(doc.hasFrontmatter).toBe(false);
    expect(doc.unterminatedFrontmatter).toBe(false);
    expect(doc.data).toBeNull();
  });

  it('detects an unterminated frontmatter block', () => {
    const doc = parseSkill('SKILL.md', '---\nname: demo\ndescription: oops no close\n');
    expect(doc.hasFrontmatter).toBe(false);
    expect(doc.unterminatedFrontmatter).toBe(true);
  });

  it('strips and flags a UTF-8 BOM', () => {
    const doc = parseSkill('SKILL.md', '﻿---\nname: demo\ndescription: A demo.\n---\nbody\n');
    expect(doc.hadBom).toBe(true);
    expect(doc.hasFrontmatter).toBe(true);
    expect(doc.data?.['name']).toBe('demo');
  });

  it('handles CRLF line endings', () => {
    const doc = parseSkill(
      'SKILL.md',
      '---\r\nname: demo\r\ndescription: A demo.\r\n---\r\nbody\r\n',
    );
    expect(doc.hasCrlf).toBe(true);
    expect(doc.hasFrontmatter).toBe(true);
    expect(doc.data?.['name']).toBe('demo');
  });

  it('reports a YAML parse error with a line number', () => {
    const doc = parseSkill('SKILL.md', '---\nname: demo\n\tbad: indent\n---\nbody\n');
    expect(doc.yamlError).not.toBeNull();
    expect(doc.yamlError?.line).toBeGreaterThan(0);
  });

  it('flags frontmatter that is not a mapping', () => {
    const doc = parseSkill('SKILL.md', '---\n- just\n- a\n- list\n---\nbody\n');
    expect(doc.yamlError?.message).toMatch(/mapping/);
  });

  it('preserves quoted descriptions with inner quotes and em dashes', () => {
    const raw =
      '---\nname: docs\ndescription: "Use this — really — when the user says \\"deck\\" or \\"slides\\"."\n---\nbody\n';
    const doc = parseSkill('SKILL.md', raw);
    expect(doc.data?.['description']).toContain('—');
    expect(doc.data?.['description']).toContain('"deck"');
  });
});
