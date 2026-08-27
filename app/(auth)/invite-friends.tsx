import AlertModal from "@/app/alert-modal";
import {
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_DIVIDER_WIDTH,
  ONBOARDING_H_PADDING,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LETTER_SPACING,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  DIVIDER,
  MUTED,
  MUTED2,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  TYPE_BODY,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import FindFromContactsModal from "@/src/components/friends/FindFromContactsModal";
import { auth, db } from "@/src/lib/firebase";
import {
  fetchOrCreateInviteCode,
  isOnboardingInviteDone,
  markOnboardingInviteDone,
} from "@/src/lib/inviteCode";
import type { ContactMatchUser } from "@/src/lib/matchContacts";
import { buildProfileShareWebUrl } from "@/src/lib/profileShareUrl";
import { shareProfileLink } from "@/src/lib/shareProfileCard";
import { setCachedOutgoingFriendRequest } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function InviteFriendsOnboardingScreen() {
  const [sharing, setSharing] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void isOnboardingInviteDone().then((done: boolean) => {
      if (!cancelled && done) {
        router.replace("/(tabs)/friends");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = useCallback(async () => {
    await markOnboardingInviteDone();
    router.replace("/(tabs)/friends");
  }, []);

  const showAlert = useCallback((message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const code = await fetchOrCreateInviteCode();
      const shareUrl = buildProfileShareWebUrl(code);
      if (!shareUrl) {
        showAlert(
          "We couldn't generate your invite link yet. Please try again in a moment.",
          "Share unavailable"
        );
        return;
      }
      await shareProfileLink(shareUrl);
      await finish();
    } catch {
      showAlert("Please try again in a moment.", "Share unavailable");
    } finally {
      setSharing(false);
    }
  }, [finish, sharing, showAlert]);

  const sendInvite = useCallback(
    async (targetUser: ContactMatchUser) => {
      if (!auth.currentUser) return;
      const myId = auth.currentUser.uid;
      const targetId = targetUser.id;
      if (!targetId || pendingIds[targetId]) return;

      try {
        const meSnap = await getDoc(doc(db, "users", myId));
        const meData = meSnap.exists()
          ? (meSnap.data() as Record<string, unknown>)
          : {};
        const senderName =
          (typeof meData.displayName === "string" && meData.displayName) ||
          auth.currentUser.displayName ||
          "Someone";
        const senderImageUrl =
          typeof meData.imageurl === "string" ? meData.imageurl : null;

        setPendingIds((prev) => ({ ...prev, [targetId]: true }));
        setCachedOutgoingFriendRequest(myId, targetId, true);

        const batch = writeBatch(db);
        batch.set(doc(db, "users", targetId, "friendRequests", myId), {
          from: myId,
          to: targetId,
          senderName,
          senderImageUrl,
          status: "pending",
          sentAt: serverTimestamp(),
        });
        batch.set(doc(db, "users", myId, "outgoingFriendRequests", targetId), {
          to: targetId,
          displayName: targetUser.displayName || null,
          imageurl: targetUser.imageurl || null,
          sentAt: serverTimestamp(),
        });
        await batch.commit();
      } catch (e: unknown) {
        setPendingIds((prev) => ({ ...prev, [targetId]: false }));
        setCachedOutgoingFriendRequest(myId, targetId, false);
        const code = String((e as { code?: string })?.code || "");
        if (code.includes("permission-denied")) {
          showAlert(
            "You've already sent this user a friend request.",
            "Already sent"
          );
          return;
        }
        const msg = String((e as { message?: string })?.message || "");
        showAlert(msg || "Could not send invite.", "Error");
      }
    },
    [pendingIds, showAlert]
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View
        style={[
          styles.container,
          { paddingTop: onboardingContentTopPadding() },
        ]}
      >
        <Text style={styles.kicker}>ALMOST THERE</Text>
        <Text style={styles.title}>Invite your people</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitle}>
          Synq only works with your friends. Share your link so they can join
          you.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              synqOutlineAddBtn,
              styles.primaryBtn,
              sharing && synqOutlineAddBtnDisabled,
            ]}
            onPress={() => void handleShare()}
            disabled={sharing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Share invite link"
          >
            <Ionicons name="share-social-outline" size={20} color={ACCENT} />
            <Text
              style={[
                synqOutlineAddBtnText,
                styles.primaryBtnText,
                sharing && synqOutlineAddBtnTextDisabled,
              ]}
            >
              {sharing ? "Preparing…" : "Share invite link"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryRow}
            onPress={() => setContactsVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Find from contacts"
          >
            <Ionicons name="people-outline" size={20} color={ACCENT} />
            <Text style={styles.secondaryText}>Find from contacts</Text>
            <Ionicons name="chevron-forward" size={18} color={MUTED2} />
          </TouchableOpacity>
        </View>

        <View style={styles.flexSpacer} />

        <TouchableOpacity
          onPress={() => void finish()}
          style={styles.skipButton}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>

      <FindFromContactsModal
        visible={contactsVisible}
        onClose={() => {
          setContactsVisible(false);
          void finish();
        }}
        onOpenProfile={(userId: string) => {
          setContactsVisible(false);
          void markOnboardingInviteDone().then(() => {
            router.replace({
              pathname: "/friend-profile",
              params: { friendId: userId },
            });
          });
        }}
        onAddFriend={(user: ContactMatchUser) => {
          void sendInvite(user);
        }}
        getFriendAction={(userId: string) => {
          if (pendingIds[userId]) return "pending";
          return "add";
        }}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  kicker: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
    letterSpacing: ONBOARDING_TITLE_LETTER_SPACING,
  },
  divider: {
    width: ONBOARDING_DIVIDER_WIDTH,
    height: StyleSheet.hairlineWidth,
    backgroundColor: DIVIDER,
    marginTop: ONBOARDING_DIVIDER_MARGIN_TOP,
  },
  subtitle: {
    marginTop: ONBOARDING_SUBTITLE_MARGIN_TOP,
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    lineHeight: 22,
    maxWidth: 340,
  },
  actions: {
    marginTop: 40,
    gap: 14,
    alignItems: "center",
  },
  primaryBtn: {
    width: PRIMARY_CTA_WIDTH,
    height: PRIMARY_CTA_HEIGHT,
    flexDirection: "row",
    gap: 10,
  },
  primaryBtnText: {
    fontSize: TYPE_BODY,
  },
  secondaryRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  secondaryText: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
  },
  flexSpacer: {
    flex: 1,
  },
  skipButton: {
    marginBottom: 28,
    alignItems: "center",
    paddingVertical: 14,
  },
  skipText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
  },
});
