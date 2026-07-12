import OnboardingSlideShell from "@/src/components/onboarding/OnboardingSlideShell";
import { JumpInGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { router } from "expo-router";
import React from "react";

export default function SeeWhenFriendsAvailable() {
  return (
    <OnboardingSlideShell
      step={3}
      title={"Connect and\n"}
      titleAccent="make it happen."
      subtitle="No guessing, no waiting. Turn free moments into real hangouts."
      ctaLabel="Continue"
      onNext={() => router.push("/(auth)/getting-started")}
    >
      <JumpInGraphic />
    </OnboardingSlideShell>
  );
}
