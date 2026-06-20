import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index';
import pkg from '../package.json';

describe('version', () => {
  it('matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });
});
