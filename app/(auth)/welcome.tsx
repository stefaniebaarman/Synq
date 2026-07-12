import OnboardingSlideShell from "@/src/components/onboarding/OnboardingSlideShell";
import { WhosFreeGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { router } from "expo-router";

export default function SpontaneousHangouts() {
  return (
    <OnboardingSlideShell
      step={2}
      title={"See who's down,\n"}
      titleAccent="right now."
      subtitle="Real-time availability for real-life hangouts."
      ctaLabel="Next"
      onNext={() => router.push("/(auth)/next")}
    >
      <WhosFreeGraphic />
    </OnboardingSlideShell>
  );
}
