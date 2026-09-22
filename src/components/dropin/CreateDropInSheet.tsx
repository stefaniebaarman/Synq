import SynqAudienceSheet from "@/app/synq-screens/SynqAudienceSheet";
import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  GROUP_BORDER,
  MUTED2,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_INPUT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  fonts,
  sheetTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
} from "@/constants/Variables";
import PlanLocationField, {
  type PlanLocationValue,
} from "@/src/components/plans/PlanLocationField";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  DROP_IN_EXPIRATION_MS,
  createDropIn,
  dropInErrorMessage,
  fetchMyDropInFromServer,
  type DropInPlace,
  warmDropInClient,
} from "@/src/lib/dropIn";
import type { FriendGroup } from "@/src/lib/friendGroups";
import {
  formatAudienceSelectionLabel,
  type SynqAudienceSelection,
} from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  friendGroups: FriendGroup[];
  initialAudience: SynqAudienceSelection;
  onSent?: (payload: {
    text: string;
    place: DropInPlace | null;
    expiresAtMs: number;
    audience: SynqAudienceSelection;
  }) => void;
  onSendFailed?: () => void;
  onError?: (message: string) => void;
};

const EMPTY_PLACE: PlanLocationValue = { location: "" };
const ACTIONS_BLOCK = 120;

export default function CreateDropInSheet({
  visible,
  onClose,
  friendGroups,
  initialAudience,
  onSent,
  onSendFailed,
  onError,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [placeValue, setPlaceValue] = useState<PlanLocationValue>(EMPTY_PLACE);
  const [audience, setAudience] = useState<SynqAudienceSelection>(initialAudience);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    // Only reset when the sheet opens — not when parent audience object identity changes.
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;
    warmDropInClient();
    setPlaceValue(EMPTY_PLACE);
    setAudience(initialAudience);
    setAudienceOpen(false);
    setBusy(false);
  }, [visible, initialAudience]);

  const audienceLabel = formatAudienceSelectionLabel(audience, friendGroups);
  const where = placeValue.location.trim();
  const canSend = where.length > 0 && !busy;
  const sheetMaxHeight = Math.round(windowHeight * 0.78);
  const sheetVerticalPad = Math.max(24, insets.bottom + 16);
  const formMaxHeight = Math.max(
    220,
    sheetMaxHeight - ACTIONS_BLOCK - sheetVerticalPad * 2 - 48
  );

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleSheetClose = () => {
    if (audienceOpen) {
      setAudienceOpen(false);
      return;
    }
    dismissKeyboard();
    onClose();
  };

  const handleSend = async () => {
    if (busy || audienceOpen) return;
    Keyboard.dismiss();
    if (!where) {
      onError?.("Add where you are.");
      return;
    }
    setBusy(true);
    const place: DropInPlace = {
      name: where,
      ...(placeValue.placeId ? { placeId: placeValue.placeId } : {}),
      ...(typeof placeValue.locationLat === "number"
        ? { lat: placeValue.locationLat }
        : {}),
      ...(typeof placeValue.locationLng === "number"
        ? { lng: placeValue.locationLng }
        : {}),
    };
    const storedText = where;
    const provisionalExpires = Date.now() + DROP_IN_EXPIRATION_MS;
    // Close the modal first so its overlay can't stick after the live banner mounts.
    onClose();
    // Show the live card immediately — don't wait on the callable / push fan-out.
    onSent?.({
      text: storedText,
      place,
      expiresAtMs: provisionalExpires,
      audience,
    });
    try {
      const result = await createDropIn({
        text: storedText,
        place,
        audience,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSent?.({
        text: storedText,
        place,
        expiresAtMs: result.expiresAtMs,
        audience,
      });
    } catch (err) {
      try {
        const serverState = await fetchMyDropInFromServer();
        if (serverState?.active && serverState.expiresAtMs) {
          onSent?.({
            text: serverState.text || storedText,
            place: serverState.place || place,
            expiresAtMs: serverState.expiresAtMs,
            audience,
          });
          return;
        }
      } catch {
        // Fall through to clear optimistic state.
      }
      onSendFailed?.();
      onError?.(dropInErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={handleSheetClose}
      anchor="center"
      onBackdropPress={() => {
        dismissKeyboard();
        handleSheetClose();
      }}
      contentStyle={[
        styles.sheetPad,
        {
          maxHeight: sheetMaxHeight,
          paddingTop: sheetVerticalPad,
          paddingBottom: sheetVerticalPad,
        },
      ]}
      cardStyle={[sheetStyles.sheetCard, styles.card, { backgroundColor: BG }]}
      overlay={
        <SynqAudienceSheet
          presentation="embedded"
          visible={audienceOpen}
          groups={friendGroups}
          selection={audience}
          onChangeSelection={setAudience}
          onClose={() => setAudienceOpen(false)}
          title="Share with"
          subtitle="Choose who gets notified that you're here"
        />
      }
    >
      <Pressable onPress={dismissKeyboard} accessible={false}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
          style={{ maxHeight: formMaxHeight }}
          contentContainerStyle={styles.body}
          onScrollBeginDrag={dismissKeyboard}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="location-outline" size={22} color={ACCENT} />
              <Text style={styles.title}>Share live status</Text>
            </View>
            <Text style={styles.subtitle}>
              Your selected friends will be notified
            </Text>
          </View>

          <View style={styles.whereBlock}>
            <PlanLocationField
              value={placeValue}
              onChange={setPlaceValue}
              placeholder="Search for a place…"
              accessibilityLabel="Where are you"
              style={styles.whereField}
              inputStyle={styles.fieldWell}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Pressable
              style={[styles.fieldWell, styles.audienceCard]}
              onPress={() => {
                dismissKeyboard();
                setAudienceOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Share with ${audienceLabel}`}
            >
              <View style={styles.audienceIcon}>
                <Ionicons name="people-outline" size={20} color={ACCENT} />
              </View>
              <View style={styles.audienceCopy}>
                <Text style={styles.audienceValue} numberOfLines={1}>
                  {audienceLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED2} />
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={() => void handleSend()}
            accessibilityRole="button"
            accessibilityLabel="Share"
            accessibilityState={{ disabled: !canSend }}
          >
            {busy ? (
              <ActivityIndicator color={TEXT} />
            ) : (
              <Text style={styles.sendBtnText}>Share</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.cancelBtn}
            onPress={handleSheetClose}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetPad: {
    paddingHorizontal: SPACE_4,
  },
  card: {
    paddingTop: SPACE_4,
    paddingBottom: SPACE_5,
  },
  body: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_3,
    paddingBottom: SPACE_4,
    gap: SPACE_3,
  },
  header: {
    gap: SPACE_2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    ...sheetTitleText,
    textAlign: "left",
  },
  subtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 22,
  },
  fieldBlock: {
    gap: SPACE_3,
  },
  whereBlock: {
    gap: SPACE_3,
  },
  whereField: {
    marginTop: 0,
  },
  /** Match open-plan create inputs (SURFACE_INPUT + GROUP_BORDER). */
  fieldWell: {
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: BUTTON_RADIUS,
  },
  audienceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  audienceIcon: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  audienceCopy: {
    flex: 1,
    minWidth: 0,
  },
  audienceValue: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  actions: {
    gap: SPACE_3,
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
  },
  sendBtn: {
    ...synqOutlineAddBtn,
    alignSelf: "center",
    minWidth: 148,
    paddingHorizontal: 28,
    minHeight: 48,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: synqOutlineAddBtnText,
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  cancelBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    color: MUTED2,
  },
});
