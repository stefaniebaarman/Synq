import {
  ACCENT,
  MUTED2,
  MUTED3,
  SPACE_2,
  SPACE_3,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnTextCompact,
} from "@/constants/Variables";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { sheetStyles } from "@/constants/sheetStyles";
import {
  formatDropInRemaining,
  type FriendDropIn,
} from "@/src/lib/dropIn";
import { resolveAvatar } from "@/src/lib/helpers";
import { openInMaps } from "@/src/lib/openInMaps";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  dropIns: FriendDropIn[];
  onMessage: (friendId: string) => void;
};

function firstName(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "Friend";
}

export default function FriendsDropInsStrip({ dropIns, onMessage }: Props) {
  const [selected, setSelected] = useState<FriendDropIn | null>(null);

  useEffect(() => {
    if (!selected) return;
    if (!dropIns.some((d) => d.friendId === selected.friendId)) {
      setSelected(null);
    }
  }, [dropIns, selected]);

  if (dropIns.length === 0) return null;

  const place = selected?.place;
  const canOpenMaps =
    !!place &&
    (!!place.name ||
      (typeof place.lat === "number" && typeof place.lng === "number"));

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.heading}>Dropped in</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {dropIns.map((item) => {
            const uri = resolveAvatar(item.imageurl);
            return (
              <Pressable
                key={item.friendId}
                style={styles.card}
                onPress={() => setSelected(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.displayName} is at ${item.place?.name || item.text}`}
              >
                <View style={styles.avatarWrap}>
                  {uri ? (
                    <ExpoImage
                      source={{ uri }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>
                        {firstName(item.displayName).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.liveDot} />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {firstName(item.displayName)}
                </Text>
                <Text style={styles.snippet} numberOfLines={2}>
                  {item.text}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SpringBottomSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        contentStyle={styles.detailPad}
        cardStyle={sheetStyles.sheetCard}
      >
        {selected ? (
          <>
            <Text style={styles.detailTitle}>
              {firstName(selected.displayName)} is at{" "}
              {selected.place?.name || selected.text}
            </Text>
            <Text style={styles.detailMeta}>
              {formatDropInRemaining(selected.expiresAtMs)}
            </Text>
            <Text style={styles.detailBody}>{selected.text}</Text>
            {place?.name ? (
              <Text style={styles.detailPlace}>{place.name}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={styles.actionBtn}
                onPress={() => {
                  const id = selected.friendId;
                  setSelected(null);
                  onMessage(id);
                }}
                accessibilityRole="button"
                accessibilityLabel="Message"
              >
                <Text style={styles.actionBtnText}>Message</Text>
              </Pressable>
              {canOpenMaps ? (
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => {
                    void openInMaps({
                      name: place?.name || selected.text,
                      address: place?.address || place?.name || "",
                      lat: place?.lat,
                      lng: place?.lng,
                    });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open in Maps"
                >
                  <Text style={styles.actionBtnText}>Open in Maps</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </SpringBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACE_3,
  },
  heading: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: SPACE_2,
    paddingHorizontal: 2,
  },
  row: {
    gap: 10,
    paddingRight: 8,
  },
  card: {
    width: 118,
    padding: 10,
    borderRadius: 14,
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  avatarWrap: {
    width: 40,
    height: 40,
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.heavy,
    color: TEXT,
    fontSize: 16,
  },
  liveDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: SURFACE_ELEVATED,
  },
  name: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: TEXT,
    marginBottom: 2,
  },
  snippet: {
    fontFamily: fonts.book,
    fontSize: 11,
    color: MUTED3,
    lineHeight: 14,
  },
  detailPad: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  detailTitle: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: TEXT,
    marginBottom: 4,
  },
  detailMeta: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
    marginBottom: SPACE_3,
  },
  detailBody: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
    lineHeight: 22,
    marginBottom: 6,
  },
  detailPlace: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    marginBottom: SPACE_3,
  },
  actions: {
    gap: 10,
    marginTop: SPACE_2,
  },
  actionBtn: {
    ...synqOutlineAddBtnCompact,
    alignSelf: "stretch",
  },
  actionBtnText: synqOutlineAddBtnTextCompact,
});
