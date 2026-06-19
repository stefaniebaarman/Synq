import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  Friend,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
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
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!visible) {
      setName("");
      setQuery("");
      setSelected(new Set());
      setKeyboardInset(0);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

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
    if (keyboardInset > 0) {
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

  const selectedCount = selected.size;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Dismiss"
        />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior="padding"
          keyboardVerticalOffset={insets.bottom}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}
            onPress={dismissKeyboard}
          >
            <View style={styles.header}>
              <Text style={styles.title}>New circle</Text>
              <CloseButton onPress={handleClose} />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>Circle name</FieldLabel>
              <TextInput
                style={styles.input}
                placeholder="e.g. Close friends"
                placeholderTextColor={MUTED2}
                value={name}
                onChangeText={setName}
                maxLength={40}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={dismissKeyboard}
              />
            </View>

            <View style={styles.fieldBlock}>
              <FieldLabel>Add friends</FieldLabel>
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
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Text style={styles.emptyText}>No friends match your search.</Text>
                      </View>
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
                <Text style={styles.emptyFriends}>
                  You don&apos;t have any friends to add yet.
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.cta, !canSubmit && styles.ctaDisabled]}
              disabled={!canSubmit}
              onPress={() => void handleCreate()}
              accessibilityRole="button"
              accessibilityLabel="Create circle"
            >
              {busy ? (
                <ActivityIndicator color={ON_ACCENT_TEXT} />
              ) : (
                <Text style={styles.ctaText}>
                  {selectedCount > 0 ? `Create · ${selectedCount} friend${selectedCount === 1 ? "" : "s"}` : "Create"}
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  keyboardAvoid: {
    width: "100%",
    maxHeight: "92%",
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: TYPE_SECTION,
    color: TEXT,
  },
  fieldBlock: {
    gap: 8,
    marginBottom: 16,
  },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    letterSpacing: 0.04,
  },
  input: {
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: MUTED3,
    backgroundColor: "rgba(255,255,255,0.04)",
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
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
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingVertical: 0,
  },
  friendList: {
    maxHeight: 240,
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
    borderRadius: 22,
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
  cta: {
    alignSelf: "center",
    width: "62%",
    marginTop: 4,
    minHeight: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
