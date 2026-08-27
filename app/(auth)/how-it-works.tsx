import { ONBOARDING_HERO_TOP_COMPACT } from "@/constants/onboardingLayout";
import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import {
  PulseHeroGraphic,
  WhosFreeGraphic,
} from "@/src/components/onboarding/onboardingGraphics";
import { isOnboardingInviteDone } from "@/src/lib/inviteCode";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";

const TOTAL_STEPS = 2;

export default function HowItWorksScreen() {
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const step = stepParam === "2" ? 2 : 1;

  useEffect(() => {
    let cancelled = false;
    void isOnboardingInviteDone().then((done: boolean) => {
      if (!cancelled && done) {
        router.replace("/(tabs)/friends");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goInvite = () => {
    router.push("/(auth)/invite-friends");
  };

  if (step === 2) {
    return (
      <OnboardingImmersiveSlide
        step={2}
        totalSteps={TOTAL_STEPS}
        kicker="HOW IT WORKS"
        heroTop={ONBOARDING_HERO_TOP_COMPACT}
        title={"See who's down.\n"}
        titleAccent="Make a plan."
        subtitle="When friends are free, jump in and hang out — no endless group chat."
        ctaLabel="Next"
        onNext={goInvite}
        onBack={() => router.replace("/(auth)/how-it-works?step=1")}
        onSkip={goInvite}
      >
        <WhosFreeGraphic />
      </OnboardingImmersiveSlide>
    );
  }

  return (
    <OnboardingImmersiveSlide
      step={1}
      totalSteps={TOTAL_STEPS}
      kicker="HOW IT WORKS"
      heroTop={ONBOARDING_HERO_TOP_COMPACT}
      title={"Tap the Synq button\n"}
      titleAccent="to go live."
      subtitle="Friends see you're down to hang — so you can catch the moment together."
      ctaLabel="Next"
      onNext={() => router.push("/(auth)/how-it-works?step=2")}
      onSkip={goInvite}
    >
      <PulseHeroGraphic />
    </OnboardingImmersiveSlide>
  );
}
