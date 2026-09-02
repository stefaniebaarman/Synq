import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import { WhosFreeGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { ONBOARDING_HERO_TOP_COMPACT } from "@/constants/onboardingLayout";
import { router } from "expo-router";
import { Dimensions } from "react-native";

const WHOS_DOWN_HERO_TOP =
  ONBOARDING_HERO_TOP_COMPACT + Math.round(Dimensions.get("window").height * 0.05);

export default function SpontaneousHangouts() {
  return (
    <OnboardingImmersiveSlide
      step={2}
      heroTop={WHOS_DOWN_HERO_TOP}
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
