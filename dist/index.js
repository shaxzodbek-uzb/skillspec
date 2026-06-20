// src/lint.ts
import { readFileSync } from "fs";

// src/parse.ts
import { basename, dirname, resolve } from "path";
import { parseDocument, isMap, isScalar } from "yaml";
var BOM = "\uFEFF";
function lineAt(text, offset) {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}
function parseSkill(file, rawInput) {
  const hadBom = rawInput.startsWith(BOM);
  const raw = hadBom ? rawInput.slice(BOM.length) : rawInput;
  const hasCrlf = raw.includes("\r\n");
  const dir = dirname(resolve(file));
  const doc = {
    file,
    dir,
    dirName: basename(dir),
    raw,
    hadBom,
    hasCrlf,
    hasFrontmatter: false,
    unterminatedFrontmatter: false,
    frontmatterRaw: null,
    data: null,
    yamlError: null,
    body: raw,
    bodyStartLine: 1,
    keyLines: {}
  };
  const opening = /^---[ \t]*\r?\n/.exec(raw);
  if (!opening) {
    return doc;
  }
  const fmStart = opening[0].length;
  const afterOpen = raw.slice(fmStart);
  const closeMatch = /(^|\n)(---|\.\.\.)[ \t]*(\r?\n|$)/.exec(afterOpen);
  if (!closeMatch) {
    doc.unterminatedFrontmatter = true;
    doc.body = afterOpen;
    doc.bodyStartLine = lineAt(raw, fmStart);
    return doc;
  }
  const leadingNewline = closeMatch[1] ?? "";
  const fmEnd = fmStart + closeMatch.index + leadingNewline.length;
  const frontmatterRaw = raw.slice(fmStart, fmEnd).replace(/\r\n/g, "\n");
  const fenceLineLen = closeMatch[0].length - leadingNewline.length;
  const bodyOffset = fmEnd + fenceLineLen;
  const body = raw.slice(bodyOffset);
  doc.hasFrontmatter = true;
  doc.frontmatterRaw = frontmatterRaw;
  doc.body = body;
  doc.bodyStartLine = lineAt(raw, bodyOffset);
  const fmBaseLine = raw.slice(0, fmStart).match(/\n/g)?.length ?? 0;
  const fileLine = (offset) => fmBaseLine + lineAt(frontmatterRaw, offset);
  const parsed = parseDocument(frontmatterRaw, { prettyErrors: false });
  if (parsed.errors.length > 0) {
    const err = parsed.errors[0];
    const relOffset = err.pos?.[0] ?? 0;
    doc.yamlError = {
      message: err.message.replace(/\s+at line \d+.*$/s, ""),
      line: fileLine(relOffset)
    };
    return doc;
  }
  const contents = parsed.contents;
  if (contents == null) {
    doc.data = {};
    return doc;
  }
  if (!isMap(contents)) {
    doc.data = {};
    doc.yamlError = {
      message: "frontmatter must be a YAML mapping of key: value pairs",
      line: fmBaseLine + 1
    };
    return doc;
  }
  const data = {};
  const asJs = parsed.toJS({ maxAliasCount: 100 });
  for (const item of contents.items) {
    const keyNode = item.key;
    if (!isScalar(keyNode)) continue;
    const key = String(keyNode.value);
    data[key] = asJs?.[key];
    const start = keyNode.range?.[0];
    if (typeof start === "number") {
      doc.keyLines[key] = fileLine(start);
    }
  }
  doc.data = data;
  return doc;
}

