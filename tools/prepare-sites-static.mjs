import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const target = resolve(root, "public", "cera");
const files = [
  "index.html",
  "movil.html",
  "manifest.webmanifest",
  "sw.js",
];
const directories = ["assets", "css", "js"];

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(target, file));
}

for (const directory of directories) {
  await cp(resolve(root, directory), resolve(target, directory), {
    recursive: true,
  });
}

console.log(`Prepared static CERA bundle at ${target}`);
