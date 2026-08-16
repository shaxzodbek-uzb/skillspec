import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncer,
  createWatcher,
  isRelevantChange,
  watchRoots,
  type Watcher,
} from '../src/watch.js';

describe('isRelevantChange', () => {
  it('accepts SKILL.md in any case', () => {
    expect(isRelevantChange('SKILL.md')).toBe(true);
    expect(isRelevantChange('skill.md')).toBe(true);
    expect(isRelevantChange('Skill.MD')).toBe(true);
  });

  it('accepts a nested SKILL.md', () => {
    expect(isRelevantChange(join('pdf-tools', 'SKILL.md'))).toBe(true);
  });

  it('assumes relevance when the platform reports no filename', () => {
    // Missing an edit is worse than an extra lint pass.
    expect(isRelevantChange(null)).toBe(true);
    expect(isRelevantChange('')).toBe(true);
  });

  it('accepts an extensionless name, which may be a new skill directory', () => {
    expect(isRelevantChange('pdf-tools')).toBe(true);
  });

  it('ignores unrelated files', () => {
    expect(isRelevantChange('README.md')).toBe(false);
    expect(isRelevantChange('notes.txt')).toBe(false);
    expect(isRelevantChange('.SKILL.md.swp')).toBe(false);
  });
});

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires once after a burst of triggers', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 100);
    d.trigger();
    d.trigger();
    d.trigger();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('restarts the window on each trigger', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 100);
    d.trigger();
    vi.advanceTimersByTime(80);
    d.trigger();
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires again for a later burst', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 50);
    d.trigger();
    vi.advanceTimersByTime(50);
    d.trigger();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('cancel prevents a pending call', () => {
    const fn = vi.fn();
    const d = createDebouncer(fn, 50);
    d.trigger();
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('watchRoots', () => {
  const cwd = sep === '\\' ? 'C:\\work' : '/work';
  const abs = (...parts: string[]): string => join(cwd, ...parts);

  it('watches the cwd when no paths were given', () => {
    expect(watchRoots([], [], cwd)).toEqual([cwd]);
  });

  it('watches a directory argument directly', () => {
    expect(watchRoots(['skills'], [], cwd)).toEqual([abs('skills')]);
  });

  it('watches the containing directory of a file argument', () => {
    // Watching a lone file misses the atomic-rename most editors use to save.
    expect(watchRoots([join('skills', 'pdf', 'SKILL.md')], [], cwd)).toEqual([
      abs('skills', 'pdf'),
    ]);
  });

  it('also watches every directory holding a discovered skill', () => {
    const roots = watchRoots(['skills'], [join('skills', 'pdf', 'SKILL.md')], cwd);
    expect(roots).toContain(abs('skills'));
    expect(roots).toContain(abs('skills', 'pdf'));
  });

  it('deduplicates and sorts for stable registration', () => {
    const roots = watchRoots(
      ['skills', 'skills'],
      [join('skills', 'a', 'SKILL.md'), join('skills', 'a', 'SKILL.md')],
      cwd,
    );
    expect(roots).toEqual([...new Set(roots)].sort());
  });

  it('accepts an absolute path argument unchanged', () => {
    expect(watchRoots([abs('skills')], [], cwd)).toEqual([abs('skills')]);
  });
});

describe('createWatcher', () => {
  let dir: string;
  let watcher: Watcher | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skillspec-watch-'));
  });

  afterEach(() => {
    watcher?.close();
    watcher = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it('calls back when a SKILL.md changes', async () => {
    const skillDir = join(dir, 'pdf-tools');
    mkdirSync(skillDir);
    const file = join(skillDir, 'SKILL.md');
    writeFileSync(file, 'one');

    let calls = 0;
    watcher = createWatcher(
      [dir, skillDir],
      () => {
        calls++;
      },
      { debounceMs: 20 },
    );

    // Keep writing until the callback fires. fs.watch does not guarantee the
    // watch is armed by the time createWatcher returns — on macOS a recursive
    // watch goes through FSEvents and takes a moment to register — so a single
    // write here races the watcher and is sometimes missed.
    let n = 0;
    await vi.waitFor(
      () => {
        writeFileSync(file, `two-${n++}`);
        expect(calls).toBeGreaterThan(0);
      },
      { timeout: 3000, interval: 50 },
    );
  });

  it('reports whether the platform gave it a recursive watch', () => {
    watcher = createWatcher([dir], () => undefined);
    expect(typeof watcher.recursive).toBe('boolean');
  });

  it('skips a root that does not exist instead of throwing', () => {
    expect(() => {
      watcher = createWatcher([join(dir, 'absent')], () => undefined);
    }).not.toThrow();
  });

  it('close is idempotent', () => {
    watcher = createWatcher([dir], () => undefined);
    watcher.close();
    expect(() => watcher?.close()).not.toThrow();
  });

  it('stops calling back once closed', async () => {
    const file = join(dir, 'SKILL.md');
    writeFileSync(file, 'one');

    let calls = 0;
    const w = createWatcher(
      [dir],
      () => {
        calls++;
      },
      { debounceMs: 10 },
    );
    w.close();

    writeFileSync(file, 'two');
    await new Promise((r) => setTimeout(r, 150));
    expect(calls).toBe(0);
  });
});