// src/rules/frontmatter.ts
import { basename as basename2 } from "path";
var frontmatterRules = [
  {
    id: "frontmatter-present",
    description: "SKILL.md must open with a `---` \u2026 `---` YAML frontmatter block.",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.hasFrontmatter) return;
      if (doc.unterminatedFrontmatter) {
        report(
          "Frontmatter is opened with `---` but never closed. Add a closing `---` on its own line.",
          { line: 1 }
        );
        return;
      }
      report(
        "No YAML frontmatter found. A skill must begin with a `---` block declaring at least `name` and `description`.",
        { line: 1 }
      );
    }
  },
  {
    id: "frontmatter-valid",
    description: "The frontmatter must be a YAML mapping that parses without errors.",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (!doc.hasFrontmatter || !doc.yamlError) return;
      report(`Frontmatter is not valid YAML: ${doc.yamlError.message}`, {
        line: doc.yamlError.line ?? 1,
        column: doc.yamlError.column
      });
    }
  },
  {
    id: "filename",
    description: "The skill file must be named exactly `SKILL.md` (uppercase).",
    defaultSeverity: "error",
    check(doc, _options, report) {
      const name = basename2(doc.file);
      if (name === "SKILL.md") return;
      if (name.toLowerCase() === "skill.md") {
        report(`Skill file must be named "SKILL.md", found "${name}".`, { line: 1 });
      }
    }
  },
  {
    id: "no-bom",
    description: "The file must not start with a UTF-8 byte-order mark.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.hadBom) {
        report(
          "File starts with a UTF-8 BOM, which pushes the opening `---` off byte 0 and breaks frontmatter detection in some tools. (fixable: --fix)",
          { line: 1 }
        );
      }
    }
  },
  {
    id: "line-endings",
    description: "Prefer LF line endings over CRLF.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.hasCrlf) {
        report("File uses CRLF line endings; prefer LF. (fixable: --fix)", { line: 1 });
      }
    }
  },
  {
    id: "final-newline",
    description: "The file should end with a single trailing newline.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.raw.length > 0 && !doc.raw.endsWith("\n")) {
        report("Missing final newline at end of file. (fixable: --fix)");
      }
    }
  }
];
var FIXABLE_RULES = ["no-bom", "line-endings", "final-newline"];

// src/spec.ts
var SPEC_VERIFIED = "2026-06-20";
var LIMITS = {
  /** `name`: 1–64 characters. */
  nameMaxLength: 64,
  /** `description`: 1–1024 characters (counted as Unicode code points). */
  descriptionMaxLength: 1024,
  /** `compatibility`: 1–500 characters when present. */
  compatibilityMaxLength: 500,
  /** Recommended SKILL.md body cap: "under 500 lines". */
  bodyMaxLines: 500,
  /** Recommended Level-2 body budget: "under ~5,000 tokens". */
  bodyTokenBudget: 5e3
};
var NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
var RESERVED_NAME_WORDS = ["anthropic", "claude"];
var XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;
var OPEN_STANDARD_KEYS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools"
];
var CLAUDE_CODE_KEYS = [
  ...OPEN_STANDARD_KEYS,
  "when_to_use",
  "disable-model-invocation",
  "user-invocable",
  "disallowed-tools",
  "model",
  "effort",
  "context",
  "agent",
  "argument-hint",
  "arguments",
  "hooks",
  "paths",
  "shell"
];
var KEY_TYPOS = {
  allowed_tools: "allowed-tools",
  allowedtools: "allowed-tools",
  "allow-tools": "allowed-tools",
  tools: "allowed-tools",
  disallowed_tools: "disallowed-tools",
  "disallow-tools": "disallowed-tools",
  when_to_use_when: "when_to_use",
  "when-to-use": "when_to_use",
  whentouse: "when_to_use",
  argument_hint: "argument-hint",
  argumenthint: "argument-hint",
  user_invocable: "user-invocable",
  disable_model_invocation: "disable-model-invocation",
  desc: "description",
  summary: "description",
  title: "name"
};
var PRESETS = {
  "claude-code": {
    knownKeys: CLAUDE_CODE_KEYS,
    severities: { "name-required": "warning" }
  },
  standard: {
    knownKeys: OPEN_STANDARD_KEYS,
    severities: {}
  }
};
var DEFAULT_PRESET = "claude-code";

// src/tokens.ts
function estimateTokens(text) {
  if (text.length === 0) return 0;
  const chars = [...text].length;
  const words = text.match(/\S+/g)?.length ?? 0;
  const byChars = Math.ceil(chars / 4);
  const byWords = Math.ceil(words * 1.3);
  return Math.max(byChars, byWords);
}
function charLength(text) {
  return [...text].length;
}

