import type { LintResult } from '../types.js';
import { VERSION } from '../version.js';

/** Machine-readable JSON output. Stable shape for scripting and editors. */
export function reportJson(result: LintResult): string {
  return JSON.stringify(
    {
      tool: 'skillspec',
      version: VERSION,
      summary: {
        fileCount: result.fileCount,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
      },
      findings: result.findings,
    },
    null,
    2,
  );
}
