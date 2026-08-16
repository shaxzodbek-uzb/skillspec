# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-08-16

### Added
- **`--watch` / `-w`** — re-lint on save and keep running, so writing a skill is
  a tight loop instead of a re-run of the whole command after every edit.
- Changes are debounced, so one editor save that touches several files produces
  one re-lint rather than a burst.
- Only relevant files retrigger a run: `SKILL.md` and the files a skill actually
  references. Editor swap files, `.git`, and `node_modules` are ignored, so an
  editor's own write traffic doesn't spin the watcher.
- Recursive directory watching where the platform supports it. The first failure
  is taken as "no recursive watch here" and every root is registered flat
  instead — one honest fallback rather than a per-root mix that is harder to
  explain. A watch root that vanishes is skipped, not thrown on.
- `--max-warnings <n>` and `--quiet`, which pair with `--watch` but work in a
  single run too.

## [0.1.0] - 2026-06-20

Initial release.

### Added

- Linter for Claude Agent `SKILL.md` files, encoding Anthropic's published spec
  (verified 2026-06-20) as data in `src/spec.ts`.
- 27 rules across structure, naming, description quality, body budgets,
  frontmatter keys, encoding, and cross‑skill concerns (duplicate names,
  trigger collisions).
- `claude-code` (default) and `standard` presets.
- CLI (`skillspec`) with `pretty`, `json`, `github`, and `sarif` reporters,
  `--fix` for mechanical issues, per‑rule overrides, and `--max-warnings`.
- Native node20 GitHub Action with inline annotations, a job summary, SARIF, and
  `error-count` / `warning-count` / `file-count` outputs.
- Zero‑config discovery with optional `.skillspecrc.json` / `package.json#skillspec`.
- Programmatic API (`lintFiles`, `lintText`, `parseSkill`, reporters, …).

[Unreleased]: https://github.com/shaxzodbek-uzb/skillspec/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/shaxzodbek-uzb/skillspec/releases/tag/v0.1.0
