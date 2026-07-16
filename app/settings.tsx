import StackScreenHeader from "@/src/components/StackScreenHeader";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import { prefetchResolvedAvatar, resolveAvatar } from "@/src/lib/helpers";
import { clearPushTokenOnSignOut } from "@/src/lib/pushToken";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formScreenStyles } from "../constants/formScreenStyles";
import {
  BG,
  BORDER_MUTED,
  BORDER_SUBTLE_HEX,
  DESTRUCTIVE,
  GROUP_BORDER,
  MUTED,
  MUTED2,
  RADIUS_LG,
  SPACE_1,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE_RAISED,
  TEXT,
  TEXT_MUTED_HEX,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_LEAD,
  fonts,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { useAuthRefresh } from "./_layout";

import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

const BACKGROUND = BG;

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
  } | null>(null);

  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const showAlert = (title: string, message: string) => {
    setAlertConfig({ title, message });
    setAlertVisible(true);
  };

  const { user } = useAuthRefresh();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setUserData(undefined);
      return;
    }

    const userDocRef = doc(db, "users", uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) setUserData(snap.data());
      },
      ignoreSnapshotPermissionDenied
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    prefetchResolvedAvatar(userData?.imageurl);
  }, [userData?.imageurl]);

  const appVersion =
    Constants.expoConfig?.version ||
    Constants.manifest2?.extra?.expoClient?.version ||
    Constants.manifest?.version ||
    "1.0.0";

  const openSystemSettings = async () => {
    try {
      if (typeof (Linking as any).openSettings === "function") {
        await (Linking as any).openSettings();
        return;
      }
      await Linking.openURL("app-settings:");
    } catch {
      showAlert("Unable to open Settings", "Please open your device Settings app.");
    }
  };

  const signOut = async () => {
    try {
      await clearPushTokenOnSignOut();
      router.replace("/(auth)/welcome");
      await auth.signOut();
    } catch {
      showAlert("Sign out failed", "Please try again.");
    }
  };

  const confirmSignOut = () => {
    setShowSignOutModal(true);
  };

  const SettingItem = ({
    label,
    onPress,
    value,
    danger,
    isLast,
  }: {
    label: string;
    onPress?: () => void;
    value?: string;
    danger?: boolean;
    isLast?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.item, isLast && styles.itemLast]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.itemLeft}>
        <Text style={[styles.itemLabel, danger && styles.dangerText]}>
          {label}
        </Text>
      </View>

      {value ? (
        <Text style={styles.itemValue}>{value}</Text>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={MUTED2} />
      )}
    </TouchableOpacity>
  );

  const StaticItem = ({
    label,
    value,
    isLast,
  }: {
    label: string;
    value: string;
    isLast?: boolean;
  }) => (
    <View style={[styles.item, isLast && styles.itemLast]}>
      <View style={styles.itemLeft}>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />

      <StackScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.userSection}>
          <ExpoImage
            source={{ uri: resolveAvatar(userData?.imageurl) }}
            style={styles.avatar}
            cachePolicy="memory-disk"
            transition={0}
            recyclingKey={resolveAvatar(userData?.imageurl)}
            priority="high"
          />
          <Text style={styles.userName}>
            {userData?.displayName ||
              auth.currentUser?.displayName ||
              "User"}
          </Text>
        </View>

        <Text style={formScreenStyles.groupTitle}>Account</Text>
        <View style={formScreenStyles.group}>
          <SettingItem
            label="Edit profile"
            onPress={() => router.push("/edit-profile")}
          />
          <SettingItem
            label="Push notification settings"
            onPress={openSystemSettings}
          />
          <SettingItem label="Sign out" onPress={confirmSignOut} isLast />
        </View>

        <Text style={formScreenStyles.groupTitle}>Safety</Text>
        <View style={formScreenStyles.group}>
          <SettingItem
            label="Report a safety issue"
            onPress={() => router.push("/profile-settings/safety-report")}
            isLast
          />
        </View>

        <Text style={formScreenStyles.groupTitle}>More</Text>
        <View style={formScreenStyles.group}>
          <SettingItem
            label="About us"
            onPress={() => router.push("/profile-settings/about-us")}
          />
          <SettingItem
            label="Privacy policy"
            onPress={() =>
              router.push("/profile-settings/privacy-policy")
            }
          />
          <SettingItem
            label="Terms and conditions"
            onPress={() =>
              router.push("/profile-settings/terms-conditions")
            }
          />
          <SettingItem
            label="Feedback"
            onPress={() => router.push("/profile-settings/feedback")}
          />
          <StaticItem label="Version" value={appVersion} isLast />
        </View>

        <Text style={formScreenStyles.groupTitle}>Danger zone</Text>
        <View style={formScreenStyles.group}>
          <SettingItem
            label="Delete account"
            danger
            onPress={() => router.push("/delete-account")}
            isLast
          />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showSignOutModal}
        title="Sign out?"
        message="You can sign back in anytime."
        confirmText="Sign out"
        destructive
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={async () => {
          setShowSignOutModal(false);
          await signOut();
        }}
      />

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  scrollContent: {
    paddingBottom: SPACE_6 + SPACE_1,
    paddingTop: SPACE_3,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_RAISED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    margin: SPACE_4 + SPACE_1,
    padding: SPACE_4,
    borderRadius: RADIUS_LG,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
    backgroundColor: BORDER_MUTED,
  },
  userName: {
    color: TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE_4 + 2,
    paddingHorizontal: SPACE_4 + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_SUBTLE_HEX,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemLeft: { flexDirection: "row", alignItems: "center" },
  itemLabel: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  itemValue: {
    color: TEXT_MUTED_HEX,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
  },

  dangerText: {
    color: DESTRUCTIVE,
    fontFamily: fonts.medium,
  },
});