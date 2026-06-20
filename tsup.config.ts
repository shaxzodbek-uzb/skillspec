import { defineConfig } from 'tsup';

export default defineConfig([
  // Library + CLI: `yaml` stays an external dependency (installed from npm).
  {
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts',
    },
    format: ['esm', 'cjs'],
    dts: { entry: { index: 'src/index.ts' } },
    clean: true,
    sourcemap: false,
    target: 'node18',
    splitting: false,
    shims: true,
  },
  // GitHub Action entrypoint: self-contained, `yaml` is bundled in so the
  // action runs straight from the checked-out repo with no install step.
  {
    entry: { action: 'src/action.ts' },
    format: ['cjs'],
    dts: false,
    clean: false,
    sourcemap: false,
    target: 'node20',
    splitting: false,
    noExternal: ['yaml'],
  },
]);
