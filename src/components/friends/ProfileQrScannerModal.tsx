import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  SURFACE_RAISED,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_SECTION,
  TYPE_SUBHEAD,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { resolveFriendIdFromScannedProfileQr } from "@/src/lib/profileShareUrl";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  onClose: () => void;
  onFound: (friendId: string) => void;
  onInvalidCode?: () => void;
};

export default function ProfileQrScannerModal({
  visible,
  onClose,
  onFound,
  onInvalidCode,
}: Props) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [resolving, setResolving] = useState(false);
  const scanLockRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      scanLockRef.current = false;
      setResolving(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || permission?.granted) return;
    if (permission?.canAskAgain !== false) {
      void requestPermission();
    }
  }, [visible, permission?.granted, permission?.canAskAgain, requestPermission]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!visible || scanLockRef.current || resolving) return;
      scanLockRef.current = true;
      setResolving(true);
      try {
        const friendId = await resolveFriendIdFromScannedProfileQr(data);
        if (!friendId) {
          scanLockRef.current = false;
          onInvalidCode?.();
          return;
        }
        onFound(friendId);
      } catch {
        scanLockRef.current = false;
        onInvalidCode?.();
      } finally {
        setResolving(false);
      }
    },
    [visible, resolving, onFound, onInvalidCode]
  );

  const handleClose = () => {
    scanLockRef.current = false;
    setResolving(false);
    onClose();
  };

  const showCamera = permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan QR code</Text>
          <CloseButton onPress={handleClose} accessibilityLabel="Close scanner" />
        </View>
        <View style={styles.cameraWrap}>
          {showCamera ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={resolving ? undefined : handleBarcodeScanned}
              />
              <View style={styles.overlay} pointerEvents="none">
                <View style={styles.scanFrame} />
              </View>
              {resolving ? (
                <View style={styles.resolvingOverlay}>
                  <ActivityIndicator color={ACCENT} size="large" />
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.permissionState}>
              {permission == null ? (
                <ActivityIndicator color={ACCENT} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={36} color={MUTED2} />
                  <Text style={styles.permissionTitle}>Camera access needed</Text>
                  <Text style={styles.permissionText}>
                    Allow camera access to scan profile QR codes.
                  </Text>
                  {permission.canAskAgain ? (
                    <TouchableOpacity
                      style={styles.permissionBtn}
                      onPress={() => void requestPermission()}
                    >
                      <Text style={styles.permissionBtnText}>Allow camera</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.permissionText}>
                      Enable camera access in your device settings.
                    </Text>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const FRAME_SIZE = 248;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: TYPE_SECTION,
    color: TEXT,
    marginRight: 12,
  },
  subtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: BUTTON_RADIUS,
    overflow: "hidden",
    backgroundColor: SURFACE_RAISED,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "transparent",
  },
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  permissionState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  permissionTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_SUBHEAD,
    color: TEXT,
    textAlign: "center",
  },
  permissionText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
    lineHeight: 18,
  },
  permissionBtn: {
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
});
