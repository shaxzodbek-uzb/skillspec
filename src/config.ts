import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Options } from './types.js';
import type { Preset } from './spec.js';

/** Config object shape: lint options plus an optional preset selector. */
export type SkillspecConfig = Options & { preset?: Preset };

export interface LoadedConfig {
  config: SkillspecConfig;
  /** Path the config was read from, or null when no config was found. */
  path: string | null;
}

const CONFIG_FILES = ['.skillspecrc', '.skillspecrc.json', 'skillspec.config.json'];

function readJson(path: string): unknown {
  const raw = readFileSync(path, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse config at ${path}: ${(err as Error).message}`);
  }
}

/**
 * Find and load configuration. With an explicit path, that file is used.
 * Otherwise walks up from `cwd` looking for a `.skillspecrc[.json]`,
 * `skillspec.config.json`, or a `skillspec` field in `package.json`.
 * Returns empty options when nothing is found — skillspec is zero-config.
 */
export function loadConfig(explicitPath?: string, cwd: string = process.cwd()): LoadedConfig {
  if (explicitPath) {
    return { config: readJson(explicitPath) as SkillspecConfig, path: explicitPath };
  }

  let dir = cwd;
  for (;;) {
    for (const name of CONFIG_FILES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        return { config: readJson(candidate) as SkillspecConfig, path: candidate };
      }
    }
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = readJson(pkgPath) as { skillspec?: SkillspecConfig };
      if (pkg && typeof pkg === 'object' && pkg.skillspec) {
        return { config: pkg.skillspec, path: pkgPath };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return { config: {}, path: null };
    dir = parent;
  }
}
