import OnboardingSlideShell from "@/src/components/onboarding/OnboardingSlideShell";
import { GoLiveGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { router } from "expo-router";

export default function MakePlansScreen() {
  return (
    <OnboardingSlideShell
      step={1}
      title={"Your circle,\n"}
      titleAccent="made simple."
      subtitle="Keep your people close. One tap tells them you're free."
      ctaLabel="Next"
      onNext={() => router.push("/(auth)/welcome")}
    >
      <GoLiveGraphic />
    </OnboardingSlideShell>
  );
}
