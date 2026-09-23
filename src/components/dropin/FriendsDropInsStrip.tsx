import {
  ACCENT,
  BG_TRANSPARENT,
  MUTED2,
  SPACE_3,
  SURFACE_ELEVATED,
  TEXT,
  fonts,
  listSectionTitle,
  sectionLinkText,
} from "@/constants/Variables";
import type { DropInPlace, FriendDropIn } from "@/src/lib/dropIn";
import { dropInHasMapCoords } from "@/src/lib/dropIn";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";

const RIGHT_FADE_WIDTH = 28;
const SCROLL_END_SPACER = 8;
const AVATAR = 48;

/** Temporarily off — Blast UI not ready to ship. Keep code; re-enable later. */
const BLAST_UI_ENABLED = false;

const RIGHT_FADE_COLORS = [
  BG_TRANSPARENT,
  "rgba(9,10,11,0.22)",
  "rgba(9,10,11,0.55)",
] as const;
const RIGHT_FADE_LOCATIONS = [0, 0.55, 1] as const;

export type OwnBlastLive = {
  text: string;
  place: DropInPlace | null;
  imageurl?: string | null;
};

type Props = {
  dropIns: FriendDropIn[];
  onPressViewMap?: () => void;
  onPressBlast?: () => void;
  viewerImageUrl?: string | null;
  ownBlastLive?: OwnBlastLive | null;
  onEndOwnBlast?: () => void;
  endOwnBlastBusy?: boolean;
};

function placeLabel(place: DropInPlace | null | undefined, text?: string) {
  return place?.name?.trim() || String(text || "").trim() || "Nearby";
}

export default function FriendsDropInsStrip({
  dropIns,
  onPressViewMap,
  onPressBlast: _onPressBlast,
  ownBlastLive: _ownBlastLive,
  onEndOwnBlast: _onEndOwnBlast,
  endOwnBlastBusy: _endOwnBlastBusy,
}: Props) {
  // Blast UI gated off — flip BLAST_UI_ENABLED and restore commented JSX to ship.
  const showBlast = false;
  void _onPressBlast;
  void _ownBlastLive;
  void _onEndOwnBlast;
  void _endOwnBlastBusy;
  void BLAST_UI_ENABLED;
  if (!showBlast && dropIns.length === 0) return null;

  const canViewMap =
    typeof onPressViewMap === "function" &&
    dropIns.some((item) => dropInHasMapCoords(item));

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Where friends are</Text>
        <View style={styles.titleActions}>
          {/* Blast UI — disabled until ready to ship (BLAST_UI_ENABLED)
          {ownBlastLive && onEndOwnBlast ? (
            <Pressable
              onPress={onEndOwnBlast}
              disabled={endOwnBlastBusy}
              hitSlop={8}
              style={({ pressed }) => [
                styles.linkBtn,
                (pressed || endOwnBlastBusy) && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="End blast"
            >
              <Text style={styles.endLink}>End</Text>
            </Pressable>
          ) : onPressBlast ? (
            <Pressable
              onPress={onPressBlast}
              hitSlop={8}
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send live blast"
            >
              <Text style={styles.blastLink}>Blast</Text>
            </Pressable>
          ) : null}
          */}
          {canViewMap ? (
            <Pressable
              onPress={onPressViewMap}
              hitSlop={8}
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="View map of where friends are"
            >
              <Text style={styles.mapLink}>Map</Text>
              <Ionicons name="chevron-forward" size={14} color={MUTED2} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Blast UI — disabled until ready to ship (BLAST_UI_ENABLED)
      {ownBlastLive ? (
        <Text style={styles.ownLiveLine} numberOfLines={1}>
          You · {placeLabel(ownBlastLive.place, ownBlastLive.text)}
        </Text>
      ) : null}
      */}

      {dropIns.length > 0 ? (
        <View style={styles.listShell}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            alwaysBounceHorizontal
            bounces
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.row}
          >
            {dropIns.map((item) => {
              const uri = resolveAvatar(item.imageurl);
              const name = String(item.displayName || "").trim() || "Friend";
              const initial = name.charAt(0).toUpperCase() || "F";
              const place = placeLabel(item.place, item.text);
              return (
                <View
                  key={item.friendId}
                  style={styles.person}
                  accessibilityLabel={`${name} at ${place}`}
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
                        <Text style={styles.avatarInitial}>{initial}</Text>
                      </View>
                    )}
                    <View style={styles.liveDot} />
                  </View>
                  <Text style={styles.place} numberOfLines={2}>
                    {place}
                  </Text>
                </View>
              );
            })}
            <View style={styles.scrollEndSpacer} />
          </ScrollView>
          <LinearGradient
            pointerEvents="none"
            colors={[...RIGHT_FADE_COLORS]}
            locations={[...RIGHT_FADE_LOCATIONS]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.rightFade}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 0,
    paddingTop: SPACE_3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  title: {
    ...listSectionTitle,
    flexShrink: 1,
    marginBottom: 0,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flexShrink: 0,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  blastLink: {
    ...sectionLinkText,
  },
  endLink: {
    ...sectionLinkText,
    color: MUTED2,
  },
  mapLink: {
    ...sectionLinkText,
    color: MUTED2,
  },
  ownLiveLine: {
    fontFamily: fonts.book,
    fontSize: 13,
    color: ACCENT,
    marginBottom: 10,
  },
  listShell: {
    position: "relative",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingRight: RIGHT_FADE_WIDTH,
  },
  scrollEndSpacer: {
    width: SCROLL_END_SPACER,
  },
  rightFade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: RIGHT_FADE_WIDTH,
    zIndex: 1,
  },
  person: {
    width: 64,
    alignItems: "center",
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    marginBottom: 6,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
  },
  avatarFallback: {
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: fonts.heavy,
    color: TEXT,
    fontSize: 17,
  },
  liveDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: SURFACE_ELEVATED,
  },
  place: {
    fontFamily: fonts.book,
    fontSize: 11,
    lineHeight: 14,
    color: MUTED2,
    textAlign: "center",
    alignSelf: "stretch",
  },
});
