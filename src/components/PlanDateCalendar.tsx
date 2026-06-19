import {
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_FINE,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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

type Props = {
  value: Date;
  minimumDate: Date;
  onChange: (date: Date) => void;
  accentColor: string;
};

export default function PlanDateCalendar({
  value,
  minimumDate,
  onChange,
  accentColor,
}: Props) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const d = new Date(value);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const min = startOfDay(minimumDate);
  const today = startOfDay(new Date());

  const minMonth = useMemo(() => {
    const d = new Date(min);
    d.setDate(1);
    return d;
  }, [minimumDate]);

  useEffect(() => {
    const d = new Date(value);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setVisibleMonth((prev) =>
      prev.getFullYear() === d.getFullYear() && prev.getMonth() === d.getMonth()
        ? prev
        : d
    );
  }, [value.getFullYear(), value.getMonth()]);

  const canGoPrev =
    visibleMonth.getFullYear() > minMonth.getFullYear() ||
    (visibleMonth.getFullYear() === minMonth.getFullYear() &&
      visibleMonth.getMonth() > minMonth.getMonth());

  const cells = useMemo(() => {
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
  }, [visibleMonth]);

  const monthLabel = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            setVisibleMonth(
              (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
            )
          }
          disabled={!canGoPrev}
          style={styles.navBtn}
          accessibilityLabel="Previous month"
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={canGoPrev ? "#fff" : "#333"}
          />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() =>
            setVisibleMonth(
              (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
            )
          }
          style={styles.navBtn}
          accessibilityLabel="Next month"
        >
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((label, i) => (
          <Text key={`${label}-${i}`} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map(({ date, key }) => {
          if (!date) {
            return <View key={key} style={styles.cell} />;
          }

          const disabled = startOfDay(date) < min;
          const selected = isSameDay(date, value);
          const isToday = isSameDay(date, today);

          return (
            <TouchableOpacity
              key={key}
              style={styles.cell}
              disabled={disabled}
              onPress={() => {
                const next = new Date(value);
                next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                onChange(next);
              }}
              accessibilityLabel={date.toLocaleDateString()}
              accessibilityState={{ selected, disabled }}
            >
              <View
                style={[
                  styles.dayBubble,
                  selected && { backgroundColor: accentColor },
                  isToday && !selected && styles.todayBubble,
                  disabled && styles.dayDisabled,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && styles.dayTextSelected,
                    disabled && styles.dayTextDisabled,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navBtn: {
    padding: 6,
    width: 36,
    alignItems: "center",
  },
  monthLabel: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    color: "#666",
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.285%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  todayBubble: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  dayDisabled: {
    opacity: 0.28,
  },
  dayText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
  dayTextSelected: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
  },
  dayTextDisabled: {
    color: "#444",
  },
});
