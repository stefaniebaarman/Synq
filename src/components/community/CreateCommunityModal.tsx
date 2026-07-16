import AlertModal from "@/app/alert-modal";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_BORDER_SUBTLE,
  ACCENT_FILL,
  BG,
  BORDER_HAIRLINE,
  BORDER_SOFT,
  fonts,
  heroTitleText,
  MUTED2,
  OVERLAY_MID,
  RADIUS_LG,
  RADIUS_XL,
  SHEET_OVERLAY,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_MODAL_TITLE,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { useCreateSheetLayout } from "@/src/components/friends/createSheetLayout";
import { GROUP_BORDER, GROUP_SURFACE } from "@/src/components/friends/groupsListStyles";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import {
  COMMUNITY_GROUP_CATEGORIES,
  type CommunityGroupCategory,
} from "@/src/lib/communityGroupCategories";
import { filterOrReject } from "@/src/lib/contentFilter";
import { launchProfilePhotoPicker } from "@/src/lib/profilePhotoPicker";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
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

const CATEGORY_ICONS: Record<
  CommunityGroupCategory,
  keyof typeof Ionicons.glyphMap
> = {
  Sports: "basketball-outline",
  Social: "people-outline",
  Arts: "color-palette-outline",
  "Food & Drink": "restaurant-outline",
  Fitness: "barbell-outline",
  Music: "musical-notes-outline",
  Outdoors: "leaf-outline",
  Other: "sparkles-outline",
};

export default function CreateCommunityModal({
  visible,
  busy,
  onClose,
  onCreate,
}: Props) {
  const insets = useSafeAreaInsets();
  const { keyboardAvoidStyle, sheetStyle, sheetMaxHeight, paddingBottom } =
    useCreateSheetLayout();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<CommunityGroupCategory | "">("");
  const [location, setLocation] = useState("");
  const [about, setAbout] = useState("");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const resetForm = useCallback(() => {
    setName("");
    setCategory("");
    setLocation("");
    setAbout("");
    setCoverUri(null);
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
    handleClose();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
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
      <SpringBottomSheet
        visible={visible}
        onClose={handleClose}
        onBackdropPress={handleBackdropPress}
        cardStyle={[
          keyboardAvoidStyle,
          styles.sheetCard,
          sheetStyle,
          { maxHeight: sheetMaxHeight, height: sheetMaxHeight * 0.92 },
        ]}
      >
        <View style={[styles.sheet, { paddingBottom }]}>
          <Pressable onPress={dismissKeyboard} accessible={false}>
            <View style={styles.header}>
              <Text style={styles.title}>New community</Text>
              <CloseButton onPress={handleClose} accessibilityLabel="Close" />
            </View>
          </Pressable>

          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScrollBeginDrag={dismissKeyboard}
            showsVerticalScrollIndicator={false}
            bottomOffset={88}
            extraKeyboardSpace={Math.max(insets.bottom, 12) + 24}
          >
            <Pressable onPress={dismissKeyboard} accessible={false}>
              <TouchableOpacity
                style={styles.coverCard}
                onPress={() => void pickCoverPhoto()}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={coverUri ? "Change cover photo" : "Add cover photo"}
              >
                {coverUri ? (
                  <>
                    <ExpoImage
                      source={{ uri: coverUri }}
                      style={styles.coverImage}
                      contentFit="cover"
                    />
                    <LinearGradient
                      colors={["transparent", OVERLAY_MID]}
                      style={styles.coverImageFade}
                    />
                    <View style={styles.coverChangePill}>
                      <Ionicons name="camera-outline" size={15} color={TEXT} />
                      <Text style={styles.coverChangeText}>Change photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.coverEmpty}>
                    <View style={styles.coverIconWrap}>
                      <Ionicons name="image-outline" size={24} color={ACCENT} />
                    </View>
                    <Text style={styles.coverEmptyTitle}>Add cover photo</Text>
                    <Text style={styles.coverEmptyHint}>Optional · tap to choose</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Pressable>

            <TextInput
              style={styles.nameInput}
              placeholder="Name your community"
              placeholderTextColor={MUTED2}
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRail}
                keyboardShouldPersistTaps="handled"
              >
                {COMMUNITY_GROUP_CATEGORIES.map((item) => {
                  const selected = category === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.categoryChip, selected && styles.categoryChipOn]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setCategory(item);
                      }}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={item}
                    >
                      <Ionicons
                        name={CATEGORY_ICONS[item]}
                        size={16}
                        color={selected ? ACCENT : MUTED2}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextOn,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.detailsCard}>
              <Text style={styles.detailsTitle}>More about your community</Text>
              <Text style={styles.detailsSub}>Optional</Text>

              <View style={styles.detailRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={MUTED2}
                  style={styles.detailIcon}
                />
                <TextInput
                  style={styles.detailInput}
                  placeholder="Location"
                  placeholderTextColor={MUTED2}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={80}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.detailDivider} />

              <View style={[styles.detailRow, styles.detailRowMultiline]}>
                <TextInput
                  style={[styles.detailInput, styles.aboutInput]}
                  placeholder="What is this group about?"
                  placeholderTextColor={MUTED2}
                  value={about}
                  onChangeText={setAbout}
                  maxLength={500}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </KeyboardAwareScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[synqOutlineAddBtn, !canSubmit && synqOutlineAddBtnDisabled]}
              disabled={!canSubmit}
              onPress={() => void handleCreate()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create community"
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

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetCard: {
    backgroundColor: BG,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_SOFT,
  },
  sheet: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  title: {
    ...heroTitleText,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
    gap: 20,
  },
  coverCard: {
    height: 160,
    borderRadius: RADIUS_LG,
    backgroundColor: GROUP_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    overflow: "hidden",
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverImageFade: {
    ...StyleSheet.absoluteFillObject,
  },
  coverEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  coverIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS_XL,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT_BORDER_SUBTLE,
    marginBottom: 4,
  },
  coverEmptyTitle: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    letterSpacing: 0.02,
  },
  coverEmptyHint: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
  },
  coverChangePill: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: SHEET_OVERLAY,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_HAIRLINE,
  },
  coverChangeText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.08,
  },
  nameInput: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_MODAL_TITLE,
    lineHeight: 30,
    letterSpacing: 0.08,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    letterSpacing: 0.04,
  },
  categoryRail: {
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    backgroundColor: GROUP_SURFACE,
  },
  categoryChipOn: {
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL,
  },
  categoryChipText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.02,
  },
  categoryChipTextOn: {
    color: TEXT,
  },
  detailsCard: {
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    backgroundColor: GROUP_SURFACE,
    paddingTop: 16,
    paddingBottom: 4,
    overflow: "hidden",
  },
  detailsTitle: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    letterSpacing: 0.04,
    paddingHorizontal: 16,
  },
  detailsSub: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 48,
  },
  detailRowMultiline: {
    alignItems: "flex-start",
    paddingVertical: 12,
    minHeight: 96,
  },
  detailIcon: {
    marginRight: 12,
  },
  detailInput: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    paddingVertical: 12,
  },
  aboutInput: {
    minHeight: 72,
    paddingTop: 0,
    lineHeight: 22,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GROUP_BORDER,
    marginLeft: 46,
  },
  footer: {
    paddingTop: 14,
    alignItems: "center",
  },
});
