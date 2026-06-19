import {
  CLOSE_ICON_COLOR,
  CLOSE_ICON_COLOR_INLINE,
  CLOSE_ICON_NAME,
  CLOSE_ICON_SIZE,
  CLOSE_ICON_SIZE_INLINE,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Props = {
  size?: number;
  color?: string;
  /** `inline` — search / field clear; `default` — sheets and modals. */
  variant?: "default" | "inline";
};

export default function CloseIcon({
  size,
  color,
  variant = "default",
}: Props) {
  const isInline = variant === "inline";
  const resolvedSize =
    size ?? (isInline ? CLOSE_ICON_SIZE_INLINE : CLOSE_ICON_SIZE);
  const resolvedColor =
    color ?? (isInline ? CLOSE_ICON_COLOR_INLINE : CLOSE_ICON_COLOR);

  return (
    <Ionicons
      name={CLOSE_ICON_NAME}
      size={resolvedSize}
      color={resolvedColor}
    />
  );
}
