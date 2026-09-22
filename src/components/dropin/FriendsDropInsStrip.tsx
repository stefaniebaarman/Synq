import {
  ACCENT,
  BG,
  BG_TRANSPARENT,
  MUTED2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  listSectionTitle,
} from "@/constants/Variables";
import SpringBottomSheet from "@/src/components/sheets/SpringBottomSheet";
import { sheetStyles } from "@/constants/sheetStyles";
import type { FriendDropIn } from "@/src/lib/dropIn";
import { resolveAvatar } from "@/src/lib/helpers";
import { openInMaps } from "@/src/lib/openInMaps";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
};

function firstName(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "Friend";
}

export default function FriendsDropInsStrip({ dropIns }: Props) {
  const [selected, setSelected] = useState<FriendDropIn | null>(null);

  useEffect(() => {
    if (!selected) return;
    if (!dropIns.some((d) => d.friendId === selected.friendId)) {
      setSelected(null);
    }
  }, [dropIns, selected]);

  if (dropIns.length === 0) return null;

  const place = selected?.place;
  const placeName = place?.name?.trim() || "";
  const locationLabel =
    placeName || selected?.text?.trim() || "somewhere nearby";
  const canOpenMaps =
    !!selected &&
    (!!placeName ||
      (typeof place?.lat === "number" && typeof place?.lng === "number"));

  return (
    <>
      <View style={styles.wrap}>
        <Text style={styles.title}>Where friends are</Text>
        <View style={styles.listShell}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {dropIns.map((item) => {
              const uri = resolveAvatar(item.imageurl);
              const name = firstName(item.displayName);
              const placeLabel =
                item.place?.name?.trim() || item.text?.trim() || "Nearby";
              return (
                <Pressable
                  key={item.friendId}
                  style={styles.card}
                  onPress={() => setSelected(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${name} is at ${placeLabel}`}
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
                          {name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.liveDot} />
                  </View>
                  <Text style={styles.isAtLine} numberOfLines={1}>
                    <Text style={styles.namePart}>{name}</Text>
                    <Text style={styles.isAtPart}> is at</Text>
                  </Text>
                  <Text style={styles.location} numberOfLines={2}>
                    {placeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[BG_TRANSPARENT, BG]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rightFade}
          />
        </View>
      </View>

      <SpringBottomSheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        contentStyle={styles.detailPad}
        cardStyle={[sheetStyles.sheetCard, styles.detailCard]}
      >
        {selected ? (
          <View style={styles.detailBody}>
            <Text style={styles.detailTitle}>
              {firstName(selected.displayName)} is at
            </Text>
            <Pressable
              onPress={() => {
                if (!canOpenMaps) return;
                void openInMaps({
                  name: locationLabel,
                  address: place?.address || placeName || "",
                  lat: place?.lat,
                  lng: place?.lng,
                });
              }}
              disabled={!canOpenMaps}
              accessibilityRole={canOpenMaps ? "link" : undefined}
              accessibilityLabel={
                canOpenMaps ? `Open ${locationLabel} in Maps` : locationLabel
              }
            >
              <Text
                style={[
                  styles.detailPlace,
                  canOpenMaps && styles.detailPlaceLink,
                ]}
              >
                {locationLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </SpringBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
    paddingTop: SPACE_3,
  },
  title: {
    ...listSectionTitle,
    marginBottom: SPACE_3,
  },
  listShell: {
    position: "relative",
  },
  row: {
    gap: 10,
    paddingRight: 36,
  },
  rightFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 40,
    zIndex: 1,
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
  isAtLine: {
    fontSize: TYPE_CAPTION,
    marginBottom: 2,
  },
  namePart: {
    fontFamily: fonts.medium,
    color: TEXT,
  },
  isAtPart: {
    fontFamily: fonts.book,
    color: MUTED2,
  },
  location: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: ACCENT,
    lineHeight: 15,
  },
  detailPad: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_5,
    paddingBottom: SPACE_6,
  },
  detailCard: {
    paddingTop: SPACE_5,
  },
  detailBody: {
    paddingHorizontal: SPACE_6,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_5,
  },
  detailTitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 22,
    marginBottom: SPACE_4,
  },
  detailPlace: {
    fontFamily: fonts.heavy,
    fontSize: 22,
    color: TEXT,
    lineHeight: 28,
  },
  detailPlaceLink: {
    color: ACCENT,
  },
});
