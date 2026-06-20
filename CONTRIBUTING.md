# Contributing to skillspec

Thanks for helping make Claude skills more discoverable!

## Development

```bash
npm install        # also builds dist/ via the prepare hook
npm run dev        # rebuild on change (tsup --watch)
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # bundle dist/ (CLI, library, and the Action entry)
npm run self       # run skillspec on its own examples/
```

The project is small and deliberately low‑dependency (one runtime dependency: `yaml`).

## Project layout

- `src/spec.ts` — **the encoded Anthropic spec.** Limits, the known‑key sets, presets. When Anthropic changes a constraint, update this file and bump `SPEC_VERIFIED`.
- `src/parse.ts` — turns a `SKILL.md` string into a `SkillDoc` (no filesystem).
- `src/rules/` — one file per concern; each exports an array of rules.
- `src/reporters/` — `pretty`, `json`, `github`, `sarif`.
- `src/cli.ts` / `src/action.ts` — thin wrappers over the library.

## Adding a rule

1. Add it to the right file under `src/rules/` as a `Rule` (or `SetRule`) with a stable kebab‑case `id`, a one‑line `description`, and a `defaultSeverity`.
2. Add it to the table in `README.md`.
3. Add tests in `test/rules.test.ts` (a violating fixture and, where relevant, a passing one).
4. Keep finding messages **single‑line** and actionable — say what's wrong and how to fix it.

## Before you open a PR

- `npm run build` and **commit `dist/`** — the GitHub Action runs the committed bundle, and CI fails if `dist/` is out of date.
- `npm run format` (Prettier) and `npm test` must pass.
- New behavior needs a test.

By contributing you agree your work is licensed under the project's [MIT License](LICENSE).
