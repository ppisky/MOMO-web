import { packager } from "@electron/packager";
import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
const staging = resolve("release/staging");
await mkdir(staging, { recursive: true });
await cp("dist-electron", resolve(staging, "dist-electron"), {
  recursive: true,
});
await cp("build/client", resolve(staging, "build/client"), { recursive: true });
await writeFile(
  resolve(staging, "package.json"),
  JSON.stringify({
    name: "momo",
    productName: "MOMO",
    version: "0.1.0",
    main: "dist-electron/main.cjs",
  }),
);
const paths = await packager({
  dir: staging,
  name: "MOMO",
  platform: "win32",
  arch: "x64",
  electronVersion: "44.7.0",
  download: {
    checksums: JSON.parse(
      await readFile("node_modules/electron/checksums.json", "utf8"),
    ),
  },
  icon: resolve("public/brand/momo.ico"),
  out: "release",
  overwrite: true,
  asar: true,
  prune: false,
});
console.log(paths.join("\n"));
