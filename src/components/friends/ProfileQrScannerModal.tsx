import {
  ACCENT,
  ACCENT_FILL,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  OVERLAY_DIM,
  TEXT,
  TEXT_ON_BRIGHT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_SUBHEAD,
  TYPE_TAB_HEADER,
  fonts,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { SkeletonBlock } from "@/src/components/loading/BrandSkeletons";
import { resolveFriendIdFromScannedProfileQr } from "@/src/lib/profileShareUrl";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
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

const FRAME_SIZE = 268;
const CORNER = 28;
const CORNER_THICKNESS = 3.5;

function ScanCorners() {
  return (
    <View style={styles.corners} pointerEvents="none">
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
    </View>
  );
}

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

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      try {
        await Linking.openURL("app-settings:");
      } catch {
        // Device may not support deep-linking into Settings.
      }
    }
  }, []);

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
      <View style={styles.screen}>
        {showCamera ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={resolving ? undefined : handleBarcodeScanned}
          />
        ) : (
          <View style={[styles.permissionState, { paddingTop: insets.top }]}>
            {permission == null ? (
              <View accessibilityLabel="Loading">
                <SkeletonBlock style={styles.permissionSkeleton} />
              </View>
            ) : (
              <>
                <View style={styles.permissionIconWrap}>
                  <Ionicons name="camera-outline" size={32} color={ACCENT} />
                </View>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionText}>
                  {permission.canAskAgain
                    ? "Allow camera access to scan profile QR codes."
                    : "Enable camera access in your device settings to scan profile QR codes."}
                </Text>
                {permission.canAskAgain ? (
                  <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={() => void requestPermission()}
                    accessibilityRole="button"
                    accessibilityLabel="Allow camera"
                  >
                    <Text style={styles.permissionBtnText}>Allow camera</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.permissionBtn}
                    onPress={() => void openSystemSettings()}
                    accessibilityRole="button"
                    accessibilityLabel="Open Settings"
                  >
                    <Text style={styles.permissionBtnText}>Open Settings</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}

        {showCamera ? (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.maskTop} />
            <View style={styles.maskMiddle}>
              <View style={styles.maskSide} />
              <View style={styles.frame}>
                <ScanCorners />
              </View>
              <View style={styles.maskSide} />
            </View>
            <View style={styles.maskBottom} />
          </View>
        ) : null}

        {showCamera && resolving ? (
          <View style={styles.resolvingOverlay} accessibilityLabel="Loading">
            <SkeletonBlock style={styles.resolvingSkeleton} />
          </View>
        ) : null}

        <LinearGradient
          colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.28)", "transparent"]}
          style={[styles.headerGradient, { paddingTop: insets.top }]}
          pointerEvents="box-none"
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.kicker}>ADD FRIEND</Text>
              <Text style={styles.title}>Scan QR code</Text>
            </View>
            <CloseButton
              onPress={handleClose}
              accessibilityLabel="Close scanner"
              style={styles.closeBtn}
            />
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const MASK = "rgba(0,0,0,0.58)";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
    gap: 4,
  },
  kicker: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_CAPTION,
    letterSpacing: 1.4,
  },
  title: {
    color: TEXT_ON_BRIGHT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_TAB_HEADER,
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  closeBtn: {
    marginTop: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  maskTop: {
    flex: 1,
    backgroundColor: MASK,
  },
  maskMiddle: {
    flexDirection: "row",
    height: FRAME_SIZE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: MASK,
  },
  maskBottom: {
    flex: 1,
    backgroundColor: MASK,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    overflow: "hidden",
  },
  corners: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: "absolute",
    width: CORNER,
    height: CORNER,
    borderColor: ACCENT,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 10,
  },
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: OVERLAY_DIM,
  },
  resolvingSkeleton: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 12,
  },
  permissionState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  permissionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT_FILL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  permissionSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  permissionTitle: {
    fontFamily: fonts.heavy,
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
    fontSize: TYPE_BUTTON,
    color: ON_ACCENT_TEXT,
  },
});
