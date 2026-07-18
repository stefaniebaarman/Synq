import type { Friend } from "@/constants/Variables";
import {
  ACCENT,
  MUTED2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  TYPE_SUBHEAD,
  modalBodyText,
  modalTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
} from "@/constants/Variables";
import AlertModal from "@/app/alert-modal";
import SynqNudgeCard from "@/src/components/synq/SynqNudgeCard";
import { fetchOrCreateInviteCode } from "@/src/lib/inviteCode";
import { buildProfileShareWebUrl } from "@/src/lib/profileShareUrl";
import { shareProfileLink } from "@/src/lib/shareProfileCard";
import {
  nudgeCooldownRemainingMs,
  nudgeSentStorageKey,
  persistNudgeSent,
  clearNudgeSent,
  readNudgeSentState,
  sendSynqNudge,
  synqNudgeErrorMessage,
  warmSynqNudgeClient,
} from "@/src/lib/synqNudge";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const NUDGE_PAGE_SIZE = 3;

type NudgeRowState = { loading: boolean; sent: boolean };

type Props = {
  viewerId: string;
  candidates: Friend[];
};

function shuffleArray<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickFriendIds(
  friends: Friend[],
  count: number,
  excludeIds: string[] = []
): string[] {
  if (friends.length === 0) return [];
  const exclude = new Set(excludeIds);
  let pool = friends.filter((f) => !exclude.has(f.id));
  if (pool.length < Math.min(count, friends.length)) {
    pool = [...friends];
  }
  return shuffleArray(pool)
    .slice(0, Math.min(count, pool.length))
    .map((f) => f.id);
}

