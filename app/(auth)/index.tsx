import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import { PulseHeroGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { router } from "expo-router";

export default function MakePlansScreen() {
  return (
    <OnboardingImmersiveSlide
      step={1}
      title={"Less scrolling.\n"}
      titleAccent="More together."
      subtitle="More time with the people you care about."
      ctaLabel="Next"
      onNext={() => router.push("/(auth)/welcome")}
    >
      <PulseHeroGraphic />
    </OnboardingImmersiveSlide>
  );
}
