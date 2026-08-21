import AlertModal from "@/app/alert-modal";
import ConfirmModal from "@/app/confirm-modal";
import {
  BG,
  BORDER,
  MUTED2,
  RADIUS_LG,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_RAISED,
  TYPE_CAPTION,
  TYPE_LEAD,
  bodyBookText,
  emptyStateTitleText,
  fonts,
  listRowTitleText,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
} from "@/constants/Variables";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { ListRowsSkeleton } from "@/src/components/loading/BrandSkeletons";
import { auth, db } from "@/src/lib/firebase";
import { resolveAvatar } from "@/src/lib/helpers";
import {
  listBlockedUsers,
  unblockUser,
  type BlockedUserRow,
} from "@/src/lib/moderation";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function mapBlockedDocs(
  docs: { id: string; data: () => Record<string, unknown> }[]
): BlockedUserRow[] {
  return docs
    .map((d) => {
      const data = d.data();
      const displayName = String(data.displayName || "").trim() || "User";
      const imageurl = String(data.imageurl || "").trim();
      return {
        id: d.id,
        displayName,
        ...(imageurl ? { imageurl } : {}),
      };
    })
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, {
        sensitivity: "base",
      })
    );
}

export default function BlockedUsersScreen() {
  const uid = auth.currentUser?.uid ?? "";
  const [users, setUsers] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedUserRow | null>(
    null
  );
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!uid) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = collection(db, "users", uid, "blocked");
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(mapBlockedDocs(snap.docs));
        setLoading(false);
      },
      () => {
        setUsers([]);
        setLoading(false);
      }
    );
    return unsub;
  }, [uid]);

  // Best-effort Admin enrich for older blocks that only stored an id.
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let cancelled = false;
      void (async () => {
        try {
          const enriched = await listBlockedUsers();
          if (cancelled || !enriched.length) return;
          setUsers((prev) => {
            const merged = new Map<string, BlockedUserRow>();
            for (const row of prev) merged.set(row.id, row);
            for (const row of enriched) merged.set(row.id, row);
            return [...merged.values()].sort((a, b) =>
              a.displayName.localeCompare(b.displayName, undefined, {
                sensitivity: "base",
              })
            );
          });
        } catch {
          // Local snapshot is enough; callable may not be deployed yet.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [uid])
  );

  const confirmUnblock = async () => {
    const target = pendingUnblock;
    if (!target) return;
    setPendingUnblock(null);
    setUnblockingId(target.id);
    try {
      await unblockUser(target.id);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
    } catch {
      setAlertTitle("Couldn't unblock");
      setAlertMessage("Please try again.");
      setAlertVisible(true);
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader title="Blocked users" />

      {loading ? (
        <View style={styles.skeletonWrap}>
          <ListRowsSkeleton count={4} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            users.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ban-outline" size={28} color={MUTED2} />
              <Text style={styles.emptyTitle}>No blocked users</Text>
              <Text style={styles.emptyText}>
                People you block will show up here.
              </Text>
            </View>
          }
          ListHeaderComponent={
            users.length > 0 ? (
              <Text style={styles.hint}>
                Unblocking removes the block only. It does not add them back as a
                friend.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <ExpoImage
                source={{ uri: resolveAvatar(item.imageurl) }}
                style={styles.avatar}
                cachePolicy="memory-disk"
              />
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName || "User"}
              </Text>
              <TouchableOpacity
                style={synqOutlineAddBtnCompact}
                onPress={() => setPendingUnblock(item)}
                disabled={unblockingId === item.id}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.displayName || "user"}`}
              >
                <Text style={synqOutlineAddBtnTextCompact}>
                  {unblockingId === item.id ? "…" : "Unblock"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <ConfirmModal
        visible={pendingUnblock != null}
        title="Unblock?"
        message={
          pendingUnblock
            ? `Unblock ${pendingUnblock.displayName || "this user"}? They won't be added back as a friend.`
            : ""
        }
        confirmText="Unblock"
        onCancel={() => setPendingUnblock(null)}
        onConfirm={() => void confirmUnblock()}
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
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  skeletonWrap: {
    paddingTop: SPACE_4,
    paddingHorizontal: SPACE_4,
  },
  listContent: {
    paddingHorizontal: SPACE_4,
    paddingBottom: SPACE_5,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: "center",
  },
  hint: {
    ...bodyBookText,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    marginBottom: SPACE_4,
    marginTop: SPACE_3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE_RAISED,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BORDER,
  },
  name: {
    ...listRowTitleText,
    flex: 1,
    minWidth: 0,
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: SPACE_5,
    gap: 8,
  },
  emptyTitle: {
    ...emptyStateTitleText,
    textAlign: "center",
  },
  emptyText: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    lineHeight: 20,
    textAlign: "center",
  },
});
