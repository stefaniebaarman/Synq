import {
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { buildUserSearchFields } from "@/src/lib/userSearchFields";
import { filterOrReject } from "@/src/lib/contentFilter";
import {
  getPhotoLibraryPermission,
  launchProfilePhotoPicker,
  photoLibraryAccessGranted,
  requestPhotoLibraryAccess,
} from "@/src/lib/profilePhotoPicker";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  MUTED3,
  PRIMARY_CTA_HEIGHT,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_FINE,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "../../constants/Variables";
import { auth, db } from "../../src/lib/firebase";
import { syncMyPhoneHash } from "../../src/lib/matchContacts";
import {
  consumePendingProfilePhoto,
  setPendingProfilePhotoSource,
} from "@/src/lib/pendingProfilePhoto";
import { uploadProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import AlertModal from "../alert-modal";

const CTA_WIDTH = "56%";

export default function Details() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [photoPermissionPromptVisible, setPhotoPermissionPromptVisible] =
    useState(false);
  const [photoPermissionRequesting, setPhotoPermissionRequesting] =
    useState(false);

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = firstName.trim() && lastName.trim() && !loading && !isUploading;

  const openPhotoPickerAfterAccess = async () => {
    const result = await launchProfilePhotoPicker();
    if (result.ok) {
      setPendingProfilePhotoSource(result.uri);
      router.push({
        pathname: "/profile-photo-crop",
        params: { onboarding: "1" },
      });
      return;
    }
    if (result.reason === "denied") {
      showAlert(
        "Allow photo library access in Settings to choose a profile photo.",
        "Photo access needed"
      );
    }
  };

  const requestPhotoAccessAndPick = async () => {
    setPhotoPermissionRequesting(true);
    try {
      const granted = await requestPhotoLibraryAccess();
      if (!granted) {
        showAlert(
          "Allow photo library access in Settings to choose a profile photo.",
          "Photo access needed"
        );
        return;
      }
      await openPhotoPickerAfterAccess();
    } finally {
      setPhotoPermissionRequesting(false);
    }
  };

  const pickImage = async () => {
    if (isUploading || photoPermissionRequesting) return;

    const permission = await getPhotoLibraryPermission();
    if (photoLibraryAccessGranted(permission)) {
      await openPhotoPickerAfterAccess();
      return;
    }

    if (permission.status === "undetermined") {
      setPhotoPermissionPromptVisible(true);
      return;
    }

    await requestPhotoAccessAndPick();
  };

  const uploadImage = useCallback(async (uri: string) => {
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      const url = await uploadProfilePhoto(uri);
      setImage(url);
    } catch {
      showAlert("Could not upload image.", "Error");
    } finally {
      setIsUploading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cropped = consumePendingProfilePhoto();
      if (cropped) {
        void uploadImage(cropped);
      }
    }, [uploadImage])
  );

  const saveDetails = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const nameCheck = filterOrReject(fullName);
      if (!nameCheck.ok) {
        showAlert(nameCheck.reason, "Content not allowed");
        return;
      }
      await updateProfile(auth.currentUser, {
        displayName: fullName,
        photoURL: image ?? null, 
      });

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          uid: auth.currentUser.uid,
          displayName: fullName,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          imageurl: image ?? null,
          status: "inactive",
          createdAt: new Date().toISOString(),
          ...buildUserSearchFields({
            displayName: fullName,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: auth.currentUser.email,
          }),
        },
        { merge: true }
      );

      if (auth.currentUser.phoneNumber) {
        try {
          await syncMyPhoneHash();
        } catch {
          // Auth trigger / contacts flow can sync later.
        }
      }

      await auth.currentUser.reload();
      router.push("/(auth)/location?onboarding=1");
    } catch (e: any) {
      console.error("[Details] saveDetails error:", e);
      showAlert(e?.message ?? "Something went wrong.", "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: onboardingContentTopPadding() },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
        <View style={styles.innerContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>What's your name?</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitle}>Add a photo and your name to get started</Text>
          </View>

          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.avatarTouchable}
              disabled={isUploading || photoPermissionRequesting}
            >
              <View style={styles.avatarCircle}>
                {image ? (
                  <ExpoImage
                    source={{ uri: image }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={image}
                  />
                ) : (
                  <View style={styles.placeholderIcon}>
                    <Icon name="camera-outline" size={28} color={MUTED} />
                    <Text style={styles.addPhotoText}>
                      {isUploading ? "Uploading..." : "Add photo"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.plusBadge}>
                <Icon
                  name="add"
                  size={16}
                  color="black"
                  style={[styles.plusIcon, isUploading && { opacity: 0.7 }]}
                />
              </View>
            </TouchableOpacity>

            <Text style={styles.optionalText}>(Optional)</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={MUTED3}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
            />

            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={MUTED3}
              autoCapitalize="words"
              autoCorrect={false}
              style={[styles.input, styles.lastNameInput]}
            />
          </View>

          <TouchableOpacity
            disabled={!canContinue}
            onPress={saveDetails}
            activeOpacity={0.85}
            style={[
              synqOutlineAddBtn,
              styles.button,
              !canContinue && synqOutlineAddBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text
              style={[
                synqOutlineAddBtnText,
                !canContinue && synqOutlineAddBtnTextDisabled,
                loading && { opacity: 0.5 },
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
          <AlertModal
            visible={alertVisible}
            title={alertTitle}
            message={alertMessage}
            onClose={() => setAlertVisible(false)}
          />
          <AlertModal
            visible={photoPermissionPromptVisible}
            title="Photo library access"
            message="Synq needs access to your photo library so you can choose an optional profile photo."
            buttonText="Continue"
            onClose={() => {
              setPhotoPermissionPromptVisible(false);
              void requestPhotoAccessAndPick();
            }}
          />
        </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: ONBOARDING_SCROLL_BOTTOM + 48,
  },
  innerContent: {
    width: "100%",
  },
  headerSection: {
    marginBottom: 10,
  },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
    height: 1,
    backgroundColor: BORDER,
    width: ONBOARDING_DIVIDER_WIDTH,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    fontFamily: fonts.book,
    lineHeight: 22,
  },
  avatarContainer: {
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  avatarTouchable: {
    width: 132,
    height: 132,
  },
  avatarCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  avatarImage: {
    width: 132,
    height: 132,
  },
  placeholderIcon: { alignItems: "center" },
  addPhotoText: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    marginTop: 4,
    fontFamily: fonts.medium,
  },
  plusBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    zIndex: 2,
    backgroundColor: ACCENT,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: BG,
  },
  plusIcon: {
    marginTop: 1,
    marginLeft: 0.5,
  },
  optionalText: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    marginTop: 6,
    fontFamily: fonts.book,
  },
  inputContainer: {
    marginTop: 10,
    width: "78%",
    alignSelf: "center",
  },
  input: {
    color: TEXT,
    backgroundColor: SURFACE,
    height: 56,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 16,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: BORDER,
  },
  lastNameInput: {
    marginTop: 12,
  },
  button: {
    marginTop: 26,
    alignSelf: "center",
    width: CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 24,
  },
});
