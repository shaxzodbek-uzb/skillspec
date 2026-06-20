import { describe, it, expect } from 'vitest';
import { applyFixes } from '../src/index';

describe('applyFixes', () => {
  it('strips a BOM', () => {
    expect(applyFixes('﻿hi\n', new Set(['no-bom']))).toBe('hi\n');
  });
  it('converts CRLF to LF', () => {
    expect(applyFixes('a\r\nb\r\n', new Set(['line-endings']))).toBe('a\nb\n');
  });
  it('adds a missing final newline', () => {
    expect(applyFixes('hi', new Set(['final-newline']))).toBe('hi\n');
  });
  it('collapses multiple trailing newlines to one', () => {
    expect(applyFixes('hi\n\n\n', new Set(['final-newline']))).toBe('hi\n');
  });
  it('only applies fixers whose rule fired', () => {
    expect(applyFixes('﻿hi', new Set(['final-newline']))).toBe('﻿hi\n');
  });
  it('combines multiple fixers', () => {
    expect(applyFixes('﻿a\r\nb', new Set(['no-bom', 'line-endings', 'final-newline']))).toBe(
      'a\nb\n',
    );
  });
});
