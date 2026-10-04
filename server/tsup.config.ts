import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  // @skillx/shared ships TypeScript source, so bundle it instead of importing it at runtime.
  noExternal: ['@skillx/shared'],
});
