import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (name) => readFile(path.join(root, name));
const manifest = JSON.parse(await read("vendor/threeui/provenance.json"));
const bundle = JSON.parse(await read("vendor/threeui/source-bundle.json"));
const canonicalHash = "c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49";
assert.equal(manifest.canonicalSha256, canonicalHash);
assert.equal(manifest.files.length, 22);

for (const file of manifest.files) {
  const bytes = await read(file.localPath);
  const registered = [...bundle.files, ...bundle.assets].find((entry) => entry.path === file.path);
  assert.ok(registered, `Unregistered file: ${file.path}`);
  assert.equal(file.sha256, registered.sha256, `Manifest hash: ${file.path}`);
  assert.equal(bytes.length, registered.bytes, `Byte length: ${file.path}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), registered.sha256, `SHA-256: ${file.path}`);
  if (registered.code !== undefined) assert.equal(bytes.toString("utf8"), registered.code, `Complete registered text: ${file.path}`);
  if (file.localPath.startsWith("public/")) {
    const packaged = await read(`node_modules/@designcodeio/threeui/lib-dist/assets/${file.localPath.slice(7)}`);
    assert.deepEqual(bytes, packaged, `Byte-for-byte package asset: ${file.path}`);
  }
  console.log(`PASS ${file.path}`);
}

const packageInfo = JSON.parse(await read("node_modules/@designcodeio/threeui/package.json"));
assert.equal(packageInfo.version, "1.2.0");
for (const file of manifest.additionalFiles ?? []) {
  const bytes = await read(file.localPath);
  assert.equal(bytes.length, file.bytes, file.localPath);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.localPath);
}
const packageStyle = (await read("node_modules/@designcodeio/threeui/lib-dist/style.css")).toString();
const fontData = packageStyle.match(/font-family:ThreeUI Fragment Mono[^}]*src:url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/);
assert.ok(fontData, "Shared font must come from the actual ThreeUI package");
assert.deepEqual(await read("vendor/threeui/src/shaders/fonts/fragment-mono.woff2"), Buffer.from(fontData[1], "base64"));
console.log("PASS original package asset bytes and shared stylesheet font");

const original = (await read("vendor/threeui/src/shaders/landing-pages/LandingPages.tsx")).toString();
const start = original.indexOf("export function KageLandingPage(");
const end = original.indexOf("\n}\n", start) + 3;
const entry = (await read("vendor/threeui/KageEntry.tsx")).toString();
assert.equal(entry.slice(entry.indexOf("export function KageLandingPage(")), original.slice(start, end), "Kage export must remain verbatim");

const sceneText = (await read("src/Scene.tsx")).toString();
const scene = ts.createSourceFile("Scene.tsx", sceneText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const expectedProps = {
  headingFont: "onest", bodyFont: "onest", headingWeight: "400", bodyWeight: "300",
  primaryColor: "#e0231c", headingSize: 46, bodySize: 17, headingLetterSpacing: -0.012,
};
let found = 0;
function visit(node) {
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(scene) === "KageLandingPage") {
    found++;
    const actual = Object.fromEntries(node.attributes.properties.map((attribute) => {
      assert.ok(ts.isJsxAttribute(attribute), "No unverified prop spread");
      const value = attribute.initializer;
      return [attribute.name.getText(scene), ts.isStringLiteral(value) ? value.text : Number(value.expression.getText(scene))];
    }));
    assert.deepEqual(actual, expectedProps, "The configured usage must be exact");
  }
  ts.forEachChild(node, visit);
}
visit(scene);
assert.equal(found, 1);
assert.match(sceneText, /import \{ KageLandingPage \} from "@designcodeio\/threeui"/);
assert.match(sceneText, /import "@designcodeio\/threeui\/style\.css"/);
assert.match(sceneText, /className="shader-frame"/);

const html = (await read("public/landing-pages/kage.html")).toString();
const assetPaths = new Set(html.match(/secret-pathways-assets\/[a-zA-Z0-9_./-]+\.(?:webp|css|js)/g));
for (const asset of assetPaths) {
  assert.ok(manifest.files.some((file) => file.localPath === `public/landing-pages/${asset}`), `Missing authored asset: ${asset}`);
}
assert.equal(createHash("sha256").update(html).digest("hex"), canonicalHash);
console.log(`PASS verbatim Kage export, all 8 configured props, and ${assetPaths.size} original asset paths`);
console.log("Exact-source verification complete: 8 text files + 14 binary assets.");