export default function ActiveSynqEmptyState({ viewerId, candidates }: Props) {
  const [nudgeByFriendId, setNudgeByFriendId] = useState<Record<string, NudgeRowState>>({});
  const [shownIds, setShownIds] = useState<string[]>([]);
  const [sharingProfile, setSharingProfile] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  const candidateKey = useMemo(
    () =>
      candidates
        .map((f) => String(f.id || "").trim())
        .filter(Boolean)
        .sort()
        .join("|"),
    [candidates]
  );

  useEffect(() => {
    if (!candidateKey) {
      setShownIds([]);
      return;
    }
    setShownIds((prev) => {
      const idSet = new Set(candidateKey.split("|"));
      const valid = prev.filter((id) => idSet.has(id));
      const need = Math.min(NUDGE_PAGE_SIZE, idSet.size);
      if (valid.length >= need && valid.length > 0) {
        const next = valid.slice(0, NUDGE_PAGE_SIZE);
        if (next.length === prev.length && next.every((id, i) => id === prev[i])) {
          return prev;
        }
        return next;
      }
      return pickFriendIds(candidates, NUDGE_PAGE_SIZE);
    });
  }, [candidateKey, candidates]);

  const shownFriends = useMemo(() => {
    const byId = new Map(candidates.map((f) => [f.id, f]));
    return shownIds.map((id) => byId.get(id)).filter(Boolean) as Friend[];
  }, [candidates, shownIds]);

  const canShuffle = candidates.length > NUDGE_PAGE_SIZE;

  const showAlert = useCallback((title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  useEffect(() => {
    if (!viewerId || candidates.length === 0) return;
    warmSynqNudgeClient();

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    void Promise.all(
      candidates.map(async (friend) => {
        const key = nudgeSentStorageKey(viewerId, friend.id);
        const { sent, sentAtMs } = await readNudgeSentState(key);
        if (cancelled) return;
        setNudgeByFriendId((prev) => ({
          ...prev,
          [friend.id]: { loading: false, sent },
        }));
        if (sent && sentAtMs != null) {
          const remainingMs = nudgeCooldownRemainingMs(sentAtMs);
          if (remainingMs > 0) {
            timers.push(
              setTimeout(() => {
                if (!cancelled) {
                  setNudgeByFriendId((prev) => ({
                    ...prev,
                    [friend.id]: { loading: false, sent: false },
                  }));
                }
              }, remainingMs)
            );
          }
        }
      })
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [viewerId, candidates]);

  const handleShuffle = useCallback(() => {
    setShownIds((prev) => pickFriendIds(candidates, NUDGE_PAGE_SIZE, prev));
  }, [candidates]);

  const handleNudge = useCallback(
    (friend: Friend) => {
      const friendId = friend.id;
      let blocked = false;
      setNudgeByFriendId((prev) => {
        const row = prev[friendId];
        if (row?.loading || row?.sent) {
          blocked = true;
          return prev;
        }
        return {
          ...prev,
          [friendId]: { loading: true, sent: true },
        };
      });
      if (blocked) return;

      showAlert("Nudge sent", "They'll get a notification asking if they're free.");
      const storageKey = nudgeSentStorageKey(viewerId, friendId);
      void persistNudgeSent(storageKey);

      void sendSynqNudge(friendId)
        .then(() => {
          setNudgeByFriendId((prev) => ({
            ...prev,
            [friendId]: { loading: false, sent: true },
          }));
        })
        .catch((err) => {
          const msg = synqNudgeErrorMessage(err);
          if (msg.includes("again in a few hours")) {
            void persistNudgeSent(storageKey);
            setNudgeByFriendId((prev) => ({
              ...prev,
              [friendId]: { loading: false, sent: true },
            }));
            return;
          }
          void clearNudgeSent(storageKey);
          setNudgeByFriendId((prev) => ({
            ...prev,
            [friendId]: { loading: false, sent: false },
          }));
          showAlert("Couldn't nudge", msg);
        });
    },
    [viewerId, showAlert]
  );

  const handleShareProfile = useCallback(async () => {
    if (sharingProfile) return;
    setSharingProfile(true);
    try {
      const code = await fetchOrCreateInviteCode();
      const shareUrl = buildProfileShareWebUrl(code);
      if (!shareUrl) {
        showAlert(
          "Share unavailable",
          "We couldn't generate your profile link yet. Please try again in a moment."
        );
        return;
      }
      await shareProfileLink(shareUrl);
    } catch {
      showAlert("Share unavailable", "Please try again in a moment.");
    } finally {
      setSharingProfile(false);
    }
  }, [sharingProfile, showAlert]);

  const hasCandidates = candidates.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Nobody&apos;s free yet</Text>
      <Text style={styles.subtitle}>
        {hasCandidates
          ? "Nudge your friends to see if they're free."
          : "Check back soon — or share your profile to grow your circle."}
      </Text>

      {hasCandidates ? (
        <View style={styles.nudgeSection}>
          {canShuffle ? (
            <TouchableOpacity
              style={styles.shuffleBtn}
              onPress={handleShuffle}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Show 3 more friends to nudge"
            >
              <Ionicons name="shuffle-outline" size={22} color={MUTED2} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.nudgeList}>
            {shownFriends.map((friend) => {
              const row = nudgeByFriendId[friend.id];
              return (
                <SynqNudgeCard
                  key={friend.id}
                  variant="compact"
                  friend={friend}
                  onNudge={() => void handleNudge(friend)}
                  loading={row?.loading ?? false}
                  sent={row?.sent ?? false}
                />
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.growthSection}>
          <TouchableOpacity
            style={[synqOutlineAddBtn, styles.shareCta]}
            onPress={() => void handleShareProfile()}
            disabled={sharingProfile}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Share profile"
          >
            <Ionicons name="share-social-outline" size={20} color={ACCENT} />
            <Text style={synqOutlineAddBtnText}>
              {sharingProfile ? "Preparing…" : "Share profile"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: SPACE_5,
    paddingBottom: SPACE_4,
    maxWidth: 420,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    ...modalTitleText,
    lineHeight: 32,
    textAlign: "center",
  },
  subtitle: {
    ...modalBodyText,
    fontSize: TYPE_SUBHEAD,
    lineHeight: 24,
    textAlign: "center",
    marginTop: SPACE_3,
  },
  nudgeSection: {
    marginTop: SPACE_4,
  },
  nudgeList: {
    gap: 10,
  },
  shuffleBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 2,
    padding: 4,
  },
  growthSection: {
    marginTop: SPACE_5,
    alignItems: "center",
  },
  shareCta: {
    flexDirection: "row",
    gap: 8,
  },
});
