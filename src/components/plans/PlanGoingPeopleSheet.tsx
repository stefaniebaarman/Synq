import {
  ACCENT,
  BG,
  BORDER,
  BORDER_STRONG,
  DEFAULT_AVATAR,
  MODAL_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_SUBHEAD,
  fonts,
  RADIUS_LG,
  RADIUS_SM,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { db } from "@/src/lib/firebase";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FlatList, Pressable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PlanGoingPerson = {
  userId: string | null;
  displayName: string;
  imageUrl?: string | null;
  isHost?: boolean;
};

type Props = {
  visible: boolean;
  planTitle?: string | null;
  people: PlanGoingPerson[];
  onClose: () => void;
  /** Fires after the sheet has fully dismissed (safe for follow-up navigation). */
  onClosed?: () => void;
  onPressPerson?: (person: PlanGoingPerson) => void;
  /** Viewer cannot open their own profile from this list. */
  viewerId?: string | null;
};

function needsProfileHydration(person: PlanGoingPerson): boolean {
  if (!person.userId) return false;
  const name = String(person.displayName || "").trim().toLowerCase();
  const generic = !name || name === "friend" || name === "someone";
  const missingImage = !String(person.imageUrl || "").trim();
  return generic || missingImage;
}

function peopleSignature(people: PlanGoingPerson[]): string {
  return people
    .map(
      (p) =>
        `${String(p.userId || "")}|${String(p.displayName || "")}|${String(p.imageUrl || "")}|${
          p.isHost ? "1" : "0"
        }`
    )
    .join(";");
}

export default function PlanGoingPeopleSheet({
  visible,
  planTitle,
  people,
  onClose,
  onClosed,
  onPressPerson,
  viewerId,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * 0.7);
  const title = String(planTitle || "").trim() || "this plan";
  const viewerKey = String(viewerId || "").trim();
  const [hydratedPeople, setHydratedPeople] = useState<PlanGoingPerson[]>(people);
  const peopleKey = useMemo(() => peopleSignature(people), [people]);
  const lastPeopleKeyRef = useRef(peopleKey);

  useEffect(() => {
    if (lastPeopleKeyRef.current === peopleKey) return;
    lastPeopleKeyRef.current = peopleKey;
    setHydratedPeople(people);
  }, [people, peopleKey]);

  useEffect(() => {
    if (!visible) return;

    const toFetch = people.filter(needsProfileHydration);
    if (toFetch.length === 0) return;

    let cancelled = false;
    void (async () => {
      const updates: Record<string, { displayName?: string; imageUrl?: string | null }> = {};
      await Promise.all(
        toFetch.map(async (person) => {
          const uid = String(person.userId || "").trim();
          if (!uid) return;
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (!snap.exists()) return;
            const data = snap.data() as { displayName?: string; imageurl?: string };
            const displayName = String(data.displayName || "").trim();
            const imageUrl = data.imageurl ? resolveAvatar(data.imageurl) : null;
            updates[uid] = {
              ...(displayName ? { displayName } : {}),
              ...(imageUrl ? { imageUrl } : { imageUrl: null }),
            };
          } catch {
            // Profile may be unreadable; keep list row as-is.
          }
        })
      );
      if (cancelled || Object.keys(updates).length === 0) return;
      setHydratedPeople((prev) =>
        prev.map((person) => {
          const uid = String(person.userId || "").trim();
          const patch = uid ? updates[uid] : undefined;
          if (!patch) return person;
          return {
            ...person,
            displayName: patch.displayName || person.displayName,
            imageUrl: patch.imageUrl !== undefined ? patch.imageUrl : person.imageUrl,
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, peopleKey]);

  return (
    <SpringBottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      cardStyle={[
        styles.sheet,
        { height: sheetHeight, paddingBottom: Math.max(28, insets.bottom + 12) },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Going to {title}</Text>
        <CloseButton onPress={onClose} />
      </View>
      <FlatList
        data={hydratedPeople}
        keyExtractor={(item, index) => item.userId || `person-${index}`}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const avatarUri = item.imageUrl || DEFAULT_AVATAR;
          const uid = String(item.userId || "").trim();
          const canOpen =
            !!onPressPerson && !!uid && (!viewerKey || uid !== viewerKey);

          const row = (
            <View style={styles.row}>
              <View
                style={styles.avatarWrap}
                accessibilityLabel={item.isHost ? "Plan host" : undefined}
              >
                <View style={[styles.avatarRing, item.isHost && styles.avatarRingHost]}>
                  <View style={styles.avatarInner}>
                    <ExpoImage
                      source={{ uri: avatarUri }}
                      style={styles.avatarImg}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  </View>
                </View>
                {item.isHost ? (
                  <View style={styles.hostBadge}>
                    <Ionicons name="star" size={10} color={ON_ACCENT_TEXT} />
                  </View>
                ) : null}
              </View>
              <View style={styles.nameBlock}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.isHost ? <Text style={styles.hostLabel}>Host</Text> : null}
              </View>
            </View>
          );

          if (!canOpen) return row;

          return (
            <Pressable
              onPress={() => onPressPerson?.(item)}
              style={styles.rowPressable}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.displayName}'s profile`}
            >
              {row}
            </Pressable>
          );
        }}
      />
    </SpringBottomSheet>
  );
}

const AVATAR_SIZE = 40;
const HOST_RING = 2.5;
const BADGE_SIZE = 18;

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingTop: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_SUBHEAD,
    marginRight: 12,
  },
  list: {
    flex: 1,
    paddingHorizontal: 12,
  },
  rowPressable: {
    borderRadius: RADIUS_SM,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  avatarWrap: {
    width: AVATAR_SIZE + HOST_RING * 2,
    height: AVATAR_SIZE + HOST_RING * 2,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: RADIUS_LG,
    padding: 0,
    backgroundColor: BORDER_STRONG,
  },
  avatarRingHost: {
    width: AVATAR_SIZE + HOST_RING * 2,
    height: AVATAR_SIZE + HOST_RING * 2,
    borderRadius: RADIUS_LG + HOST_RING,
    padding: HOST_RING,
    backgroundColor: ACCENT,
  },
  avatarInner: {
    flex: 1,
    borderRadius: RADIUS_LG,
    overflow: "hidden",
    backgroundColor: BORDER_STRONG,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  hostBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
  },
  hostLabel: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    marginTop: 1,
  },
});