// src/util.ts
function asString(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}
function normalizeText(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
function wordJaccard(a, b) {
  const sa = new Set(normalizeText(a).split(" ").filter(Boolean));
  const sb = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// src/rules/name.ts
var nameRules = [
  {
    id: "name-required",
    description: "`name` should be present (required by the Agent Skills standard and the Claude API).",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data["name"]);
      if (name === null || name.trim() === "") {
        report(
          "`name` is missing. It is required by the Agent Skills standard and the Claude API; Claude Code defaults it to the directory name.",
          { line: doc.keyLines["name"] }
        );
      }
    }
  },
  {
    id: "name-format",
    description: "`name` must be lowercase letters, digits and single hyphens (no leading/trailing/double hyphens).",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data["name"]);
      if (name === null || name.trim() === "") return;
      if (!NAME_PATTERN.test(name)) {
        report(
          `\`name\` "${name}" must use only lowercase letters, digits and single hyphens, with no leading, trailing, or consecutive hyphens.`,
          { line: doc.keyLines["name"] }
        );
      }
    }
  },
  {
    id: "name-length",
    description: "`name` must be at most 64 characters.",
    defaultSeverity: "error",
    check(doc, options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data["name"]);
      if (name === null) return;
      const len = charLength(name);
      if (len > options.nameMaxLength) {
        report(`\`name\` is ${len} characters; the maximum is ${options.nameMaxLength}.`, {
          line: doc.keyLines["name"]
        });
      }
    }
  },
  {
    id: "name-matches-dir",
    description: "`name` must match the parent directory name.",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data["name"]);
      if (name === null || name.trim() === "") return;
      if (name !== doc.dirName) {
        report(
          `\`name\` "${name}" does not match the parent directory "${doc.dirName}". The spec requires them to be identical.`,
          { line: doc.keyLines["name"] }
        );
      }
    }
  },
  {
    id: "name-reserved",
    description: '`name` must not contain the reserved words "anthropic" or "claude", or XML tags.',
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const name = asString(doc.data["name"]);
      if (name === null) return;
      const lower = name.toLowerCase();
      for (const word of RESERVED_NAME_WORDS) {
        if (lower.includes(word)) {
          report(
            `\`name\` contains the reserved word "${word}". The Claude API rejects skill names containing "anthropic" or "claude".`,
            { line: doc.keyLines["name"] }
          );
        }
      }
      if (XML_TAG_PATTERN.test(name)) {
        report("`name` must not contain XML/HTML tags.", { line: doc.keyLines["name"] });
      }
    }
  }
];

// src/rules/description.ts
var PERSON_MARKERS = /\b(i'?m|i'?ll|i'?ve|i can|i will|you'?ll|you'?re|you can|you should|let'?s|let me|use me)\b/i;
var BARE_PRONOUNS = /\b(i|we|our|us|my|me|your|you)\b/i;
var SENTENCE_INITIAL_PRONOUN = /^(I|We|Our|Us|My|Me|Your|You)$/;
function findPersonMarker(desc) {
  const marker = PERSON_MARKERS.exec(desc);
  if (marker) return marker[0];
  const bare = BARE_PRONOUNS.exec(desc);
  if (!bare) return null;
  if (bare[0] === bare[0].toLowerCase()) return bare[0];
  const after = desc[bare.index + bare[0].length];
  const sentenceInitial = bare.index === 0 && SENTENCE_INITIAL_PRONOUN.test(bare[0]) && (after === void 0 || /\s/.test(after));
  return sentenceInitial ? bare[0] : null;
}
var TRIGGER_CUES = /\b(use (this|when|it|for)|when |whenever|trigger|triggers|if the user|for (creating|editing|reading|working|building|generating|analy|converting|processing|handling)|ideal for|helpful when|applies when|invoke|activate)\b/i;
var descriptionRules = [
  {
    id: "description-required",
    description: "`description` must be present and non-empty.",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null || desc.trim() === "") {
        report(
          "`description` is missing or empty. It is required (1\u20131024 chars) and is the only thing Claude reads to decide whether to load the skill.",
          { line: doc.keyLines["description"] }
        );
      }
    }
  },
  {
    id: "description-length",
    description: "`description` must be at most 1024 characters.",
    defaultSeverity: "error",
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null) return;
      const len = charLength(desc);
      if (len > options.descriptionMaxLength) {
        report(
          `\`description\` is ${len} characters; the maximum is ${options.descriptionMaxLength}. Move detail into the body and keep the description to its trigger.`,
          { line: doc.keyLines["description"] }
        );
      }
    }
  },
  {
    id: "description-min-length",
    description: "`description` should be substantial enough to trigger reliably.",
    defaultSeverity: "warning",
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null || desc.trim() === "") return;
      const len = charLength(desc.trim());
      if (len < options.descriptionMinLength) {
        report(
          `\`description\` is only ${len} characters \u2014 too thin for Claude to match reliably. Say what the skill does and when to use it.`,
          { line: doc.keyLines["description"] }
        );
      }
    }
  },
  {
    id: "description-trigger",
    description: "`description` should state *when* to use the skill, not only what it does.",
    defaultSeverity: "warning",
    check(doc, options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null) return;
      const trimmed = desc.trim();
      if (charLength(trimmed) < options.descriptionMinLength) return;
      if (!TRIGGER_CUES.test(trimmed)) {
        report(
          'No trigger cue found in `description`. Add when to use it, e.g. "Use when the user \u2026", so Claude knows when to load the skill.',
          { line: doc.keyLines["description"] }
        );
      }
    }
  },
  {
    id: "description-third-person",
    description: "`description` must be written in the third person (it is injected into the system prompt).",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null) return;
      const marker = findPersonMarker(desc);
      if (marker) {
        report(
          `\`description\` reads as first/second person ("${marker}"). Write it in the third person, e.g. "Extracts \u2026. Use when the user \u2026".`,
          { line: doc.keyLines["description"] }
        );
      }
    }
  },
  {
    id: "description-no-xml",
    description: "`description` must not contain XML/HTML tags (the Claude API rejects them).",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.data == null) return;
      const desc = asString(doc.data["description"]);
      if (desc === null) return;
      if (XML_TAG_PATTERN.test(desc)) {
        report("`description` contains an XML/HTML tag, which the Claude API rejects.", {
          line: doc.keyLines["description"]
        });
      }
    }
  }
];

