import {
  ACCENT,
  MUTED2,
  TYPE_CAPTION,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const PROFILE_PLANS_PAGE_SIZE = 3;

export function usePagedList<T>(
  items: T[],
  pageSize: number = PROFILE_PLANS_PAGE_SIZE
) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize) || 1);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(0, p), pageCount - 1));
  }, [pageCount]);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    setPage,
    pageCount,
    pageItems,
    showPager: items.length > pageSize,
  };
}

type PagerProps = {
  page: number;
  pageCount: number;
  onChangePage: (next: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function ProfilePlansPager({
  page,
  pageCount,
  onChangePage,
  style,
}: PagerProps) {
  if (pageCount <= 1) return null;

  const canPrev = page > 0;
  const canNext = page < pageCount - 1;

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => {
          if (canPrev) onChangePage(page - 1);
        }}
        disabled={!canPrev}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Previous plans page"
        accessibilityState={{ disabled: !canPrev }}
      >
        <Ionicons
          name="chevron-back"
          size={18}
          color={canPrev ? ACCENT : MUTED2}
        />
      </Pressable>
      <Text style={styles.label}>
        {page + 1} / {pageCount}
      </Text>
      <Pressable
        onPress={() => {
          if (canNext) onChangePage(page + 1);
        }}
        disabled={!canNext}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Next plans page"
        accessibilityState={{ disabled: !canNext }}
      >
        <Ionicons
          name="chevron-forward"
          size={18}
          color={canNext ? ACCENT : MUTED2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 4,
  },
  label: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.2,
    minWidth: 40,
    textAlign: "center",
  },
});
