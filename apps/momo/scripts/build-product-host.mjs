import { build } from 'esbuild';

await build({
  entryPoints: ['src/product/lib/server/http.server.ts'],
  outfile: 'dist/host/http.mjs', bundle: true, platform: 'node', format: 'esm',
  target: 'node26', packages: 'external', sourcemap: false,
});
