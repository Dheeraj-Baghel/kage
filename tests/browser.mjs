import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Exercise the real, unchanged document: no scene mocks or fabricated screenshots.
const root = fileURLToPath(new URL("../", import.meta.url));
// Keep hosted evidence separate from the existing local baseline.
const artifacts = path.join(root, process.env.KAGE_BASE_URL ? "artifacts/testing/live" : "artifacts/testing");
await mkdir(artifacts, { recursive: true });
const baseUrl = process.env.KAGE_BASE_URL ?? "http://127.0.0.1:4330";
const checks = [];
const sessions = [];
let server;
let browser;
let fatalError;

async function check(name, run) {
  const started = Date.now();
  try {
    const detail = await run();
    checks.push({ name, passed: true, durationMs: Date.now() - started, detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    checks.push({ name, passed: false, durationMs: Date.now() - started, error: String(error.stack ?? error) });
    console.error(`FAIL ${name}: ${error.stack ?? error}`);
  }
}

async function openSession(name, options = {}, init) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...options });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const evidence = { name, pageErrors: [], consoleErrors: [], warnings: [], externalRequests: [] };
  page.on("pageerror", (error) => evidence.pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.consoleErrors.push(message.text());
    if (message.type() === "warning") evidence.warnings.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(baseUrl).origin) evidence.externalRequests.push(url);
  });
  sessions.push(evidence);
  await page.goto(baseUrl, { waitUntil: "load", timeout: 60000 });
  // Cold HTTPS loads plus headless shader compilation can exceed the ordinary
  // interaction timeout. Still require real readiness; do not skip the preloader.
  await page.locator('.landing-page-frame[data-state="ready"]').waitFor({ timeout: 120000 });
  const iframe = await page.locator("iframe").elementHandle();
  const frame = await iframe.contentFrame();
  assert.ok(frame, "The authored frame must be available");
  await frame.waitForFunction(() => window.__kage && document.querySelector("#pre.done") && !document.body.classList.contains("is-locked"), null, { timeout: 120000 });
  await frame.locator("#pre").waitFor({ state: "hidden", timeout: 120000 });
  return { context, page, frame, evidence };
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), animations: "allow", timeout: 120000 });
}

async function scrollSettled(frame, target) {
  // Native scrollTo clamps against the live layout. Lazy/reparented foreground
  // layers can change the bottom bound after the authored anchors are measured.
  try {
    await frame.waitForFunction((y) => Math.abs(scrollY - Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight))) < 3, target, { timeout: 20000 });
  } catch (error) {
    console.error("Scroll diagnostic:", await frame.evaluate((requested) => ({ requested, actual: scrollY, max: document.documentElement.scrollHeight - innerHeight, anchors: window.__kage?.anchors?.(), progress: window.__kage?.RIG?.prog }), target));
    throw error;
  }
  await frame.waitForTimeout(1000);
}

async function revealNav(frame) {
  const y = await frame.evaluate(() => scrollY);
  await frame.evaluate(() => scrollTo({ top: Math.max(0, scrollY - 48), behavior: "instant" }));
  if (y > 0) await frame.waitForFunction(() => !document.querySelector("#nav").classList.contains("hide"));
  await frame.waitForTimeout(650);
}

async function rail(frame, index) {
  const target = await frame.evaluate((i) => window.__kage.anchors()[i], index);
  await frame.locator("#rail button").nth(index).click();
  await scrollSettled(frame, target);
}

async function assertHealthy(session) {
  assert.deepEqual(session.evidence.pageErrors, [], "Unhandled browser errors");
  assert.deepEqual(session.evidence.consoleErrors, [], "Unexpected console errors");
  assert.deepEqual(session.evidence.externalRequests, [], "The experience must load locally without ThreeUI/CDN requests");
}

