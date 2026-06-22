import AlertModal from "@/app/alert-modal";
import {
  ACCENT,
  ACCENT_FILL_SUBTLE,
  BG,
  BORDER,
  BORDER_SOFT,
  BUTTON_RADIUS,
  GROUP_BORDER,
  MODAL_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  OVERLAY_HEAVY,
  PLACEHOLDER_DARK,
  PRIMARY_CTA_WIDTH,
  SURFACE_DEEP,
  SURFACE_DEEPER,
  TEXT,
  TEXT_MUTED_LIGHT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MODAL_TITLE,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import PlanTimePicker from "@/src/components/PlanTimePicker";
import { filterOrReject } from "@/src/lib/contentFilter";
import { formatPlanTimeForStorage } from "@/src/lib/planEvents";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; date: string; time: string; location: string }) => void;
};

function getInitialDate() {
  const d = new Date();
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
}

function formatDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date) {
  return formatPlanTimeForStorage(d);
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DateBtn({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.dateBtn,
        selected && {
          borderColor: ACCENT,
          backgroundColor: `${ACCENT}22`,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.dateBtnText, selected && styles.dateBtnTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateCommunityPlanModal({ visible, busy, onClose, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const modalMaxHeight = useMemo(() => {
    const windowH = Dimensions.get("window").height;
    return windowH - insets.top - insets.bottom - 24;
  }, [insets.top, insets.bottom]);

  const todayRef = new Date();
  const tomorrowRef = new Date(Date.now() + 86400000);
  const isToday = isSameCalendarDay(selectedDate, todayRef);
  const isTomorrow = isSameCalendarDay(selectedDate, tomorrowRef);

  const canPost = title.trim().length > 0 && !busy;

  const resetForm = useCallback(() => {
    setTitle("");
    setLocation("");
    setSelectedDate(getInitialDate());
    setTimePickerOpen(false);
    setKeyboardInset(0);
  }, []);

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible) return;

    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardInset(0);

    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const setDate = (base: Date) => {
    const d = new Date(base);
    d.setHours(selectedDate.getHours());
    d.setMinutes(selectedDate.getMinutes());
    setSelectedDate(d);
  };

  const handleClose = () => {
    if (busy) return;
    Keyboard.dismiss();
    resetForm();
    onClose();
  };

  const handleBackdropPress = () => {
    if (keyboardInset > 0) {
      Keyboard.dismiss();
      return;
    }
    if (timePickerOpen) {
      setTimePickerOpen(false);
      return;
    }
    handleClose();
  };

  const handleSubmit = () => {
    if (!canPost) return;

    const trimmedTitle = title.trim();
    const titleCheck = filterOrReject(trimmedTitle);
    if (!titleCheck.ok) {
      setAlertMessage(titleCheck.reason);
      setAlertVisible(true);
      return;
    }
    const locationTrimmed = location.trim();
    if (locationTrimmed) {
      const locationCheck = filterOrReject(locationTrimmed);
      if (!locationCheck.ok) {
        setAlertMessage(locationCheck.reason);
        setAlertVisible(true);
        return;
      }
    }

    Keyboard.dismiss();
    onCreate({
      title: trimmedTitle,
      date: formatDateValue(selectedDate),
      time: formatTime(selectedDate),
      location: locationTrimmed,
    });
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View
          style={[
            styles.popupOverlay,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Close plan editor"
          />
          <View
            style={[
              styles.popupAvoid,
              { maxHeight: modalMaxHeight },
              keyboardInset > 0 ? { marginBottom: keyboardInset } : null,
            ]}
            pointerEvents="box-none"
          >
            <View style={[styles.popupCard, { maxHeight: modalMaxHeight }]}>
              <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                <View style={styles.popupTitleRow}>
                  <Text style={styles.popupTitle}>Share a plan</Text>
                  <CloseButton onPress={handleClose} accessibilityLabel="Close" />
                </View>
              </TouchableWithoutFeedback>

              <ScrollView
                style={styles.popupScroll}
                contentContainerStyle={styles.popupScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
              >
                <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                  <View>
                    <TextInput
                      placeholder="What's the plan?"
                      placeholderTextColor={PLACEHOLDER_DARK}
                      style={styles.planInput}
                      value={title}
                      onFocus={() => setTimePickerOpen(false)}
                      onChangeText={setTitle}
                      maxLength={80}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />

                    <View style={styles.scheduleBlock}>
                      <View style={styles.quickDateRow}>
                        <DateBtn
                          label="Today"
                          selected={isToday}
                          onPress={() => {
                            Keyboard.dismiss();
                            setTimePickerOpen(false);
                            setDate(new Date());
                          }}
                        />
                        <DateBtn
                          label="Tomorrow"
                          selected={isTomorrow}
                          onPress={() => {
                            Keyboard.dismiss();
                            setTimePickerOpen(false);
                            setDate(new Date(Date.now() + 86400000));
                          }}
                        />
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.timeField,
                          timePickerOpen && styles.timeFieldActive,
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setTimePickerOpen((open) => !open);
                        }}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={timePickerOpen ? ACCENT : TEXT_MUTED_LIGHT}
                        />
                        <View style={styles.timeFieldTextWrap}>
                          <Text style={styles.timeFieldLabel}>Time</Text>
                          <Text style={styles.timeFieldValue}>{formatTime(selectedDate)}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>

                    {timePickerOpen ? (
                      <PlanTimePicker
                        value={selectedDate}
                        accentColor={ACCENT}
                        onChange={setSelectedDate}
                      />
                    ) : null}

                    <View style={styles.locationFieldWrap}>
                      <TextInput
                        placeholder="Add location (optional)"
                        placeholderTextColor={PLACEHOLDER_DARK}
                        style={styles.planInputSecondary}
                        value={location}
                        onFocus={() => setTimePickerOpen(false)}
                        onChangeText={setLocation}
                        maxLength={120}
                        returnKeyType="done"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.popupPostBtn, !canPost && styles.popupPostBtnDisabled]}
                      disabled={!canPost}
                      onPress={handleSubmit}
                      activeOpacity={0.88}
                    >
                      {busy ? (
                        <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
                      ) : (
                        <Text style={styles.popupPostBtnText}>Share</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  popupOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_HEAVY,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popupAvoid: {
    width: "100%",
    maxWidth: 400,
  },
  popupCard: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  popupScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  popupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  popupTitle: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_MODAL_TITLE,
    letterSpacing: -0.2,
  },
  popupScrollContent: {
    paddingBottom: 4,
  },
  popupPostBtn: {
    marginTop: 14,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: 50,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  popupPostBtnDisabled: {
    opacity: 0.4,
  },
  popupPostBtnText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
  planInput: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    padding: 14,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    marginBottom: 10,
  },
  locationFieldWrap: {
    marginTop: 10,
  },
  planInputSecondary: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    padding: 12,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    marginBottom: 0,
  },
  scheduleBlock: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: BUTTON_RADIUS,
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 8,
  },
  timeField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE_DEEPER,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  timeFieldActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  timeFieldTextWrap: {
    flex: 1,
    gap: 2,
  },
  timeFieldLabel: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.book,
  },
  timeFieldValue: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.heavy,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: SURFACE_DEEPER,
  },
  dateBtnText: {
    color: TEXT,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
  },
  dateBtnTextSelected: {
    color: ACCENT,
  },
});
