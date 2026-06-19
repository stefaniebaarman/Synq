import {
  BORDER,
  fonts,
} from "@/constants/Variables";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";

const WHEEL_BG = "#050505";

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  accentColor: string;
};

/** Plan times: 7:00 AM – 11:00 PM in 30-minute steps. */
export function clampPlanTime(date: Date, base: Date): Date {
  const next = new Date(base);
  let hours = date.getHours();
  let minutes = date.getMinutes() >= 30 ? 30 : 0;

  if (hours < 7) {
    hours = 7;
    minutes = 0;
  } else if (hours > 23 || (hours === 23 && minutes > 0)) {
    hours = 23;
    minutes = 0;
  }

  next.setHours(hours, minutes, 0, 0);
  return next;
}

export default function PlanTimePicker({ value, onChange, accentColor }: Props) {
  const handleChange = useCallback(
    (event: DateTimePickerEvent, picked?: Date) => {
      if (event.type === "dismissed" || !picked) return;
      onChange(clampPlanTime(picked, value));
    },
    [onChange, value]
  );

  return (
    <View style={styles.root}>
      <View style={styles.frame}>
        <DateTimePicker
          value={value}
          mode="time"
          display="spinner"
          minuteInterval={30}
          onChange={handleChange}
          themeVariant="dark"
          accentColor={accentColor}
          textColor="#FFFFFF"
          style={styles.picker}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 10,
  },
  frame: {
    borderRadius: 14,
    backgroundColor: WHEEL_BG,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    height: Platform.OS === "ios" ? 216 : 200,
  },
  picker: {
    height: Platform.OS === "ios" ? 216 : 200,
    width: "100%",
  },
});
