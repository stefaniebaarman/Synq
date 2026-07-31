import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import { JumpInGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { ONBOARDING_HERO_TOP_COMPACT } from "@/constants/onboardingLayout";
import { router } from "expo-router";

export default function SeeWhenFriendsAvailable() {
  return (
    <OnboardingImmersiveSlide
      step={3}
      heroTop={ONBOARDING_HERO_TOP_COMPACT}
      title={"Connect.\n"}
      titleAccent="Make it happen."
      subtitle="Not another feed. Just a way to get together."
      ctaLabel="Continue"
      onNext={() => router.push("/(auth)/getting-started")}
    >
      <JumpInGraphic />
    </OnboardingImmersiveSlide>
  );
}
