import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  DISABLED_ACCENT,
  Friend,
  MODAL_RADIUS,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  sheetHeaderTitleText,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy?: boolean;
  friends: Friend[];
  existingMemberIds: string[];
  pendingInviteIds?: string[];
  mode?: "add" | "invite";
  onClose: () => void;
  onAdd: (memberIds: string[]) => void | Promise<void>;
};

function actionCtaLabel(mode: "add" | "invite", selectedCount: number): string {
  if (mode === "invite") {
    if (selectedCount === 0) return "Send invites";
    if (selectedCount === 1) return "Send invite";
    return `Send invites (${selectedCount})`;
  }
  if (selectedCount === 0) return "Add members";
  if (selectedCount === 1) return "Add member";
  return `Add members (${selectedCount})`;
}

const WINDOW_HEIGHT = Dimensions.get("window").height;
const LIST_MAX_HEIGHT_DEFAULT = 340;
/** Grabber + header + search + CTA + vertical padding (excludes safe-area bottom). */
const SHEET_CHROME_HEIGHT = 220;

export default function AddMembersToGroupSheet({
  visible,
  busy,
  friends,
  existingMemberIds,
  pendingInviteIds = [],
  mode = "add",
  onClose,
  onAdd,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyboardInset, setKeyboardInset] = useState(0);
  const paddingBottom = Math.max(24, insets.bottom);

  useEffect(() => {
    if (!visible) {
      setKeyboardInset(0);
      return;
    }

    const onShow = (e: KeyboardEvent) => setKeyboardInset(e.endCoordinates.height);
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

  const listHeight = useMemo(() => {
    const sheetCap = WINDOW_HEIGHT * 0.88;
    const keyboardPad = keyboardInset > 0 ? Math.min(keyboardInset, WINDOW_HEIGHT * 0.45) : 0;
    const available = sheetCap - SHEET_CHROME_HEIGHT - paddingBottom - keyboardPad;
    return Math.max(120, Math.min(LIST_MAX_HEIGHT_DEFAULT, available));
  }, [keyboardInset, paddingBottom]);

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);
  const pendingInviteSet = useMemo(() => new Set(pendingInviteIds), [pendingInviteIds]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends
      .filter((f) => !existingSet.has(f.id) && !pendingInviteSet.has(f.id))
      .filter((f) => !q || (f.displayName || "").toLowerCase().includes(q))
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [friends, existingSet, pendingInviteSet, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    Keyboard.dismiss();
    setQuery("");
    setSelected(new Set());
    setKeyboardInset(0);
    onClose();
  };

  const handleBackdropPress = () => {
    if (keyboardInset > 0) {
      Keyboard.dismiss();
      return;
    }
    handleClose();
  };

  const handleAdd = () => {
    if (selected.size === 0 || busy) return;
    const memberIds = [...selected];
    Keyboard.dismiss();
    setQuery("");
    setSelected(new Set());
    void onAdd(memberIds);
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={handleClose}
      onBackdropPress={handleBackdropPress}
      cardStyle={styles.card}
    >
      <KeyboardAvoidingView
        style={styles.keyboardInner}
        behavior="padding"
        keyboardVerticalOffset={insets.bottom}
      >
        <View style={[styles.sheet, { paddingBottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{mode === "invite" ? "Invite friends" : "Add members"}</Text>
            <CloseButton onPress={handleClose} />
          </View>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={MUTED2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              placeholderTextColor={MUTED2}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            style={{ height: listHeight }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {friends.length === existingMemberIds.length + pendingInviteIds.length
                    ? mode === "invite"
                      ? "All friends are already in this group or have a pending invite."
                      : "All friends are already in this group."
                    : "No friends match your search."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const checked = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View style={styles.avatarRing}>
                    <ExpoImage
                      source={{ uri: resolveAvatar((item as { imageurl?: string }).imageurl) }}
                      style={styles.avatar}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.displayName || "Friend"}
                  </Text>
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={22}
                    color={checked ? ACCENT : MUTED2}
                  />
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity
            style={[styles.cta, (selected.size === 0 || busy) && styles.ctaDisabled]}
            disabled={selected.size === 0 || busy}
            onPress={() => void handleAdd()}
          >
            <Text style={styles.ctaText}>
              {actionCtaLabel(mode, selected.size)}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
  },
  keyboardInner: {
    width: "100%",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    ...sheetHeaderTitleText,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingVertical: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: MODAL_RADIUS,
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  avatar: {
    width: 44,
    height: 44,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  empty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
  },
  cta: {
    alignSelf: "center",
    width: "62%",
    marginTop: 12,
    minHeight: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ctaDisabled: {
    backgroundColor: DISABLED_ACCENT,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