// src/rules/body.ts
var bodyRules = [
  {
    id: "body-present",
    description: "The SKILL.md body (instructions after the frontmatter) must not be empty.",
    defaultSeverity: "error",
    check(doc, _options, report) {
      if (!doc.hasFrontmatter) return;
      if (doc.body.trim() === "") {
        report(
          "The body is empty. After the frontmatter, add the instructions Claude should follow when the skill is loaded.",
          { line: doc.bodyStartLine }
        );
      }
    }
  },
  {
    id: "body-max-lines",
    description: "Keep the SKILL.md body under ~500 lines; move detail into linked files.",
    defaultSeverity: "warning",
    check(doc, options, report) {
      const lines = doc.body.replace(/\n$/, "").split("\n").length;
      if (doc.body.trim() !== "" && lines > options.bodyMaxLines) {
        report(
          `Body is ${lines} lines; Anthropic recommends under ${options.bodyMaxLines}. Split detail into reference files and link them (progressive disclosure).`,
          { line: doc.bodyStartLine }
        );
      }
    }
  },
  {
    id: "body-token-budget",
    description: "Keep the SKILL.md body within the ~5,000-token Level-2 budget (approximate).",
    defaultSeverity: "warning",
    check(doc, options, report) {
      if (doc.body.trim() === "") return;
      const tokens = estimateTokens(doc.body);
      if (tokens > options.bodyTokenBudget) {
        report(
          `Body is ~${tokens} tokens (estimate); the recommended Level-2 budget is ~${options.bodyTokenBudget}. Trim it or move detail into on-demand reference files.`,
          { line: doc.bodyStartLine }
        );
      }
    }
  }
];

// src/rules/keys.ts
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
var keyRules = [
  {
    id: "unknown-frontmatter-key",
    description: "Frontmatter keys outside the recognized set are flagged (some clients reject them).",
    defaultSeverity: "warning",
    check(doc, options, report) {
      if (doc.data == null) return;
      const known = new Set(options.knownKeys);
      for (const key of Object.keys(doc.data)) {
        if (key === "version" || known.has(key)) continue;
        const suggestion = KEY_TYPOS[key] ?? KEY_TYPOS[key.toLowerCase()];
        const hint = suggestion && known.has(suggestion) ? ` Did you mean "${suggestion}"?` : "";
        report(`Unknown frontmatter key "${key}".${hint}`, { line: doc.keyLines[key] });
      }
    }
  },
  {
    id: "allowed-tools-format",
    description: "`allowed-tools` must be a space-separated string or a YAML list.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!("allowed-tools" in doc.data)) return;
      const value = doc.data["allowed-tools"];
      const ok = typeof value === "string" || Array.isArray(value) && value.every((v) => typeof v === "string");
      const line = doc.keyLines["allowed-tools"];
      if (!ok) {
        report(
          '`allowed-tools` should be a space-separated string (e.g. "Bash(git:*) Read") or a YAML list of strings.',
          { line }
        );
      } else if (typeof value === "string" && value.trim() === "") {
        report("`allowed-tools` is empty; remove it or list the tools to pre-approve.", { line });
      } else if (typeof value === "string" && value.includes(",")) {
        report(
          '`allowed-tools` looks comma-separated; tools must be space-separated (e.g. "Bash(git:*) Read"). Commas become part of the tool name.',
          { line }
        );
      }
    }
  },
  {
    id: "compatibility-length",
    description: "`compatibility` must be within the spec character limit.",
    defaultSeverity: "warning",
    check(doc, options, report) {
      if (doc.data == null) return;
      const value = doc.data["compatibility"];
      if (typeof value !== "string") return;
      const len = charLength(value);
      if (len > options.compatibilityMaxLength) {
        report(
          `\`compatibility\` is ${len} characters; the maximum is ${options.compatibilityMaxLength}.`,
          { line: doc.keyLines["compatibility"] }
        );
      }
    }
  },
  {
    id: "metadata-type",
    description: "`metadata` must be a mapping of string keys to string values.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!("metadata" in doc.data)) return;
      const value = doc.data["metadata"];
      if (!isPlainObject(value)) {
        report("`metadata` must be a mapping (key: value pairs), not a list or scalar.", {
          line: doc.keyLines["metadata"]
        });
        return;
      }
      for (const [k, v] of Object.entries(value)) {
        if (typeof v !== "string") {
          const got = v === null ? "null" : Array.isArray(v) ? "list" : typeof v;
          report(
            `\`metadata.${k}\` must be a string value (got ${got}); the spec defines metadata as a string-valued mapping. Quote it, e.g. version: "1.0".`,
            { line: doc.keyLines["metadata"] }
          );
        }
      }
    }
  },
  {
    id: "version-placement",
    description: "`version` is not a top-level field; it belongs under `metadata`.",
    defaultSeverity: "warning",
    check(doc, _options, report) {
      if (doc.data == null) return;
      if (!("version" in doc.data)) return;
      report(
        '`version` is not a recognized top-level field. Move it under `metadata` (e.g. `metadata.version: "1.0"`).',
        { line: doc.keyLines["version"] }
      );
    }
  }
];

