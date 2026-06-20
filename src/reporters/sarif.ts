import type { LintResult } from '../types.js';
import { RULE_META } from '../rules/index.js';
import { VERSION } from '../version.js';

/**
 * SARIF 2.1.0 output for GitHub Code Scanning (and other SARIF consumers).
 * Findings become results; every skillspec rule is declared in the driver so
 * the Security tab shows rich, named alerts.
 */
export function reportSarif(result: LintResult): string {
  const ruleIndex = new Map<string, number>();
  const rules = RULE_META.map((r, i) => {
    ruleIndex.set(r.id, i);
    return {
      id: r.id,
      name: r.id,
      shortDescription: { text: r.description },
      defaultConfiguration: {
        level: r.defaultSeverity === 'error' ? 'error' : 'warning',
      },
      helpUri: `https://github.com/shaxzodbek-uzb/skillspec#${r.id}`,
    };
  });

  const results = result.findings.map((f) => {
    // startColumn is only meaningful alongside startLine in SARIF, so gate it
    // inside the line check (a column without a line is dropped).
    const region: Record<string, number> = {};
    if (f.line) {
      region.startLine = f.line;
      if (f.column) region.startColumn = f.column;
    }
    const base = {
      ruleId: f.ruleId,
      level: f.severity === 'error' ? 'error' : 'warning',
      message: { text: f.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: f.file.split('\\').join('/') },
            ...(f.line ? { region } : {}),
          },
        },
      ],
    };
    const idx = ruleIndex.get(f.ruleId);
    return idx === undefined ? base : { ...base, ruleIndex: idx };
  });

  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'skillspec',
            informationUri: 'https://github.com/shaxzodbek-uzb/skillspec',
            version: VERSION,
            rules,
          },
        },
        results,
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}
