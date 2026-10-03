import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const assets = readdirSync("dist/assets")
  .sort()
  .map((file) => "/assets/" + file);
const urls = [
  "/",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/fonts/NotoSansDevanagari.ttf",
  ...assets,
];
const digest = createHash("sha256");
for (const url of urls) {
  const path = url === "/" ? "dist/index.html" : "dist" + url;
  digest.update(url);
  digest.update(readFileSync(path));
}
const version = digest.digest("hex").slice(0, 12);
const template = readFileSync("public/sw.js", "utf8");
const marker = /\/\* precache:start \*\/[\s\S]*?\/\* precache:end \*\//;
if (!marker.test(template))
  throw new Error("Service worker precache marker is missing");
const worker = template.replace(
  marker,
  `const CACHE_NAME = ${JSON.stringify("mausam-shell-" + version)};\nconst PRECACHE_URLS = ${JSON.stringify(urls)};`,
);
writeFileSync("dist/sw.js", worker);