// src/rules/set.ts
function effectiveName(doc) {
  const name = doc.data ? asString(doc.data["name"]) : null;
  return name && name.trim() !== "" ? name : doc.dirName;
}
var TRIGGER_COLLISION_THRESHOLD = 0.8;
var setRules = [
  {
    id: "duplicate-name",
    description: "No two skills in the set may share the same name.",
    defaultSeverity: "error",
    check(docs, _options, report) {
      const byName = /* @__PURE__ */ new Map();
      for (const doc of docs) {
        const name = effectiveName(doc);
        const list = byName.get(name) ?? [];
        list.push(doc);
        byName.set(name, list);
      }
      for (const [name, group] of byName) {
        if (group.length < 2) continue;
        for (const doc of group) {
          const others = group.filter((d) => d !== doc).map((d) => d.file);
          report(
            doc,
            `Duplicate skill name "${name}" \u2014 also defined by: ${others.join(", ")}. Names must be unique so Claude can address each skill.`,
            { line: doc.keyLines["name"] }
          );
        }
      }
    }
  },
  {
    id: "trigger-collision",
    description: "Two skills with near-identical descriptions compete for the same triggers.",
    defaultSeverity: "warning",
    check(docs, _options, report) {
      const withDesc = docs.map((doc) => ({ doc, desc: doc.data ? asString(doc.data["description"]) : null })).filter((x) => !!x.desc?.trim());
      for (let i = 0; i < withDesc.length; i++) {
        for (let j = i + 1; j < withDesc.length; j++) {
          const a = withDesc[i];
          const b = withDesc[j];
          const sim = wordJaccard(a.desc, b.desc);
          if (sim >= TRIGGER_COLLISION_THRESHOLD) {
            const pct = Math.round(sim * 100);
            report(
              a.doc,
              `\`description\` is ${pct}% similar to "${b.doc.file}" \u2014 their triggers overlap, so Claude may load the wrong skill. Make each description distinct.`,
              { line: a.doc.keyLines["description"] }
            );
          }
        }
      }
    }
  }
];

// src/rules/index.ts
var RULES = [
  ...frontmatterRules,
  ...nameRules,
  ...descriptionRules,
  ...bodyRules,
  ...keyRules
];
var SET_RULES = [...setRules];
var RULE_META = [...RULES, ...SET_RULES].map((r) => ({
  id: r.id,
  description: r.description,
  defaultSeverity: r.defaultSeverity
}));

