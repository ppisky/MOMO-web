import { build } from "esbuild";
await build({
  entryPoints: {
    main: "electron/main/index.ts",
    preload: "electron/preload/index.ts",
    server: "server/index.ts",
  },
  outdir: "dist-electron",
  outExtension: { ".js": ".cjs" },
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
