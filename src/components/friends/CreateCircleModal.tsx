import {
  ACCENT,
  BG,
  BG_FADE_MID,
  BG_TRANSPARENT,
  BORDER_SOFT,
  BUTTON_RADIUS,
  Friend,
  MUTED2,
  MUTED3,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  heroTitleText,
  fonts,
  MODAL_RADIUS,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { useCreateSheetLayout } from "@/src/components/friends/createSheetLayout";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const CTA_FADE_HEIGHT = 40;

type Props = {
  visible: boolean;
  busy?: boolean;
  friends: Friend[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void | Promise<void>;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export default function CreateCircleModal({
  visible,
  busy,
  friends,
  onClose,
  onCreate,
}: Props) {
  const { keyboardAvoidStyle, matchedSheetHeight, paddingBottom } =
    useCreateSheetLayout();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setName("");
      setQuery("");
      setSelected(new Set());
      setKeyboardVisible(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const onShow = () => setKeyboardVisible(true);
    const onHide = () => setKeyboardVisible(false);
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends
      .filter((f) => !q || (f.displayName || "").toLowerCase().includes(q))
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [friends, query]);

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
    onClose();
  };

  const handleBackdropPress = () => {
    if (keyboardVisible) {
      Keyboard.dismiss();
      return;
    }
    handleClose();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    Keyboard.dismiss();
    await onCreate(trimmed, [...selected]);
  };

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={handleClose}
      onBackdropPress={handleBackdropPress}
      cardStyle={[keyboardAvoidStyle, styles.sheetCard]}
    >
      <View
        style={[
          styles.sheet,
          { height: matchedSheetHeight, paddingBottom },
        ]}
      >
        <Pressable onPress={dismissKeyboard} accessible={false}>
          <View style={styles.header}>
            <Text style={styles.title}>New circle</Text>
            <CloseButton onPress={handleClose} />
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel>Circle name</FieldLabel>
            <View style={styles.searchBar}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. Running buddies"
                placeholderTextColor={MUTED2}
                value={name}
                onChangeText={setName}
                maxLength={40}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={dismissKeyboard}
              />
            </View>
          </View>

          <FieldLabel>Add friends</FieldLabel>
        </Pressable>

        <View style={styles.friendsSection}>
          {friends.length > 0 ? (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={17} color={MUTED2} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search friends"
                  placeholderTextColor={MUTED2}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  blurOnSubmit
                  onSubmitEditing={dismissKeyboard}
                />
              </View>
              <FlatList
                data={candidates}
                keyExtractor={(item) => item.id}
                style={styles.friendList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={dismissKeyboard}
                ListEmptyComponent={
                  <Pressable onPress={dismissKeyboard} accessible={false}>
                    <View style={styles.empty}>
                      <Text style={styles.emptyText}>No friends match your search.</Text>
                    </View>
                  </Pressable>
                }
                renderItem={({ item }) => {
                  const checked = selected.has(item.id);
                  return (
                    <TouchableOpacity
                      style={styles.row}
                      onPress={() => {
                        dismissKeyboard();
                        toggle(item.id);
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                    >
                      <View style={styles.avatarRing}>
                        <ExpoImage
                          source={{ uri: resolveAvatar(item.imageurl) }}
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
            </>
          ) : (
            <Pressable onPress={dismissKeyboard} accessible={false}>
              <Text style={styles.emptyFriends}>
                You don&apos;t have any friends to add yet.
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.ctaFooter}>
          <LinearGradient
            pointerEvents="none"
            colors={[BG_TRANSPARENT, BG_FADE_MID, BG]}
            locations={[0, 0.55, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.ctaFade}
          />
          <TouchableOpacity
            style={[synqOutlineAddBtn, !canSubmit && synqOutlineAddBtnDisabled]}
            disabled={!canSubmit}
            onPress={() => void handleCreate()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Create circle"
          >
            <Text
              style={[
                synqOutlineAddBtnText,
                !canSubmit && synqOutlineAddBtnTextDisabled,
              ]}
            >
              {busy ? "Creating…" : "Create"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SpringBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetCard: {
    backgroundColor: BG,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    ...heroTitleText,
  },
  fieldBlock: {
    gap: 8,
    marginBottom: 16,
  },
  friendsSection: {
    flex: 1,
    minHeight: 0,
    marginTop: 8,
    gap: 8,
  },
  friendList: {
    flex: 1,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.04,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    alignSelf: "stretch",
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    paddingTop: 13,
    paddingBottom: 13,
    paddingHorizontal: 0,
    margin: 0,
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
    paddingVertical: 20,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
  },
  emptyFriends: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    lineHeight: 18,
    paddingVertical: 8,
  },
  ctaFooter: {
    position: "relative",
    backgroundColor: BG,
    paddingTop: 12,
  },
  ctaFade: {
    position: "absolute",
    left: -20,
    right: -20,
    top: -CTA_FADE_HEIGHT,
    height: CTA_FADE_HEIGHT,
  },
});
