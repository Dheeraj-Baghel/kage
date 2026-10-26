# Kage — GitHub and Vercel deployment

The user explicitly requested GitHub push and Vercel hosting on 26 October 2026.

- **Live site:** https://kage-softtech10.vercel.app
- **Private GitHub repository:** https://github.com/Dheeraj-Baghel/kage
- **Production branch:** `main`, connected to Vercel's GitHub integration.
  Pushes deploy automatically.
- **Vercel project:** `kage-softtech10`, existing `softtech10` Hobby scope
  (personal/non-commercial use; free-tier quotas apply).
- No app environment variables, secrets, database, backend or paid add-on.

## Build and exact-source contract

[vercel.json](vercel.json) selects Vite, `npm ci`, `npm run build`, and `dist/`.
Node is pinned to 24.x in package engines and the Vercel project. Every build
checks exact source hashes and configured props, strict TypeScript, then bundles.
The 8 registered text files and 14 binary WebP assets are unchanged. The canonical
temple document remains SHA-256
`c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49`.

Security headers include nosniff, strict-origin referrer policy, disabled camera/
microphone/geolocation and SAMEORIGIN framing. SAMEORIGIN, not DENY, is required
because the original component uses a local same-origin iframe. Vercel adds HSTS.
The original scripted sandbox warning remains; this is not an isolation boundary
for untrusted third-party documents.

Git ignores dependencies, build output, local environment/Vercel link credentials
and existing test captures. `.vercelignore` excludes artifacts from deployment.
Source, original runtime assets, manifests and licence files are committed.
The MIT ThreeUI source/assets, OFL fonts and MIT library notices are retained in
the repo and publicly served under `/third-party/threeui/`.

## Verification and timing corrections

- Fresh isolated `npm ci`, exact-source verification, strict types and production
  build pass; the actual Git-triggered Vercel Linux build reached Ready.
- **26/26 hosted real-Chrome workflow groups pass**: real temple/wordmark/postprocess,
  animation, configured typography, pointer parallax, chapter/lesson focus, header/
  rail/footer navigation, garden cards, native wheel, viewport resizing, phone menu,
  reduced motion and the original no-WebGL fallback. No page/console errors or
  remote asset requests in normal desktop, phone and reduced-motion runs.
- **21 public files and 3 JS/CSS/font bundles are byte-exact**, including the
  canonical HTML, all scene assets and licence notices. Security headers are checked;
  six source/credential/dependency/unknown URLs correctly return 404.

The first hosted suite aborted at its 30-second frame-readiness timeout. The next
run passed 16 of 17 executed groups but failed a fixed 800ms animation sample and
then timed out waiting for the mobile preloader fade. Diagnostics observed actual
scene initialization and fade completion without runtime errors on the busy
headless software-GPU host. We changed **only the test harness**: bounded 120-second
initialization/preloader/screenshot waits and a real animation-step condition
instead of an assumed 800ms frame budget. All original assertions remain; the final
full run passed 26/26. No authored HTML, shader, prop, image or experience was rewritten.
These longer automated waits are not a loading-time or physical-device performance claim.

Local evidence (not pushed to GitHub or served):
- [Hosted browser report](artifacts/testing/live/browser-results.json)
- [HTTP byte/hash report](artifacts/testing/live/http-results.json)
- [Hosted hero](artifacts/testing/live/hero-desktop.png)
- [Audit details](artifacts/testing/live/dependency-audit.json)

## Dependency audit and remaining checks

The existing pinned Vite 7.3.1/esbuild development tools report **2 audit findings
(1 high, 1 low)**, principally development-server/Windows handling issues.
`npm audit --omit=dev` reports **zero production-dependency findings**. Vercel serves
static build output, not the development server. No forced toolchain update was
made during hosting; the dev-tool advisories remain follow-up work (do not expose
the dev server publicly). Dependency reports are kept with the local live evidence.

The inherited footer camera-anchor quirk is preserved for canonical source fidelity.
Real Safari/Firefox, physical phones, sustained GPU performance and manual
assistive-technology checks remain unverified. No other app/project was changed.

## Rechecking and updating

Run `npm ci && npm run build`, commit and push `main`, then:

```sh
KAGE_BASE_URL=https://kage-softtech10.vercel.app npm run test:browser
KAGE_BASE_URL=https://kage-softtech10.vercel.app node tests/live-assets.mjs
```

Hosted evidence goes to `artifacts/testing/live/`; without `KAGE_BASE_URL`, the
browser suite uses its owned local preview as before. The asset check requires a
local build matching the deployed release to compare bundle bytes.