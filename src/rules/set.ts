import type { SetRule } from '../types.js';
import { asString, wordJaccard } from '../util.js';

/** Resolve a doc's effective name: explicit `name`, else its directory name. */
function effectiveName(doc: { data: Record<string, unknown> | null; dirName: string }): string {
  const name = doc.data ? asString(doc.data['name']) : null;
  return name && name.trim() !== '' ? name : doc.dirName;
}

/** How similar two descriptions can be before Claude can't disambiguate them. */
const TRIGGER_COLLISION_THRESHOLD = 0.8;

export const setRules: SetRule[] = [
  {
    id: 'duplicate-name',
    description: 'No two skills in the set may share the same name.',
    defaultSeverity: 'error',
    check(docs, _options, report) {
      const byName = new Map<string, typeof docs>();
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
            `Duplicate skill name "${name}" — also defined by: ${others.join(', ')}. Names must be unique so Claude can address each skill.`,
            { line: doc.keyLines['name'] },
          );
        }
      }
    },
  },
  {
    id: 'trigger-collision',
    description: 'Two skills with near-identical descriptions compete for the same triggers.',
    defaultSeverity: 'warning',
    check(docs, _options, report) {
      const withDesc = docs
        .map((doc) => ({ doc, desc: doc.data ? asString(doc.data['description']) : null }))
        .filter((x): x is { doc: (typeof docs)[number]; desc: string } => !!x.desc?.trim());

      for (let i = 0; i < withDesc.length; i++) {
        for (let j = i + 1; j < withDesc.length; j++) {
          const a = withDesc[i]!;
          const b = withDesc[j]!;
          const sim = wordJaccard(a.desc, b.desc);
          if (sim >= TRIGGER_COLLISION_THRESHOLD) {
            const pct = Math.round(sim * 100);
            report(
              a.doc,
              `\`description\` is ${pct}% similar to "${b.doc.file}" — their triggers overlap, so Claude may load the wrong skill. Make each description distinct.`,
              { line: a.doc.keyLines['description'] },
            );
          }
        }
      }
    },
  },
];
