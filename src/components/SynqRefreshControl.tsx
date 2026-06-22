import { ACCENT, ACCENT_REFRESH_TINT, BG } from "@/constants/Variables";
import { RefreshControl, type RefreshControlProps } from "react-native";

export default function SynqRefreshControl(props: RefreshControlProps) {
  return (
    <RefreshControl
      tintColor={ACCENT_REFRESH_TINT}
      colors={[ACCENT]}
      progressBackgroundColor={BG}
      {...props}
    />
  );
}
