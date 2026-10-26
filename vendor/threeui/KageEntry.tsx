// The Kage export below is extracted verbatim from the registered LandingPages.tsx.
// Its unrelated catalog imports need not be pulled into this standalone app.
// Full original files remain unchanged alongside this entry for hash verification.
import { splitTypographyProps, usePageTypography, type PageTypographyProps } from "./src/shaders/landing-pages/pageTypography";
import { LandingPageFrame, type LandingPageProps } from "./src/shaders/landing-pages/LandingPageFrame";
import { KAGE_TYPOGRAPHY } from "./src/shaders/landing-pages/pageRecipes";

export function KageLandingPage(props: LandingPageProps & PageTypographyProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(KAGE_TYPOGRAPHY, type);
  return <LandingPageFrame {...frame} customization={customization} title="Kage — Where stillness reveals the unseen" sourceUrl="/landing-pages/kage.html" />;
}
