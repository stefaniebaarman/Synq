import { ACCENT, BG } from "@/constants/Variables";
import { RefreshControl, type RefreshControlProps } from "react-native";

/** Subtle accent — native spinners read harsh at full #00FF85. */
export const SYNQ_REFRESH_TINT = "rgba(0,255,133,0.58)";

export default function SynqRefreshControl(props: RefreshControlProps) {
  return (
    <RefreshControl
      tintColor={SYNQ_REFRESH_TINT}
      colors={[ACCENT]}
      progressBackgroundColor={BG}
      {...props}
    />
  );
}
