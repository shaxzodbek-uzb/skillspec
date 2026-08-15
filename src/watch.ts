/**
 * File watching for `skillspec --watch`.
 *
 * Zero dependencies, so it uses `node:fs.watch` directly. That comes with one real
 * constraint: recursive watching is not available on every platform Node 18 runs on
 * (Linux only gained it in Node 20.13). Rather than pretend otherwise, the watcher
 * probes for it and falls back to watching each skill directory individually — and
 * reports which mode it is in, because the fallback cannot see a *brand new* skill
 * directory until the next run re-registers.
 *
 * The debounce and relevance logic are separated from `fs.watch` so they can be tested
 * without touching the filesystem.
 */

import { watch, type FSWatcher } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';

/** Editors write a file in several steps; coalesce the burst into one run. */
export const DEFAULT_DEBOUNCE_MS = 120;

/** A change is relevant when it could alter what the linter sees. */
export function isRelevantChange(filename: string | null): boolean {
  // Some platforms report no filename. Assume relevance rather than miss an edit.
  if (filename === null || filename === '') return true;
  const base = filename.split(/[\\/]/).pop() ?? filename;
  if (/^skill\.md$/i.test(base)) return true;
  // Editors write through temp/swap files whose final rename we would otherwise
  // see as an unrelated name; treat anything without an extension as a directory
  // event, which may be a new skill folder.
  if (!base.includes('.')) return true;
  return false;
}

export interface Debouncer {
  trigger(): void;
  cancel(): void;
}

/** Call `fn` once, `ms` after the last `trigger()`. */
export function createDebouncer(fn: () => void, ms: number = DEFAULT_DEBOUNCE_MS): Debouncer {
  let timer: NodeJS.Timeout | undefined;
  return {
    trigger() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, ms);
      // Don't hold the process open on the debounce alone; the watchers do that.
      timer.unref?.();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}

/**
 * The directories to watch for a given set of CLI paths.
 *
 * A file argument contributes its containing directory — watching a single file misses
 * the atomic-rename pattern most editors use to save.
 */
export function watchRoots(paths: string[], files: string[], cwd: string): string[] {
  const roots = new Set<string>();
  const abs = (p: string): string => (isAbsolute(p) ? p : join(cwd, p));

  if (paths.length === 0) {
    roots.add(cwd);
  } else {
    for (const p of paths) {
      const full = abs(p);
      roots.add(/\.md$/i.test(full) ? dirname(full) : full);
    }
  }
  // Also watch every directory that currently holds a skill, so the non-recursive
  // fallback still sees edits to files nested below a root.
  for (const file of files) roots.add(dirname(abs(file)));
  return [...roots].sort();
}

export interface Watcher {
  /** True when the platform supported a single recursive watch per root. */
  recursive: boolean;
  close(): void;
}

/**
 * Watch `roots` and call `onChange` (debounced) when anything relevant changes.
 *
 * Unreadable or vanished directories are skipped rather than throwing: a watch root
 * can disappear between discovery and registration.
 */
export function createWatcher(
  roots: string[],
  onChange: () => void,
  options: { debounceMs?: number } = {},
): Watcher {
  const debounced = createDebouncer(onChange, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  const watchers: FSWatcher[] = [];
  let recursive = true;

  const add = (dir: string, useRecursive: boolean): boolean => {
    try {
      const w = watch(dir, { recursive: useRecursive }, (_event, filename) => {
        if (isRelevantChange(typeof filename === 'string' ? filename : null)) debounced.trigger();
      });
      // A watcher that errors later (deleted directory) must not crash the process.
      w.on('error', () => undefined);
      watchers.push(w);
      return true;
    } catch {
      return false;
    }
  };

  for (const root of roots) {
    if (recursive && add(root, true)) continue;
    // The first failure is taken as "this platform has no recursive watch" and every
    // root is then registered flat. Probing per-root would give a mixed mode that is
    // harder to explain than a single honest fallback.
    recursive = false;
    add(root, false);
  }

  return {
    recursive,
    close() {
      debounced.cancel();
      for (const w of watchers) {
        try {
          w.close();
        } catch {
          // already closed
        }
      }
      watchers.length = 0;
    },
  };
}
