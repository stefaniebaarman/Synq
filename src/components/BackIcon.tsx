import {
  BACK_ICON_COLOR,
  BACK_ICON_NAME,
  BACK_ICON_SIZE,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Props = {
  size?: number;
};

export default function BackIcon({ size = BACK_ICON_SIZE }: Props) {
  return (
    <Ionicons
      name={BACK_ICON_NAME}
      size={size}
      color={BACK_ICON_COLOR}
    />
  );
}
