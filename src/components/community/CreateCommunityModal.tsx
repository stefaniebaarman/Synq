import AlertModal from "@/app/alert-modal";
import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_SECTION,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import {
  COMMUNITY_GROUP_CATEGORIES,
  type CommunityGroupCategory,
} from "@/src/lib/communityGroupCategories";
import { filterOrReject } from "@/src/lib/contentFilter";
import { launchProfilePhotoPicker } from "@/src/lib/profilePhotoPicker";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type CreateCommunityInput = {
  name: string;
  category: CommunityGroupCategory;
  location?: string;
  about?: string;
  coverUri?: string | null;
};

type Props = {
  visible: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (input: CreateCommunityInput) => void | Promise<void>;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export default function CreateCommunityModal({
  visible,
  busy,
  onClose,
  onCreate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CommunityGroupCategory | "">("");
  const [location, setLocation] = useState("");
  const [about, setAbout] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [categoryVisible, setCategoryVisible] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const resetForm = useCallback(() => {
    setName("");
    setCategory("");
    setLocation("");
    setAbout("");
    setCoverUri(null);
    setCategoryVisible(false);
    setKeyboardInset(0);
  }, []);

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible, resetForm]);

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

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && category.length > 0 && !busy;

  const showError = (message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
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
    if (categoryVisible) {
      setCategoryVisible(false);
      return;
    }
    handleClose();
  };

  const pickCoverPhoto = async () => {
    if (busy) return;
    const result = await launchProfilePhotoPicker();
    if (result.ok) {
      setCoverUri(result.uri);
    }
  };

  const handleCreate = async () => {
    if (!canSubmit || !category) return;

    const nameCheck = filterOrReject(trimmedName);
    if (!nameCheck.ok) {
      showError(nameCheck.reason);
      return;
    }
    const aboutTrimmed = about.trim();
    if (aboutTrimmed) {
      const aboutCheck = filterOrReject(aboutTrimmed);
      if (!aboutCheck.ok) {
        showError(aboutCheck.reason);
        return;
      }
    }

    Keyboard.dismiss();
    await onCreate({
      name: trimmedName,
      category,
      location: location.trim() || undefined,
      about: aboutTrimmed || undefined,
      coverUri,
    });
  };

  return (
    <>
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
            <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom) }]}>
              <View style={styles.header}>
                <Text style={styles.title}>New community</Text>
                <CloseButton onPress={handleClose} />
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.fieldBlock}>
                  <FieldLabel>Community name</FieldLabel>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. DC Volo Kickball"
                    placeholderTextColor={MUTED2}
                    value={name}
                    onChangeText={setName}
                    maxLength={40}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <FieldLabel>Category</FieldLabel>
                  <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setCategoryVisible(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Choose category"
                  >
                    <Text style={[styles.selectText, !category && styles.selectPlaceholder]}>
                      {category || "Choose a category"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={MUTED2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldBlock}>
                  <FieldLabel>Location (optional)</FieldLabel>
                  <TextInput
                    style={styles.input}
                    placeholder="City or neighborhood"
                    placeholderTextColor={MUTED2}
                    value={location}
                    onChangeText={setLocation}
                    maxLength={80}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <FieldLabel>About your community</FieldLabel>
                  <TextInput
                    style={[styles.input, styles.aboutInput]}
                    placeholder="What is this group about? Who should join?"
                    placeholderTextColor={MUTED2}
                    value={about}
                    onChangeText={setAbout}
                    maxLength={500}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <FieldLabel>Cover photo (optional)</FieldLabel>
                  <TouchableOpacity
                    style={[styles.coverBox, coverUri && styles.coverBoxFilled]}
                    onPress={() => void pickCoverPhoto()}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={coverUri ? "Change cover photo" : "Add photo"}
                  >
                    {coverUri ? (
                      <>
                        <ExpoImage
                          source={{ uri: coverUri }}
                          style={styles.coverImage}
                          contentFit="cover"
                        />
                        <View style={styles.coverOverlay}>
                          <Ionicons name="camera-outline" size={22} color="#fff" />
                          <Text style={styles.coverOverlayText}>Change photo</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={28} color={MUTED3} />
                        <Text style={styles.coverLabel}>Add photo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.cta, !canSubmit && styles.ctaDisabled]}
                disabled={!canSubmit}
                onPress={() => void handleCreate()}
                accessibilityRole="button"
                accessibilityLabel="Create community"
              >
                {busy ? (
                  <ActivityIndicator color={ON_ACCENT_TEXT} />
                ) : (
                  <Text style={styles.ctaText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={categoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryVisible(false)}
      >
        <Pressable style={styles.categoryOverlay} onPress={() => setCategoryVisible(false)}>
          <Pressable style={styles.categorySheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.categorySheetTitle}>Category</Text>
            {COMMUNITY_GROUP_CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.categoryRow}
                onPress={() => {
                  setCategory(item);
                  setCategoryVisible(false);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
              >
                <Text
                  style={[styles.categoryRowText, category === item && styles.categoryRowTextActive]}
                >
                  {item}
                </Text>
                {category === item ? (
                  <Ionicons name="checkmark" size={18} color={ACCENT} />
                ) : null}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
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
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingBottom: 8,
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
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
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    minHeight: 52,
  },
  selectText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  selectPlaceholder: {
    color: MUTED2,
  },
  aboutInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  coverBox: {
    minHeight: 140,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  coverBoxFilled: {
    borderStyle: "solid",
    padding: 0,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  coverOverlayText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: "#fff",
  },
  coverLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
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
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
  categoryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  categorySheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categorySheetTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CTA,
    color: TEXT,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  categoryRowText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  categoryRowTextActive: {
    fontFamily: fonts.medium,
    color: ACCENT,
  },
});
