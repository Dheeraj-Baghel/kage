# Kage — exact-source temple experience

A standalone React/TypeScript/Vite application integrating the authored ThreeUI
`KageLandingPage`, **not a reconstruction from its preview**. The user explicitly
selected a new application; the existing workspace apps remain unchanged.

**Local app: [http://127.0.0.1:4329](http://127.0.0.1:4329/).**

## Run and verify

Tested with Node **24.13.0** and npm **11.6.2**.

```sh
npm ci
npm run dev
npm run build
npm run test:browser
```

The dev and production-preview commands use port **4329**. The browser suite
starts and stops its own production preview on **4330**, unless `KAGE_BASE_URL`
is supplied. It uses the installed Google Chrome browser, not a scene mock.

## Source contract

- [Scene.tsx](src/Scene.tsx) preserves the requested imports, `shader-frame`, and
  all eight props: Onest/Onest, weights 400/300, primary `#e0231c`, sizes 46/17,
  and heading tracking -0.012.
- The canonical [temple document](public/landing-pages/kage.html) is unchanged:
  SHA-256 **c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49**.
- All **8 registered text files** and **14 binary WebP assets** match the supplied
  byte counts and SHA-256 hashes. The HTML, local Three.js runtime, embedded font
  stylesheet, and images were copied byte-for-byte from the actual ThreeUI
  **1.2.0** package. The downloaded package archive's SHA-512 also matched npm.
- The complete [registered source bundle](vendor/threeui/source-bundle.json) and
  [provenance manifest](vendor/threeui/provenance.json) are retained locally.
  The live website HTML differed from the requested revision; it was **not**
  substituted for the matching package document.
- The [Kage entry](vendor/threeui/KageEntry.tsx) contains the component export
  extracted **verbatim** from the original
  [LandingPages.tsx](vendor/threeui/src/shaders/landing-pages/LandingPages.tsx).
  The full original file remains intact; unrelated catalog pages are not pulled
  into this app.
- [Vite aliases](vite.config.ts) and [TypeScript paths](tsconfig.json) bind the
  configured package import to the exact registered implementation. This is
  intentional: npm 1.2.0's compiled frame predates the registered frame source.
  The app uses the unmodified registered
  [LandingPageFrame.tsx](vendor/threeui/src/shaders/landing-pages/LandingPageFrame.tsx),
  [pageTypography.ts](vendor/threeui/src/shaders/landing-pages/pageTypography.ts),
  [pageRecipes.ts](vendor/threeui/src/shaders/landing-pages/pageRecipes.ts), and
  [shared stylesheet](vendor/threeui/src/shaders/threeui.css).
- The original shared stylesheet's Fragment Mono dependency was extracted from
  its byte-encoded font in the same npm package. Its hash is recorded separately
  in the provenance manifest; the stylesheet itself was not edited.

The original component uses a sandboxed, **same-origin local document frame**.
This is its authored architecture, not an embed of the ThreeUI documentation
page. Typography is applied by the original runtime stylesheet injection;
HTML on disk is never rewritten. [Host CSS](src/styles.css) only sizes the frame
to the viewport and avoids introducing a second outer scrollbar.

## Preserved experience

The preloader, six camera/scroll stages, Kyoto temple world, four-letter WebGL
wordmark, moon, lanterns, atmosphere, foreground cutouts, pointer parallax,
chapter and lesson focus, illustrated garden cards and their fine-pointer cloth
shaders, mobile menu, chapter rail, navigation, footer and return-to-top CTA all
remain authored by ThreeUI. Responsive, reduced-motion, coarse-pointer and
WebGL-unavailable behavior remains in the original document.

With the selected Onest props, page fonts are embedded locally; no Google Fonts,
ThreeUI documentation, remote scene, video or image endpoint is needed at runtime.
Authored narrative/historical numbers are preserved copy, not independently
verified claims about a real temple or a functioning course service.

## Verification

- Exact-source and original-package byte checks: **pass**.
- Fresh `npm ci --offline` with the complete integrity-pinned lockfile: **pass**.
- Strict TypeScript and production build: **pass**.
- **26/26 production Chromium browser workflow groups pass**. The real local
  document initializes its bundled Three.js 149 world, wordmark, postprocessing,
  animation and all configured controls. Tests exercise pointer parallax,
  chapter/lesson focus, header and rail navigation, foreground staging, garden
  cloth shaders, wheel scrolling, CTA, footer links, resizing, phone menu tap/
  Escape, reduced motion and the original WebGL-unavailable fallback.
- Responsive samples: 1440×900, 1920×1080, 768×1024, 390×844, 320×700 and
  844×390. Reduced-motion and unavailable-WebGL runs also use 1280×800.
- Normal desktop/tablet, phone and reduced-motion runs have **zero page errors,
  zero console errors and zero external HTTP requests**. The deliberate WebGL
  failure logs the expected original diagnostics, then renders readable content
  and working section navigation without an unhandled page error.
- See [machine-readable results](artifacts/testing/browser-results.json),
  [desktop hero](artifacts/testing/hero-desktop.png),
  [phone hero](artifacts/testing/hero-mobile.png),
  [phone menu](artifacts/testing/menu-mobile.png),
  [gardens](artifacts/testing/gardens-desktop.png),
  [footer](artifacts/testing/footer-desktop.png) and
  [WebGL fallback](artifacts/testing/webgl-fallback.png).

### Preserved upstream caveats

The document caches a footer camera anchor that can exceed the live layout's
scroll boundary after foreground stages move. At 1440×900 the observed anchor
was 4552 while the live maximum was 4415; the footer rail reached that maximum,
the footer content and links worked, and camera progress stopped at about
4.797 rather than exactly 5. This is recorded by the browser suite and **not
patched**, preserving the required canonical hash. Browser warnings about the
original same-origin scripted iframe sandbox and software-WebGL readback are
also retained in the report; the sandbox is not claimed to isolate untrusted
third-party content.

Physical-device touch, Safari/Firefox, assistive-technology review and sustained
GPU performance are not claimed. No deployment, credentials, backend, commerce
or changes to existing applications were added.

Upstream [MIT license](vendor/threeui/LICENSE),
[asset notices](vendor/threeui/ASSET-LICENSES.md),
[font licenses](vendor/threeui/FONT-LICENSES.md) and
[third-party notices](vendor/threeui/THIRD_PARTY_NOTICES.md) are retained. Copies
are included in the production public directory for redistribution.
