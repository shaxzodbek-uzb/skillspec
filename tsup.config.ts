import { defineConfig } from 'tsup';

export default defineConfig([
  // Library: dual ESM + CJS so both `import` and `require` consumers work.
  // `yaml` stays an external dependency (installed from npm).
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: false,
    target: 'node18',
    splitting: false,
    shims: true,
  },
  // CLI: ESM only. The `bin` points at dist/cli.js (which keeps the shebang),
  // so a CJS copy would just be dead weight in the published tarball.
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    dts: false,
    clean: false,
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
