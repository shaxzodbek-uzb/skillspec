# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
