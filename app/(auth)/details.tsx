import {
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_TITLE_SIZE,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  TYPE_BODY,
  TYPE_CTA,
  TYPE_FINE,
  fonts,
} from "../../constants/Variables";
import { auth, db } from "../../src/lib/firebase";
import {
  consumePendingProfilePhoto,
  setPendingProfilePhotoSource,
} from "@/src/lib/pendingProfilePhoto";
import { uploadProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import AlertModal from "../alert-modal";

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
            <Text style={styles.title}>What’s your name?</Text>
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
                    <Icon name="camera-outline" size={28} color="rgba(255,255,255,0.5)" />
                    <Text style={styles.addPhotoText}>
                      {isUploading ? "Uploading..." : "Add Photo"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.plusBadge}>
                {isUploading ? (
                  <ActivityIndicator color="black" />
                ) : (
                  <Icon name="add" size={16} color="black" style={styles.plusIcon} />
                )}
              </View>
            </TouchableOpacity>

            <Text style={styles.optionalText}>(Optional)</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              placeholderTextColor={MUTED3}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.input}
            />

            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              placeholderTextColor={MUTED3}
              autoCapitalize="words"
              autoCorrect={false}
              style={[styles.input, { marginTop: 12 }]}
            />
          </View>

          <TouchableOpacity
            disabled={!canContinue}
            onPress={saveDetails}
            style={[styles.button, !canContinue && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
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
    // Single-line headline: slightly tighter than shared onboarding line height
    lineHeight: 38,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
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
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: MUTED3,
    overflow: "hidden",
  },
  avatarImage: {
    width: 132,
    height: 132,
  },
  placeholderIcon: { alignItems: "center" },
  addPhotoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: TYPE_FINE,
    marginTop: 4,
    fontFamily: fonts.heavy,
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
    borderColor: "black",
  },
  plusIcon: {
    marginTop: 1,
    marginLeft: 0.5,
  },
  optionalText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: TYPE_FINE,
    marginTop: 6,
    fontFamily: fonts.book,
  },
  inputContainer: {
    marginTop: 6,
  },
  input: {
    color: TEXT,
    backgroundColor: BORDER,
    height: 52,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 14,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  button: {
    marginTop: 32,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
  },
});
