// Anonymous hosted packaging check, including the unchanged temple HTML,
// images, Three.js, fonts and notices. The local dist must match the release.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
assert.ok(process.env.KAGE_BASE_URL, 'Set KAGE_BASE_URL to the deployed origin');
const origin = new URL(process.env.KAGE_BASE_URL).origin;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const get = async pathname => fetch(new URL(pathname, origin), { signal: AbortSignal.timeout(30000) });
const walk = async dir => {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p)); else files.push(p);
  }
  return files;
};
const report = { origin, when: new Date().toISOString(), publicFiles: [], bundles: [], privatePaths: [], headers: {} };
const home = await get('/'); assert.equal(home.status, 200);
for (const [key, value] of Object.entries({ 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(), microphone=(), geolocation=()' })) {
  report.headers[key] = home.headers.get(key); assert.equal(report.headers[key], value);
}
assert.ok(home.headers.get('strict-transport-security'));
assert.ok((await home.text()).includes('Kage'));
for (const folder of ['public', 'dist/assets']) {
  for (const file of await walk(path.join(root, folder))) {
    const base = folder === 'public' ? 'public' : 'dist';
    const url = '/' + path.relative(path.join(root, base), file).split(path.sep).join('/');
    const response = await get(url); assert.equal(response.status, 200, url);
    const served = Buffer.from(await response.arrayBuffer());
    assert.equal(sha(served), sha(await readFile(file)), `Byte mismatch: ${url}`);
    (folder === 'public' ? report.publicFiles : report.bundles).push({ url, bytes: served.length, sha256: sha(served), status: response.status });
  }
}
assert.equal(report.publicFiles.find(f => f.url === '/landing-pages/kage.html')?.sha256, 'c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49');
for (const url of ['/.env.local', '/.vercel/project.json', '/src/main.tsx', '/node_modules/react/package.json', '/vendor/threeui/source-bundle.json', '/does-not-exist']) {
  const response = await get(url); assert.equal(response.status, 404, url);
  report.privatePaths.push({ url, status: response.status });
}
const out = path.join(root, 'artifacts/testing/live'); await mkdir(out, { recursive: true });
await writeFile(path.join(out, 'http-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`PASS ${report.publicFiles.length} byte-exact public files, ${report.bundles.length} JS/CSS/font bundles, ${report.privatePaths.length} private/unknown 404s, security headers`);
