import ProfilePhotoCropView from "@/src/components/ProfilePhotoCropView";
import { prepareProfilePhotoForCrop } from "@/src/lib/cropProfilePhoto";
import {
  consumePendingProfilePhotoSource,
  setPendingProfilePhoto,
} from "@/src/lib/pendingProfilePhoto";
import { uploadProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import { ACCENT, BG } from "@/constants/Variables";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import AlertModal from "./alert-modal";

export default function ProfilePhotoCropScreen() {
  const router = useRouter();
  const { uri, onboarding } = useLocalSearchParams<{ uri?: string; onboarding?: string }>();
  const isOnboarding = onboarding === "1";

  const [imageUri] = useState<string | null>(() => {
    const fromPending = consumePendingProfilePhotoSource();
    if (fromPending) return fromPending;
    if (typeof uri === "string" && uri.length > 0) {
      return decodeURIComponent(uri);
    }
    return null;
  });
  const [preparedUri, setPreparedUri] = useState<string | null>(null);
  const [preparedSize, setPreparedSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!imageUri) {
      router.back();
    }
  }, [imageUri, router]);

  useEffect(() => {
    if (!imageUri) return;

    let cancelled = false;
    setPreparing(true);
    setPreparedUri(null);
    setPreparedSize(null);

    void (async () => {
      try {
        const prepared = await prepareProfilePhotoForCrop(imageUri);
        if (cancelled) return;
        setPreparedUri(prepared.uri);
        setPreparedSize({ width: prepared.width, height: prepared.height });
      } catch {
        if (!cancelled) router.back();
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUri, router]);

  const showError = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const handleChoose = useCallback(
    async (croppedUri: string) => {
      if (isOnboarding) {
        setPendingProfilePhoto(croppedUri);
        router.back();
        return;
      }

      setUploading(true);
      try {
        await uploadProfilePhoto(croppedUri);
        router.back();
      } catch {
        showError("Could not upload image.");
      } finally {
        setUploading(false);
      }
    },
    [isOnboarding, router, showError]
  );

  if (!imageUri) {
    return <View style={styles.empty} />;
  }

  if (preparing || !preparedUri || !preparedSize) {
    return (
      <View style={styles.empty}>
        <StatusBar style="light" />
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <ProfilePhotoCropView
        imageUri={preparedUri}
        imageWidth={preparedSize.width}
        imageHeight={preparedSize.height}
        processing={uploading}
        onCancel={() => router.back()}
        onChoose={handleChoose}
      />
      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
});
