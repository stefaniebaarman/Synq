import { Stack } from "expo-router";
import { BG } from "@/constants/Variables";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: BG },
      }}
    />
  );
}
