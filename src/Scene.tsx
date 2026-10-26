import { KageLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

// Preserve the user's configured usage. The import resolves to the hash-verified
// registered Kage implementation; the authored HTML is served unchanged locally.
export function Scene() {
  return (
    <div className="shader-frame">
      <KageLandingPage
        headingFont="onest"
        bodyFont="onest"
        headingWeight="400"
        bodyWeight="300"
        primaryColor="#e0231c"
        headingSize={46}
        bodySize={17}
        headingLetterSpacing={-0.012}
      />
    </div>
  );
}