// src/options.ts
var DEFAULT_IGNORE = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  "vendor",
  ".next",
  ".turbo"
];
function toSeverity(value, fallback) {
  if (value === true) return fallback;
  if (value === false) return "off";
  return value;
}
function resolveOptions(input = {}) {
  const preset = input.preset ?? DEFAULT_PRESET;
  const presetCfg = PRESETS[preset];
  const severities = {};
  for (const meta of RULE_META) severities[meta.id] = meta.defaultSeverity;
  for (const [id, sev] of Object.entries(presetCfg.severities)) severities[id] = sev;
  if (input.rules) {
    for (const [id, value] of Object.entries(input.rules)) {
      severities[id] = toSeverity(value, severities[id] ?? "warning");
    }
  }
  return {
    severities,
    nameMaxLength: input.nameMaxLength ?? LIMITS.nameMaxLength,
    descriptionMaxLength: input.descriptionMaxLength ?? LIMITS.descriptionMaxLength,
    descriptionMinLength: input.descriptionMinLength ?? 20,
    compatibilityMaxLength: input.compatibilityMaxLength ?? LIMITS.compatibilityMaxLength,
    bodyMaxLines: input.bodyMaxLines ?? LIMITS.bodyMaxLines,
    bodyTokenBudget: input.bodyTokenBudget ?? LIMITS.bodyTokenBudget,
    knownKeys: [...presetCfg.knownKeys, ...input.knownKeys ?? []],
    ignore: [...DEFAULT_IGNORE, ...input.ignore ?? []],
    preset
  };
}

// src/discover.ts
import { existsSync, readdirSync, statSync } from "fs";
import { isAbsolute, join, relative } from "path";
var SKILL_FILE = /^skill\.md$/i;
function globToRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/ /g, ".*").replace(/\?/g, "[^/]");
  return new RegExp(`(^|/)${re}(/|$)`);
}
function splitIgnore(ignore) {
  const names = /* @__PURE__ */ new Set();
  const globs = [];
  for (const entry of ignore) {
    if (entry.includes("*") || entry.includes("/") || entry.includes("?")) {
      globs.push(globToRegExp(entry));
    } else {
      names.add(entry);
    }
  }
  return { names, globs };
}
function discoverSkillFiles(paths, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const { names, globs } = splitIgnore(options.ignore ?? []);
  const found = /* @__PURE__ */ new Set();
  const missing = [];
  const ignored = (abs, base) => {
    if (names.has(base)) return true;
    const rel = relative(cwd, abs).split("\\").join("/");
    return globs.some((g) => g.test(rel));
  };
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
        if (ignored(abs, entry.name)) continue;
        walk(abs);
      } else if (entry.isFile() && SKILL_FILE.test(entry.name)) {
        found.add(abs);
      }
    }
  };
  const roots = paths.length > 0 ? paths : [cwd];
  for (const p of roots) {
    const abs = isAbsolute(p) ? p : join(cwd, p);
    if (!existsSync(abs)) {
      missing.push(p);
      continue;
    }
    const st = statSync(abs);
    if (st.isFile()) {
      found.add(abs);
    } else if (st.isDirectory()) {
      walk(abs);
    }
  }
  const files = [...found].map((abs) => {
    const rel = relative(cwd, abs);
    return rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : abs;
  }).sort();
  return { files, missing };
}

// src/lint.ts
function compareFindings(a, b) {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  const la = a.line ?? 0;
  const lb = b.line ?? 0;
  if (la !== lb) return la - lb;
  if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}
function lintDoc(doc, options) {
  const findings = [];
  for (const rule of RULES) {
    const severity = options.severities[rule.id] ?? rule.defaultSeverity;
    if (severity === "off") continue;
    rule.check(doc, options, (message, opts) => {
      findings.push({
        ruleId: rule.id,
        severity,
        message,
        file: doc.file,
        line: opts?.line,
        column: opts?.column,
        data: opts?.data
      });
    });
  }
  return findings;
}
function lintSet(docs, options) {
  const findings = [];
  for (const rule of SET_RULES) {
    const severity = options.severities[rule.id] ?? rule.defaultSeverity;
    if (severity === "off") continue;
    rule.check(docs, options, (doc, message, opts) => {
      findings.push({
        ruleId: rule.id,
        severity,
        message,
        file: doc.file,
        line: opts?.line,
        column: opts?.column,
        data: opts?.data
      });
    });
  }
  return findings;
}
function lintText(file, raw, input = {}) {
  const options = resolveOptions(input);
  return lintDoc(parseSkill(file, raw), options).sort(compareFindings);
}
function tallyFromFindings(findings) {
  let errorCount = 0;
  let warningCount = 0;
  for (const f of findings) {
    if (f.severity === "error") errorCount++;
    else warningCount++;
  }
  return { errorCount, warningCount };
}
function lintFiles(paths, input = {}) {
  const options = resolveOptions(input);
  const { files, missing } = discoverSkillFiles(paths, { ignore: options.ignore });
  const findings = [];
  const docs = [];
  for (const path of missing) {
    findings.push({
      ruleId: "path-not-found",
      severity: "error",
      message: `Path not found: ${path}`,
      file: path
    });
  }
  for (const file of files) {
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch (err) {
      findings.push({
        ruleId: "read-error",
        severity: "error",
        message: `Could not read file: ${err.message}`,
        file
      });
      continue;
    }
    const doc = parseSkill(file, raw);
    docs.push(doc);
    findings.push(...lintDoc(doc, options));
  }
  findings.push(...lintSet(docs, options));
  findings.sort(compareFindings);
  const { errorCount, warningCount } = tallyFromFindings(findings);
  return { findings, fileCount: docs.length, errorCount, warningCount };
}