try {
  if (!process.env.KAGE_BASE_URL) {
    server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", "4330", "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    server.stdout.on("data", (chunk) => { output += chunk; });
    server.stderr.on("data", (chunk) => { output += chunk; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Preview failed: ${output}`);
      try { if ((await fetch(baseUrl)).ok) break; } catch {}
      if (attempt === 99) throw new Error(`Preview did not start: ${output}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await check("Production serves all 17 authored public files byte-for-byte", async () => {
    const manifest = JSON.parse(await readFile(path.join(root, "vendor/threeui/provenance.json")));
    const publicFiles = manifest.files.filter((file) => file.localPath.startsWith("public/"));
    assert.equal(publicFiles.length, 17);
    for (const file of publicFiles) {
      const response = await fetch(`${baseUrl}/${file.localPath.slice(7)}`);
      assert.equal(response.status, 200, file.path);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, file.bytes, file.path);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, file.path);
    }
    return { files: publicFiles.length, canonicalSha256: manifest.canonicalSha256 };
  });

  browser = await chromium.launch({
    channel: process.env.KAGE_BROWSER_CHANNEL ?? "chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-webgl", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });

  const desktop = await openSession("desktop");
  const { page, frame } = desktop;
  await check("Configured component loads the local canonical page, not documentation", async () => {
    assert.equal(new URL(await page.locator("iframe").getAttribute("src"), baseUrl).pathname, "/landing-pages/kage.html");
    assert.equal(new URL(frame.url()).origin, new URL(baseUrl).origin);
    assert.equal(await page.locator("iframe").count(), 1);
    assert.match(await frame.title(), /^Kage/);
    assert.equal(await frame.locator("[data-cam]").count(), 6);
    assert.equal(await frame.locator(".cards .card").count(), 3);
    assert.equal(await frame.locator(".les").count(), 5);
    assert.deepEqual(await frame.evaluate(() => Object.values(document.body.dataset)), ["b", "b", "b", "b", "b", "b"]);
  });

  await check("Real bundled Three.js temple, four-letter wordmark and postprocessing initialize", async () => {
    const state = await frame.evaluate(() => {
      const k = window.__kage;
      let meshes = 0;
      k.scene.traverse((object) => { if (object.isMesh) meshes++; });
      return { fallback: Boolean(k.fallback), revision: window.THREE.REVISION, meshes, glyphs: k.WORD.glyphs.length, anchors: k.anchors(), canvas: [k.renderer.domElement.width, k.renderer.domElement.height], post: Boolean(k.POST.scene) };
    });
    assert.equal(state.fallback, false);
    assert.equal(state.revision, "149");
    assert.ok(state.meshes > 50);
    assert.equal(state.glyphs, 4);
    assert.equal(state.anchors.length, 6);
    assert.ok(state.canvas.every((size) => size > 0));
    assert.equal(state.post, true);
    return state;
  });

  await check("All selected typography/color props reach the live frame", async () => {
    const state = await frame.evaluate(() => {
      const h = getComputedStyle(document.querySelector(".h-hero"));
      const b = getComputedStyle(document.querySelector(".body"));
      return { headingFont: h.fontFamily, bodyFont: b.fontFamily, headingWeight: h.fontWeight, bodyWeight: b.fontWeight, primary: getComputedStyle(document.documentElement).getPropertyValue("--vermilion").trim(), headingSize: parseFloat(h.fontSize), bodySize: parseFloat(b.fontSize), spacing: parseFloat(h.letterSpacing), css: document.querySelector("#threeui-page-typography").textContent, fonts: document.fonts.check('400 16px Onest'), externalFont: Boolean(document.querySelector("#threeui-page-typography-fonts")) };
    });
    assert.match(state.headingFont, /Onest/);
    assert.match(state.bodyFont, /Onest/);
    assert.equal(state.headingWeight, "400");
    assert.equal(state.bodyWeight, "300");
    assert.equal(state.primary, "#e0231c");
    assert.ok(Math.abs(state.headingSize - 43.92) < 0.02);
    assert.equal(state.bodySize, 14);
    assert.ok(Math.abs(state.spacing - state.headingSize * -0.012) < 0.002);
    assert.match(state.css, /clamp\(26px, 3\.05vw, 46px\)/);
    assert.match(state.css, /clamp\(14px, 1\.02vw, 17px\)/);
    assert.equal(state.fonts, true);
    assert.equal(state.externalFont, false);
    return { ...state, css: undefined };
  });

  await frame.waitForTimeout(3800);
  await check("Temple animation advances and the original entrance reveal completes", async () => {
    const before = await frame.evaluate(() => window.__kage.WORLD.uT.value);
    // Wait for an actual rendered animation step, not an assumed 800ms frame
    // budget on a busy software-GPU host. The advancement assertion is unchanged.
    await frame.waitForFunction((previous) => window.__kage.WORLD.uT.value > previous, before, { timeout: 30000 });
    const after = await frame.evaluate(() => window.__kage.WORLD.uT.value);
    assert.ok(after > before);
    assert.equal(await frame.locator("#hero .mask-line.rv-in").count(), 3);
    assert.equal(await frame.locator("#pre").isVisible(), false);
    await screenshot(page, "hero-desktop");
    return { worldTimeBefore: before, worldTimeAfter: after };
  });

  await check("Pointer parallax drives the authored camera rig", async () => {
    const before = await frame.evaluate(() => window.__kage.camera.position.toArray());
    await page.mouse.move(1300, 300);
    await frame.waitForTimeout(1000);
    const state = await frame.evaluate(() => ({ pointer: window.__kage.RIG.tmx, camera: window.__kage.camera.position.toArray() }));
    assert.ok(state.pointer > 0.5);
    assert.ok(state.camera.some((value, index) => Math.abs(value - before[index]) > 0.01));
  });

  await check("Chapter hover focuses the world and restores focus on leave", async () => {
    await frame.locator('[data-chip="1"]').hover();
    await frame.waitForFunction(() => window.__kage.RIG.focus === 1);
    assert.match(await frame.locator('[data-chip="1"]').getAttribute("class"), /\bon\b/);
    await page.mouse.move(20, 110);
    await frame.waitForFunction(() => window.__kage.RIG.focus === -1);
  });

  await check("Temples navigation scrolls to the original Sanmon section", async () => {
    const target = await frame.locator("#gate").evaluate((element) => element.offsetTop - 40);
    await frame.locator('.nav-link[href="#gate"]').click();
    await scrollSettled(frame, target);
    await screenshot(page, "sanmon-desktop");
  });

  await check("Foreground cutouts lift into their authored active chapter layer", async () => {
    await rail(frame, 1);
    assert.equal(await frame.locator('#fg-sky [data-fg="gate"].fg-active').count(), 1);
    const images = await frame.locator('#fg-sky [data-fg="gate"] img').evaluateAll((elements) => elements.map((element) => ({ complete: element.complete, width: element.naturalWidth })));
    assert.ok(images.every((image) => image.complete && image.width > 0));
  });

  await check("Gardens navigation and original three illustrated cards remain interactive", async () => {
    await revealNav(frame);
    const target = await frame.locator("#pathways").evaluate((element) => element.offsetTop - 40);
    await frame.locator('.nav-link[href="#pathways"]').click();
    await scrollSettled(frame, target);
    await frame.waitForFunction(() => document.querySelectorAll(".card-fr.on-cloth canvas.cloth-out").length === 3, null, { timeout: 30000 });
    await frame.locator(".cards .card").first().hover();
    const size = await frame.locator(".cloth-out").first().evaluate((canvas) => [canvas.width, canvas.height]);
    assert.ok(size.every((value) => value > 0));
    await screenshot(page, "gardens-desktop");
  });

  await check("Rail chapter buttons scroll to real camera anchors and highlight the correct nav", async () => {
    for (const [index, id] of [[1, "gate"], [2, "pathways"], [3, "lessons"], [4, "eternity"]]) {
      await rail(frame, index);
      assert.ok(Math.abs(await frame.evaluate(() => window.__kage.RIG.prog) - index) < 0.02);
      assert.match(await frame.locator(`.nav-link[href="#${id}"]`).getAttribute("class"), /\bon\b/);
    }
  });

  await check("Sacred Craft lesson hover controls the existing lantern focus", async () => {
    await rail(frame, 3);
    await frame.locator('[data-les="2"]').hover();
    await frame.waitForFunction(() => window.__kage.RIG.focus === 2);
    await page.mouse.move(20, 100);
    await frame.waitForFunction(() => window.__kage.RIG.focus === -1);
    await screenshot(page, "rituals-desktop");
  });

  await check("Begin the walk returns from Afterlight to the hero", async () => {
    await rail(frame, 4);
    await frame.locator(".cta").click();
    await scrollSettled(frame, 0);
    assert.ok(await frame.evaluate(() => window.__kage.RIG.prog < 0.01));
  });

  await check("Ordinary wheel scrolling changes the camera and retires the hero preview", async () => {
    const before = await frame.evaluate(() => window.__kage.camera.position.toArray());
    await page.mouse.move(800, 500);
    await page.mouse.wheel(0, 800);
    await frame.waitForFunction(() => scrollY > 400);
    await frame.waitForTimeout(1400);
    const after = await frame.evaluate(() => window.__kage.camera.position.toArray());
    assert.ok(after.some((value, index) => Math.abs(value - before[index]) > 0.1));
    assert.equal(await frame.locator(".peek").evaluate((element) => element.style.pointerEvents), "none");
    await rail(frame, 0);
    assert.equal(await frame.locator(".peek").evaluate((element) => element.style.pointerEvents), "");
  });

  await check("Footer rail reaches the live bottom and its original chapter links work", async () => {
    await rail(frame, 5);
    const state = await frame.evaluate(() => ({ scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight, measuredAnchor: window.__kage.anchors()[5], cameraProgress: window.__kage.RIG.prog, footerBaseBottom: document.querySelector(".foot-base").getBoundingClientRect().bottom, viewportHeight: innerHeight }));
    assert.ok(Math.abs(state.scroll - state.max) < 3, "The footer rail must reach the real scroll boundary");
    assert.ok(state.footerBaseBottom <= state.viewportHeight + 1, "The footer content must be inside the viewport");
    assert.match(await frame.locator(".foot-base").innerText(), /2026 Kage/i);
    await screenshot(page, "footer-desktop");
    const target = await frame.locator("#lessons").evaluate((element) => element.offsetTop - 40);
    await frame.locator('.foot a[href="#lessons"]').first().click();
    await scrollSettled(frame, target);
    // Record, do not silently patch, the authored cached-anchor/clamped-layout
    // quirk: reaching the real footer need not produce a literal camera value 5.
    console.log("Authored footer measurements:", JSON.stringify(state));
    return state;
  });

  await check("Wide desktop and portrait tablet resize through the original renderer", async () => {
    for (const [width, height, name] of [[1920, 1080, "hero-wide"], [768, 1024, "hero-tablet"]]) {
      await page.setViewportSize({ width, height });
      await frame.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await frame.waitForTimeout(1600);
      const state = await frame.evaluate(() => ({ viewport: document.documentElement.clientWidth, navRight: document.querySelector("#nav").getBoundingClientRect().right, aspect: window.__kage.camera.aspect, wordVisible: window.__kage.WORD.glyphs.every((glyph) => glyph.visible), scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(state.viewport, width);
      assert.ok(state.navRight <= width + 1);
      assert.ok(Math.abs(state.aspect - width / height) < 0.01);
      assert.equal(state.wordVisible, true);
      await screenshot(page, name);
    }
  });
  await check("Desktop/tablet run has no page errors, console errors or remote requests", () => assertHealthy(desktop));
  await desktop.context.close();

  const mobile = await openSession("mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await check("Phone renders the local world and original coarse-pointer presentation", async () => {
    assert.equal(await mobile.frame.evaluate(() => Boolean(window.__kage.fallback)), false);
    assert.equal(await mobile.frame.locator(".cloth-out").count(), 0);
    assert.equal(await mobile.frame.locator("#cursor").isVisible(), false);
    await mobile.frame.waitForTimeout(3200);
    await screenshot(mobile.page, "hero-mobile");
  });

  await check("Mobile menu opens on tap with correct expanded and scroll-lock states", async () => {
    await mobile.frame.locator(".nav-burger").tap();
    assert.equal(await mobile.frame.locator(".nav-burger").getAttribute("aria-expanded"), "true");
    assert.equal(await mobile.frame.locator("html.nav-open").count(), 1);
    assert.equal(await mobile.frame.locator("#nav.menu-open").count(), 1);
    await screenshot(mobile.page, "menu-mobile");
  });

  await check("Mobile menu navigation closes the sheet and enters Rituals", async () => {
    const target = await mobile.frame.locator("#lessons").evaluate((element) => element.offsetTop - 40);
    await mobile.frame.locator('.nav-link[href="#lessons"]').tap();
    assert.equal(await mobile.frame.locator(".nav-burger").getAttribute("aria-expanded"), "false");
    assert.equal(await mobile.frame.locator("html.nav-open").count(), 0);
    await scrollSettled(mobile.frame, target);
    await screenshot(mobile.page, "rituals-mobile");
  });

  await check("Escape dismisses the existing phone menu", async () => {
    await revealNav(mobile.frame);
    await mobile.frame.locator(".nav-burger").tap();
    await mobile.page.keyboard.press("Escape");
    assert.equal(await mobile.frame.locator(".nav-burger").getAttribute("aria-expanded"), "false");
    assert.equal(await mobile.frame.locator("html.nav-open").count(), 0);
  });

  await check("Small-phone and landscape layouts retain a reachable menu and sized world", async () => {
    for (const [width, height, name] of [[320, 700, "hero-small-mobile"], [844, 390, "hero-landscape"]]) {
      await mobile.page.setViewportSize({ width, height });
      await mobile.frame.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await mobile.frame.waitForTimeout(1600);
      const state = await mobile.frame.evaluate(() => ({ viewport: document.documentElement.clientWidth, navRight: document.querySelector("#nav").getBoundingClientRect().right, burgerRight: document.querySelector(".nav-burger").getBoundingClientRect().right, aspect: window.__kage.camera.aspect, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(state.viewport, width);
      assert.ok(state.navRight <= width + 1);
      assert.ok(state.burgerRight <= width + 1);
      assert.ok(Math.abs(state.aspect - width / height) < 0.01);
      await screenshot(mobile.page, name);
    }
  });
  await check("Phone run has no page errors, console errors or remote requests", () => assertHealthy(mobile));
  await mobile.context.close();

  const reduced = await openSession("reduced-motion", { viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await check("Reduced-motion mode keeps the authored static reveal and immediate camera progress", async () => {
    assert.equal(await reduced.frame.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    assert.equal(await reduced.frame.locator(".word-reveal").count(), 0);
    await rail(reduced.frame, 2);
    const state = await reduced.frame.evaluate(() => ({ prog: window.__kage.RIG.prog, smooth: window.__kage.RIG.smooth }));
    assert.ok(Math.abs(state.prog - state.smooth) < 0.001);
    await screenshot(reduced.page, "gardens-reduced-motion");
  });
  await check("Reduced-motion run has no page errors, console errors or remote requests", () => assertHealthy(reduced));
  await reduced.context.close();

  const fallback = await openSession("webgl-fallback", { viewport: { width: 1280, height: 800 } }, () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl|experimental-webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await check("Unavailable WebGL activates the original readable fallback, not an invented substitute", async () => {
    assert.equal(await fallback.frame.evaluate(() => window.__kage.fallback), true);
    assert.equal(await fallback.frame.locator("body.no-webgl").count(), 1);
    assert.equal(await fallback.frame.locator("#pre").isVisible(), false);
    assert.equal(await fallback.frame.locator("h1").isVisible(), true);
    const target = await fallback.frame.locator("#gate").evaluate((element) => element.offsetTop - 40);
    await fallback.frame.locator('.nav-link[href="#gate"]').click();
    await scrollSettled(fallback.frame, target);
    assert.deepEqual(fallback.evidence.pageErrors, []);
    assert.deepEqual(fallback.evidence.externalRequests, []);
    assert.ok(fallback.evidence.consoleErrors.every((error) => /WebGL|\[kage\] job "Pouring the ground" failed/i.test(error)));
    await screenshot(fallback.page, "webgl-fallback");
    return { expectedDiagnostics: fallback.evidence.consoleErrors };
  });
} catch (error) {
  fatalError = String(error.stack ?? error);
  console.error(fatalError);
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
  const report = { timestamp: new Date().toISOString(), baseUrl, sourceRevision: "c8e06b90397a", browser: "Chromium via installed Google Chrome; headless SwiftShader WebGL", checks, sessions, fatalError, limitations: ["No physical-device touch or sustained-GPU performance claim", "Safari, Firefox and assistive-technology testing not performed", "Authored HTML, shaders and interactions were not rewritten"] };
  await writeFile(path.join(artifacts, "browser-results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${checks.filter((result) => result.passed).length}/${checks.length} browser workflow groups passed; evidence saved in ${path.relative(root, artifacts)}.`);
}
if (fatalError || checks.some((result) => !result.passed)) process.exitCode = 1;
