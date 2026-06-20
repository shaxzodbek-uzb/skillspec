import type { LintResult } from '../types.js';
import { reportPretty, type PrettyOptions } from './pretty.js';
import { reportJson } from './json.js';
import { reportGithub, githubSummary } from './github.js';
import { reportSarif } from './sarif.js';

export type Format = 'pretty' | 'json' | 'github' | 'sarif';

export const FORMATS: Format[] = ['pretty', 'json', 'github', 'sarif'];

export interface ReportOptions extends PrettyOptions {}

/** Render a lint result in the requested format. */
export function formatResult(
  format: Format,
  result: LintResult,
  options: ReportOptions = {},
): string {
  switch (format) {
    case 'json':
      return reportJson(result);
    case 'github':
      return reportGithub(result);
    case 'sarif':
      return reportSarif(result);
    case 'pretty':
    default:
      return reportPretty(result, options);
  }
}

export { reportPretty, reportJson, reportGithub, reportSarif, githubSummary };