// src/config.ts
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "fs";
import { dirname as dirname2, join as join2 } from "path";
var CONFIG_FILES = [".skillspecrc", ".skillspecrc.json", "skillspec.config.json"];
function readJson(path) {
  const raw = readFileSync2(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse config at ${path}: ${err.message}`);
  }
}
function loadConfig(explicitPath, cwd = process.cwd()) {
  if (explicitPath) {
    return { config: readJson(explicitPath), path: explicitPath };
  }
  let dir = cwd;
  for (; ; ) {
    for (const name of CONFIG_FILES) {
      const candidate = join2(dir, name);
      if (existsSync2(candidate)) {
        return { config: readJson(candidate), path: candidate };
      }
    }
    const pkgPath = join2(dir, "package.json");
    if (existsSync2(pkgPath)) {
      const pkg = readJson(pkgPath);
      if (pkg && typeof pkg === "object" && pkg.skillspec) {
        return { config: pkg.skillspec, path: pkgPath };
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) return { config: {}, path: null };
    dir = parent;
  }
}

// src/fix.ts
function applyFixes(original, firedRuleIds) {
  let out = original;
  if (firedRuleIds.has("no-bom") && out.startsWith("\uFEFF")) {
    out = out.slice(1);
  }
  if (firedRuleIds.has("line-endings")) {
    out = out.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }
  if (firedRuleIds.has("final-newline")) {
    out = out.replace(/\n*$/, "") + "\n";
  }
  return out;
}

// src/reporters/pretty.ts
function colors(enabled) {
  const wrap = (code) => (s) => enabled ? `\x1B[${code}m${s}\x1B[0m` : s;
  return {
    red: wrap(31),
    yellow: wrap(33),
    green: wrap(32),
    dim: wrap(2),
    bold: wrap(1),
    cyan: wrap(36),
    underline: wrap(4)
  };
}
function groupByFile(findings) {
  const map = /* @__PURE__ */ new Map();
  for (const f of findings) {
    const list = map.get(f.file) ?? [];
    list.push(f);
    map.set(f.file, list);
  }
  return map;
}
function reportPretty(result, options = {}) {
  const c = colors(options.color ?? false);
  const { findings, fileCount, errorCount, warningCount } = result;
  if (findings.length === 0) {
    const skills = `${fileCount} skill${fileCount === 1 ? "" : "s"}`;
    return c.green(`\u2713 skillspec: ${skills} checked, no problems found.`);
  }
  const lines = [];
  for (const [file, group] of groupByFile(findings)) {
    lines.push(c.underline(c.bold(file)));
    const locs = group.map((f) => f.line ? `${f.line}:${f.column ?? 1}` : "");
    const locWidth = Math.max(...locs.map((s) => s.length), 4);
    group.forEach((f, idx) => {
      const sev = f.severity === "error" ? c.red("error  ") : c.yellow("warning");
      lines.push(
        `  ${c.dim(locs[idx].padEnd(locWidth))}  ${sev}  ${f.message}  ${c.dim(f.ruleId)}`
      );
    });
    lines.push("");
  }
  const parts = [];
  if (errorCount > 0) parts.push(c.red(`${errorCount} error${errorCount === 1 ? "" : "s"}`));
  if (warningCount > 0)
    parts.push(c.yellow(`${warningCount} warning${warningCount === 1 ? "" : "s"}`));
  const total = errorCount + warningCount;
  const summary = `${c.bold("\u2716")} ${total} problem${total === 1 ? "" : "s"} (${parts.join(", ")}) across ${fileCount} skill${fileCount === 1 ? "" : "s"}`;
  lines.push(errorCount > 0 ? c.red(summary) : c.yellow(summary));
  return lines.join("\n");
}

// src/version.ts
var VERSION = "0.1.0";

// src/reporters/json.ts
function reportJson(result) {
  return JSON.stringify(
    {
      tool: "skillspec",
      version: VERSION,
      summary: {
        fileCount: result.fileCount,
        errorCount: result.errorCount,
        warningCount: result.warningCount
      },
      findings: result.findings
    },
    null,
    2
  );
}

// src/reporters/github.ts
function escapeData(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function escapeProperty(value) {
  return escapeData(value).replace(/,/g, "%2C").replace(/:/g, "%3A");
}
function reportGithub(result) {
  return result.findings.map((f) => {
    const command = f.severity === "error" ? "error" : "warning";
    const props = [
      `title=${escapeProperty(`skillspec/${f.ruleId}`)}`,
      `file=${escapeProperty(f.file)}`
    ];
    if (f.line) props.push(`line=${f.line}`);
    if (f.column) props.push(`col=${f.column}`);
    return `::${command} ${props.join(",")}::${escapeData(f.message)}`;
  }).join("\n");
}
function githubSummary(result) {
  const { fileCount, errorCount, warningCount, findings } = result;
  const lines = ["## skillspec"];
  if (findings.length === 0) {
    lines.push(
      "",
      `\u2705 **${fileCount}** skill${fileCount === 1 ? "" : "s"} checked \u2014 no problems found.`
    );
    return lines.join("\n");
  }
  const icon = errorCount > 0 ? "\u274C" : "\u26A0\uFE0F";
  lines.push(
    "",
    `${icon} **${errorCount}** error${errorCount === 1 ? "" : "s"}, **${warningCount}** warning${warningCount === 1 ? "" : "s"} across **${fileCount}** skill${fileCount === 1 ? "" : "s"}.`,
    "",
    "| Severity | File | Line | Rule | Message |",
    "| --- | --- | --- | --- | --- |"
  );
  for (const f of findings) {
    const sev = f.severity === "error" ? "\u{1F534} error" : "\u{1F7E1} warning";
    const loc = f.line ? String(f.line) : "";
    const msg = f.message.replace(/\|/g, "\\|").replace(/\n/g, " ");
    lines.push(`| ${sev} | \`${f.file}\` | ${loc} | \`${f.ruleId}\` | ${msg} |`);
  }
  return lines.join("\n");
}

// src/reporters/sarif.ts
function reportSarif(result) {
  const ruleIndex = /* @__PURE__ */ new Map();
  const rules = RULE_META.map((r, i) => {
    ruleIndex.set(r.id, i);
    return {
      id: r.id,
      name: r.id,
      shortDescription: { text: r.description },
      defaultConfiguration: {
        level: r.defaultSeverity === "error" ? "error" : "warning"
      },
      helpUri: `https://github.com/shaxzodbek-uzb/skillspec#${r.id}`
    };
  });
  const results = result.findings.map((f) => {
    const region = {};
    if (f.line) {
      region.startLine = f.line;
      if (f.column) region.startColumn = f.column;
    }
    const base = {
      ruleId: f.ruleId,
      level: f.severity === "error" ? "error" : "warning",
      message: { text: f.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.file.split("\\").join("/") },
            ...f.line ? { region } : {}
          }
        }
      ]
    };
    const idx = ruleIndex.get(f.ruleId);
    return idx === void 0 ? base : { ...base, ruleIndex: idx };
  });
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "skillspec",
            informationUri: "https://github.com/shaxzodbek-uzb/skillspec",
            version: VERSION,
            rules
          }
        },
        results
      }
    ]
  };
  return JSON.stringify(sarif, null, 2);
}

// src/reporters/index.ts
var FORMATS = ["pretty", "json", "github", "sarif"];
function formatResult(format, result, options = {}) {
  switch (format) {
    case "json":
      return reportJson(result);
    case "github":
      return reportGithub(result);
    case "sarif":
      return reportSarif(result);
    case "pretty":
    default:
      return reportPretty(result, options);
  }
}
export {
  CLAUDE_CODE_KEYS,
  DEFAULT_IGNORE,
  DEFAULT_PRESET,
  FIXABLE_RULES,
  FORMATS,
  LIMITS,
  NAME_PATTERN,
  OPEN_STANDARD_KEYS,
  PRESETS,
  RULES,
  RULE_META,
  SET_RULES,
  SPEC_VERIFIED,
  VERSION,
  applyFixes,
  charLength,
  compareFindings,
  discoverSkillFiles,
  estimateTokens,
  formatResult,
  githubSummary,
  lintDoc,
  lintFiles,
  lintSet,
  lintText,
  loadConfig,
  parseSkill,
  resolveOptions
};
