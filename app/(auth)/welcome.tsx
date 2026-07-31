import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import { WhosFreeGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { ONBOARDING_HERO_TOP_COMPACT } from "@/constants/onboardingLayout";
import { router } from "expo-router";

export default function SpontaneousHangouts() {
  return (
    <OnboardingImmersiveSlide
      step={2}
      heroTop={ONBOARDING_HERO_TOP_COMPACT}
      title={"Who's down.\n"}
      titleAccent="Right now."
      subtitle="See when your people are ready to hang, and catch the moment."
      ctaLabel="Next"
      onNext={() => router.push("/(auth)/next")}
    >
      <WhosFreeGraphic />
    </OnboardingImmersiveSlide>
  );
}
