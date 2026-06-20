# skillspec

> Lint your Claude Agent **`SKILL.md`** files against Anthropic's _exact_ spec — frontmatter, naming, description trigger‑quality, and token budgets — in your editor, on the CLI, and in CI.

[![npm](https://img.shields.io/npm/v/skillspec.svg)](https://www.npmjs.com/package/skillspec)
[![CI](https://github.com/shaxzodbek-uzb/skillspec/actions/workflows/ci.yml/badge.svg)](https://github.com/shaxzodbek-uzb/skillspec/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/skillspec.svg)](LICENSE)
[![node](https://img.shields.io/node/v/skillspec.svg)](package.json)

A skill that Claude never loads is invisible. The difference is almost always in the **frontmatter** — a `name` that doesn't match its directory, a `description` that says _what_ but never _when_, a typo'd `allowed_tools`, a body that blows the token budget. These don't error loudly; they just quietly stop the skill from triggering.

`skillspec` catches them. It encodes Anthropic's published Agent Skills constraints as data and checks your skills against **the real spec** — not a community guess — and it's updated when Anthropic changes the spec.

```bash
npx skillspec
```

No config, no init. It finds every `SKILL.md` under the current directory and tells you exactly what's wrong and where.

---

## Example

```text
skills/pdf-tools/SKILL.md
  2:1   error    `name` "pdf" does not match the parent directory "pdf-tools". The spec requires them to be identical.  name-matches-dir
  3:1   warning  No trigger cue found in `description`. Add when to use it, e.g. "Use when the user …".  description-trigger
  4:1   warning  Unknown frontmatter key "allowed_tools". Did you mean "allowed-tools"?  unknown-frontmatter-key
  7:1   error    The body is empty. After the frontmatter, add the instructions Claude should follow.  body-present

✖ 4 problems (2 errors, 2 warnings) across 1 skill
```

Exit code `0` when clean, `1` when problems are found, `2` on a usage error — ready for a pre‑commit hook or CI gate.

---

## Why skillspec

There are several skill linters now. `skillspec` is opinionated about three things the others under‑serve:

- **Spec fidelity.** Every limit comes straight from Anthropic's docs and the [Agent Skills standard](https://agentskills.io/specification): `name` ≤ 64 chars with the exact charset and the reserved‑word ban (`anthropic`/`claude`), `description` 1–1024 chars with no XML tags, the ~5,000‑token Level‑2 body budget, `name` must equal the directory. The encoded spec is dated and version‑tracked (`skillspec --rules` shows the verification date).
- **Discoverability, not just validity.** A schema‑valid skill can still be undiscoverable. `skillspec` flags descriptions that state _what_ but not _when_, first/second‑person phrasing (the description is injected into the system prompt), thin descriptions, and **trigger collisions** — two skills whose descriptions overlap so much Claude can't tell them apart.
- **Frictionless CI.** Truly zero‑config, stable machine‑readable rule IDs, a first‑class GitHub Action that posts inline PR annotations and a job summary, SARIF output for the Security tab, and `--fix` for the mechanical stuff.

---

## What it checks

Run `skillspec --rules` for the live list. Defaults:

| Rule                       | Default | Checks                                                               |
| -------------------------- | ------- | -------------------------------------------------------------------- |
| `frontmatter-present`      | error   | File opens with a `---` … `---` block                                |
| `frontmatter-valid`        | error   | Frontmatter is a YAML mapping that parses                            |
| `filename`                 | error   | File is named exactly `SKILL.md`                                     |
| `name-required`            | error¹  | `name` is present                                                    |
| `name-format`              | error   | Lowercase, digits, single hyphens; no leading/trailing/double hyphen |
| `name-length`              | error   | `name` ≤ 64 characters                                               |
| `name-matches-dir`         | error   | `name` equals the parent directory                                   |
| `name-reserved`            | error   | No `anthropic`/`claude`, no XML tags                                 |
| `description-required`     | error   | `description` present and non‑empty                                  |
| `description-length`       | error   | `description` ≤ 1024 characters                                      |
| `description-min-length`   | warning | `description` is substantial enough to match on                      |
| `description-trigger`      | warning | States _when_ to use the skill, not only what                        |
| `description-third-person` | warning | Written in third person (no "I"/"you")                               |
| `description-no-xml`       | warning | No XML/HTML tags (the API rejects them)                              |
| `body-present`             | error   | Non‑empty instructions after the frontmatter                         |
| `body-max-lines`           | warning | Body under ~500 lines                                                |
| `body-token-budget`        | warning | Body within the ~5,000‑token budget (estimate)                       |
| `unknown-frontmatter-key`  | warning | Only recognized keys (with "did you mean?" hints)                    |
| `allowed-tools-format`     | warning | `allowed-tools` is a string or list (catches `allowed_tools`)        |
| `compatibility-length`     | warning | `compatibility` ≤ 500 characters                                     |
| `metadata-type`            | warning | `metadata` is a string‑valued mapping                                |
| `version-placement`        | warning | `version` lives under `metadata`, not top‑level                      |
| `duplicate-name`           | error   | No two skills share a name                                           |
| `trigger-collision`        | warning | No two descriptions overlap enough to confuse Claude                 |

¹ `name-required` is an **error** under the `standard` preset and a **warning** under `claude-code` (where `name` defaults to the directory name).

---

## GitHub Action

Add a job that fails the build on broken skills and annotates the PR diff inline:

```yaml
name: Lint skills
on: [push, pull_request]

jobs:
  skillspec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: shaxzodbek-uzb/skillspec@v1
        with:
          paths: skills # optional; default discovers every SKILL.md
          fail-on-warnings: false
```

| Input              | Default       | Description                                                             |
| ------------------ | ------------- | ----------------------------------------------------------------------- |
| `paths`            | `''`          | Files/dirs to lint (comma‑ or newline‑separated). Empty = discover all. |
| `preset`           | `claude-code` | `claude-code` or `standard`.                                            |
| `rules`            | `''`          | Severity overrides, e.g. `name-format:off, body-max-lines:error`.       |
| `max-warnings`     | `-1`          | Fail if warnings exceed this number.                                    |
| `fail-on-warnings` | `false`       | Fail on any warning.                                                    |

Outputs: `error-count`, `warning-count`, `file-count`. The action writes a Markdown summary to the job page and inline annotations to the diff.

**Code scanning (SARIF):**

```yaml
- uses: shaxzodbek-uzb/skillspec@v1 # annotations + gate
- run: npx skillspec --format sarif > skillspec.sarif
  if: always()
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with: { sarif_file: skillspec.sarif }
```

---

## Presets

```bash
npx skillspec --preset claude-code   # default: name optional, all Claude Code keys recognized
npx skillspec --preset standard      # agentskills.io open standard: name required, core keys only
```

Use `standard` to validate skills you intend to publish for any agent runtime; use `claude-code` (default) for skills living in `.claude/skills`.

---

## Configuration

`skillspec` is zero‑config. To tune it, add a `.skillspecrc.json`, a `skillspec.config.json`, or a `skillspec` key in `package.json`:

```json
{
  "preset": "claude-code",
  "rules": {
    "description-third-person": "off",
    "body-max-lines": "error"
  },
  "bodyMaxLines": 400,
  "ignore": ["**/fixtures/**"]
}
```

Override a rule once from the CLI:

```bash
npx skillspec --rule description-trigger:off --max-warnings 0
```

Full flag list: `npx skillspec --help`.

---

## Programmatic API

```ts
import { lintFiles, lintText, formatResult } from 'skillspec';

// From disk
const result = lintFiles(['skills'], { preset: 'standard' });
console.log(formatResult('pretty', result, { color: true }));

// From a string (editor extensions, tests)
const findings = lintText('skills/pdf/SKILL.md', fileContents);
```

Everything the CLI uses is exported: `parseSkill`, `resolveOptions`, `RULES`, `SET_RULES`, the reporters, and the encoded `LIMITS`/`PRESETS`.

---

## Related

`skillspec` deliberately focuses on spec‑fidelity and discoverability. For adjacent needs, [`skill-lint`](https://github.com/LichAmnesia/skill-lint) scans skills for security/supply‑chain risks and [`claudelint`](https://github.com/pdugan20/claudelint) lints whole Claude Code projects. They compose well with a `skillspec` gate.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The spec lives in [`src/spec.ts`](src/spec.ts); when Anthropic changes a limit, that's the one file to update.

## License

[MIT](LICENSE) © 2026 Shaxzodbek Qambaraliyev / Blaze
