import StackScreenHeader from "@/src/components/StackScreenHeader";
import { formScreenStyles } from "@/constants/formScreenStyles";
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  MUTED,
  MUTED2,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TEXT,
  heroTitleText,
  TYPE_BODY,
  TYPE_SECTION,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../src/lib/firebase";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

export default function DeleteAccountScreen() {
  const [busy, setBusy] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title?: string;
    message: string;
    onClose?: () => void;
  } | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);

  const showAlert = (title: string, message: string, onClose?: () => void) => {
    setAlertConfig({ title, message, onClose });
    setAlertVisible(true);
  };

  const runDelete = async () => {
    if (!auth.currentUser?.uid) {
      showAlert(
        "Not signed in",
        "Please sign in again and try deleting your account."
      );
      return;
    }

    setBusy(true);
    try {
      const functions = getFunctions(undefined, "us-central1");
      const deleteMyAccount = httpsCallable(functions, "deleteMyAccount");

      await deleteMyAccount({});
      await signOut(auth);

      showAlert("Account deleted", "Your account has been deleted.", () => {
        router.replace("/");
      });
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const code = String(err?.code || "");
      const msg = String(err?.message || e);

      if (code.includes("unauthenticated")) {
        showAlert(
          "Please sign in again",
          "Your session expired. Sign in and try again."
        );
      } else if (code.includes("not-found")) {
        showAlert(
          "Delete not available yet",
          "The deleteMyAccount function isn't deployed. Deploy it and try again."
        );
      } else {
        showAlert("Couldn't delete account", msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="Delete account" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>This is permanent</Text>
          <Text style={styles.heroSubtitle}>
            Deleting your account removes your profile, friends, chats, and
            messages from Synq. This can't be undone.
          </Text>
        </View>

        <Text style={formScreenStyles.groupTitle}>What will be deleted</Text>
        <View style={[formScreenStyles.group, styles.bulletGroup]}>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Your profile</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>Friends (removed on both sides)</Text>
          </View>
          <View style={[styles.bulletRow, styles.bulletRowLast]}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              Chats and messages you're part of
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setShowConfirm(true)}
          activeOpacity={0.85}
          style={[styles.deleteBtn, busy && styles.deleteBtnDisabled]}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Delete my account"
        >
          {busy ? (
            <ActivityIndicator color={TEXT} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={18} color={TEXT} />
              <Text style={styles.deleteBtnText}>Delete my account</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={showConfirm}
        title="Delete account?"
        message="This permanently deletes your Synq account, friends, and chats. This can't be undone."
        confirmText="Delete"
        destructive
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => {
          setShowConfirm(false);
          await runDelete();
        }}
      />

      <AlertModal
        visible={alertVisible}
        title={alertConfig?.title}
        message={alertConfig?.message || ""}
        onClose={() => {
          setAlertVisible(false);
          alertConfig?.onClose?.();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: {
    paddingTop: SPACE_3,
    paddingBottom: SPACE_6,
    paddingHorizontal: SPACE_4 + SPACE_3,
  },
  hero: {
    marginBottom: SPACE_5,
  },
  heroTitle: {
    ...heroTitleText,
    marginBottom: SPACE_3,
  },
  heroSubtitle: {
    color: MUTED2,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  bulletGroup: {
    paddingVertical: SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: SPACE_3,
  },
  bulletRowLast: {
    marginBottom: 0,
  },
  bulletDot: {
    color: MUTED2,
    marginRight: SPACE_3,
    fontSize: TYPE_BODY,
    lineHeight: 22,
  },
  bulletText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    flex: 1,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE_3,
    backgroundColor: DESTRUCTIVE,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: SPACE_4,
  },
  deleteBtnDisabled: {
    opacity: 0.7,
  },
  deleteBtnText: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
});
