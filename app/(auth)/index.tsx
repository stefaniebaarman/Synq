import OnboardingImmersiveSlide from "@/src/components/onboarding/OnboardingImmersiveSlide";
import { PulseHeroGraphic } from "@/src/components/onboarding/onboardingGraphics";
import { BG } from "@/constants/Variables";
import { Redirect, router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useAuthRefresh } from "../_layout";

export default function MakePlansScreen() {
  const { user, authReady } = useAuthRefresh();

  if (!authReady) {
    return <View style={styles.boot} />;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

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

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: BG,
  },
});
