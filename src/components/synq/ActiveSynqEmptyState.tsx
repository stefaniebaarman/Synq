import type { Friend } from "@/constants/Variables";
import {
  MUTED2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  TYPE_SUBHEAD,
  modalBodyText,
  modalTitleText,
} from "@/constants/Variables";
import SynqNudgeCard from "@/src/components/synq/SynqNudgeCard";
import {
  nudgeCooldownRemainingMs,
  nudgeSentStorageKey,
  persistNudgeSent,
  readNudgeSentState,
  sendSynqNudge,
  synqNudgeErrorMessage,
  warmSynqNudgeClient,
} from "@/src/lib/synqNudge";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

type NudgeRowState = { loading: boolean; sent: boolean };

type Props = {
  viewerId: string;
  candidates: Friend[];
};

export default function ActiveSynqEmptyState({ viewerId, candidates }: Props) {
  const [nudgeByFriendId, setNudgeByFriendId] = useState<Record<string, NudgeRowState>>({});

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

  const handleNudge = useCallback(
    async (friend: Friend) => {
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
          [friendId]: { loading: true, sent: row?.sent ?? false },
        };
      });
      if (blocked) return;

      const storageKey = nudgeSentStorageKey(viewerId, friendId);
      try {
        await sendSynqNudge(friendId);
        await persistNudgeSent(storageKey);
        setNudgeByFriendId((prev) => ({
          ...prev,
          [friendId]: { loading: false, sent: true },
        }));
        Alert.alert("Nudge sent", "They'll get a notification asking if they're free.");
      } catch (err) {
        const msg = synqNudgeErrorMessage(err);
        if (msg.includes("again in a few hours")) {
          await persistNudgeSent(storageKey);
          setNudgeByFriendId((prev) => ({
            ...prev,
            [friendId]: { loading: false, sent: true },
          }));
        } else {
          setNudgeByFriendId((prev) => ({
            ...prev,
            [friendId]: { loading: false, sent: prev[friendId]?.sent ?? false },
          }));
          Alert.alert("Couldn't nudge", msg);
        }
      }
    },
    [viewerId]
  );

  const hasCandidates = candidates.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Nobody&apos;s free yet</Text>
      <Text style={styles.subtitle}>
        {hasCandidates
          ? "Nudge your friends to see if they're free."
          : "Check back soon — or add more friends to grow your circle."}
      </Text>

      {hasCandidates ? (
        <View style={styles.nudgeSection}>
          <View style={styles.nudgeList}>
            {candidates.map((friend) => {
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
      ) : null}
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
    marginTop: SPACE_5,
  },
  nudgeList: {
    gap: 10,
  },
});
