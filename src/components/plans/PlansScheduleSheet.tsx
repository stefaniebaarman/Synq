import {
  ACCENT,
  ACCENT_BORDER,
  BG,
  BORDER,
  BORDER_MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  RADIUS_SM,
  SURFACES,
  TEXT,
  TEXT_MUTED_DARK,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  fonts,
  cardMetaText,
  listRowTitleText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { openInMaps } from "@/src/lib/openInMaps";
import { sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS_BEFORE = 2;
const MONTHS_AFTER = 8;
/** Show ~3 plan cards before the day list scrolls. */
const PLAN_LIST_VISIBLE_COUNT = 3;
const PLAN_ROW_EST_HEIGHT = 72;
const PLAN_LIST_FADE = ["rgba(9,10,11,0)", "rgba(9,10,11,0.55)"] as const;

export type SchedulePlanEvent = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  locationLat?: number;
  locationLng?: number;
};

type Props = {
  visible: boolean;
  events: SchedulePlanEvent[];
  accentColor?: string;
  onClose: () => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function buildMonthCells(visibleMonth: Date) {
  const y = visibleMonth.getFullYear();
  const m = visibleMonth.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const result: { date: Date | null; key: string }[] = [];

  for (let i = 0; i < startOffset; i++) {
    result.push({ date: null, key: `pad-${y}-${m}-${i}` });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    result.push({ date: new Date(y, m, day), key: `${y}-${m}-${day}` });
  }
  return result;
}

function MonthBlock({
  month,
  selected,
  today,
  markedDates,
  accentColor,
  onSelect,
}: {
  month: Date;
  selected: Date;
  today: Date;
  markedDates: Set<string>;
  accentColor: string;
  onSelect: (d: Date) => void;
}) {
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const label = month.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.monthBlock}>
      <Text style={styles.monthLabel}>{label}</Text>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={`${label}-${w}-${i}`} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map(({ date, key }) => {
          if (!date) return <View key={key} style={styles.cell} />;
          const keyStr = dateKey(date);
          const selectedDay = isSameDay(date, selected);
          const isToday = isSameDay(date, today);
          const marked = markedDates.has(keyStr);

          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              onPress={() => onSelect(date)}
              accessibilityRole="button"
              accessibilityLabel={`${date.toLocaleDateString()}${
                marked ? ", has plans" : ""
              }`}
              accessibilityState={{ selected: selectedDay }}
            >
              <View
                style={[
                  styles.dayBubble,
                  selectedDay && { backgroundColor: accentColor },
                  isToday && !selectedDay && styles.todayBubble,
                  marked && !selectedDay && {
                    borderWidth: 1,
                    borderColor: accentColor,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selectedDay && styles.dayTextSelected,
                    marked && !selectedDay && { color: accentColor },
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
              {marked ? (
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: selectedDay
                        ? ON_ACCENT_TEXT
                        : accentColor,
                    },
                    selectedDay && styles.dotOnSelected,
                  ]}
                />
              ) : (
                <View style={styles.dotSpacer} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function PlansScheduleSheet({
  visible,
  events,
  accentColor = ACCENT,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<Record<string, number>>({});
  const didInitialScroll = useRef(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const markedDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      const d = String(e.date || "").trim();
      if (d) set.add(d);
    }
    return set;
  }, [events]);

  const months = useMemo(() => {
    const base = monthStart(today);
    const list: Date[] = [];
    for (let i = -MONTHS_BEFORE; i <= MONTHS_AFTER; i++) {
      list.push(addMonths(base, i));
    }
    return list;
  }, [today]);

  const dayPlans = useMemo(() => {
    const key = dateKey(selected);
    return sortOpenPlansByDateTime(
      events.filter((e) => String(e.date || "").trim() === key)
    );
  }, [events, selected]);

  const planListScrollable = dayPlans.length > PLAN_LIST_VISIBLE_COUNT;

  useEffect(() => {
    if (!visible) {
      didInitialScroll.current = false;
      return;
    }
    setSelected(startOfDay(new Date()));
  }, [visible]);

  const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;

  const scrollToCurrentMonth = (y: number) => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
    });
  };

  // Fallback when month layouts are already cached from a prior open.
  useEffect(() => {
    if (!visible || didInitialScroll.current) return;
    const y = monthOffsets.current[currentMonthKey];
    if (typeof y !== "number") return;
    scrollToCurrentMonth(y);
  }, [visible, currentMonthKey]);

  const selectedLabel = selected.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const sheetMax = Math.min(windowH * 0.88, windowH - insets.top - 24);
  const bottomPad = Math.max(insets.bottom, 12) + 28;

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      contentStyle={styles.sheetLift}
      cardStyle={[
        styles.card,
        {
          maxHeight: sheetMax,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <CloseButton onPress={onClose} accessibilityLabel="Close schedule" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.monthScroll}
        contentContainerStyle={styles.monthScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {months.map((month) => {
          const key = `${month.getFullYear()}-${month.getMonth()}`;
          return (
            <View
              key={key}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                monthOffsets.current[key] = y;
                if (visible && key === currentMonthKey) {
                  scrollToCurrentMonth(y);
                }
              }}
            >
              <MonthBlock
                month={month}
                selected={selected}
                today={today}
                markedDates={markedDates}
                accentColor={accentColor}
                onSelect={(d) => setSelected(startOfDay(d))}
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.daySection}>
        <Text
          style={[
            styles.daySectionTitle,
            dayPlans.length > 0 && { color: accentColor },
          ]}
        >
          {selectedLabel}
        </Text>
        {dayPlans.length === 0 ? (
          <Text style={styles.emptyDay}>No plans this day</Text>
        ) : (
          <View style={styles.planListWrap}>
            <ScrollView
              style={planListScrollable ? styles.planListScroll : undefined}
              contentContainerStyle={styles.planListContent}
              showsVerticalScrollIndicator={planListScrollable}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {dayPlans.map((plan) => (
                <View key={plan.id} style={styles.planRow}>
                  <View
                    style={[
                      styles.planAccentBar,
                      { backgroundColor: accentColor },
                    ]}
                  />
                  <View style={styles.planTextCol}>
                    <Text style={styles.planTitle} numberOfLines={2}>
                      {plan.title}
                    </Text>
                    {(plan.time || plan.location) ? (
                      <Text style={styles.planMeta}>
                        {plan.location ? (
                          <Text
                            style={styles.planLocation}
                            onPress={() => {
                              const lat = Number(plan.locationLat);
                              const lng = Number(plan.locationLng);
                              void openInMaps({
                                name: String(plan.location || "").trim(),
                                ...(Number.isFinite(lat) && Number.isFinite(lng)
                                  ? { lat, lng }
                                  : {}),
                              });
                            }}
                          >
                            {plan.location}
                          </Text>
                        ) : null}
                        {plan.location && plan.time ? " · " : null}
                        {plan.time || null}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </ScrollView>
            {planListScrollable ? (
              <LinearGradient
                pointerEvents="none"
                colors={[...PLAN_LIST_FADE]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.planListFade}
              />
            ) : null}
          </View>
        )}
      </View>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    overflow: "hidden",
  },
  sheetLift: {
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  monthScroll: {
    maxHeight: 340,
  },
  monthScrollContent: {
    paddingBottom: 8,
  },
  monthBlock: {
    marginBottom: 18,
  },
  monthLabel: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    marginBottom: 10,
    textAlign: "center",
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: MUTED3,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.285%",
    alignItems: "center",
    paddingVertical: 4,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBubble: {
    borderWidth: 1,
    borderColor: BORDER_MUTED,
  },
  dayText: {
    color: TEXT,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.medium,
  },
  dayTextSelected: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  dotOnSelected: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  dotSpacer: {
    height: 5,
    marginTop: 3,
  },
  daySection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER_MUTED,
    paddingTop: 14,
    marginTop: 4,
    minHeight: 96,
    paddingBottom: 8,
  },
  daySectionTitle: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  emptyDay: {
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
  },
  planListWrap: {
    position: "relative",
  },
  planListScroll: {
    maxHeight: PLAN_LIST_VISIBLE_COUNT * PLAN_ROW_EST_HEIGHT,
  },
  planListContent: {
    paddingBottom: 2,
  },
  planListFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACES.elevated,
    borderRadius: RADIUS_SM,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 0,
    marginBottom: 8,
    overflow: "hidden",
  },
  planAccentBar: {
    width: 3,
    alignSelf: "stretch",
    borderTopLeftRadius: RADIUS_SM,
    borderBottomLeftRadius: RADIUS_SM,
  },
  planTextCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 2,
  },
  planTitle: {
    ...listRowTitleText,
  },
  planMeta: {
    ...cardMetaText,
    marginTop: 4,
    lineHeight: 18,
  },
  planLocation: {
    ...cardMetaText,
    lineHeight: 18,
    fontFamily: fonts.medium,
  },
});
