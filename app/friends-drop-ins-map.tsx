import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED2,
  RADIUS_MD,
  SHEET_SURFACE,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE_ELEVATED,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_LEAD,
  fonts,
  synqOutlineAddBtnText,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import {
  DROP_IN_EXPIRATION_MS,
  dropInHasMapCoords,
  pollActiveFriendDropIns,
  type FriendDropIn,
} from "@/src/lib/dropIn";
import {
  DROP_IN_MAP_DARK_STYLE,
  formatDropInFreshness,
} from "@/src/lib/dropInMapStyle";
import { auth, db } from "@/src/lib/firebase";
import { resolveAvatar } from "@/src/lib/helpers";
import { openInMaps } from "@/src/lib/openInMaps";
import { friendsListCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FALLBACK_REGION: Region = {
  latitude: 38.9072,
  longitude: -77.0369,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

type MappableDropIn = FriendDropIn & {
  place: NonNullable<FriendDropIn["place"]> & { lat: number; lng: number };
};

function toMappable(rows: FriendDropIn[]): MappableDropIn[] {
  return rows.filter((row): row is MappableDropIn => dropInHasMapCoords(row));
}

function regionForDropIns(
  rows: MappableDropIn[],
  focus?: MappableDropIn | null
): Region {
  if (focus) {
    return {
      latitude: focus.place.lat,
      longitude: focus.place.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }
  if (rows.length === 0) return FALLBACK_REGION;
  if (rows.length === 1) {
    return {
      latitude: rows[0].place.lat,
      longitude: rows[0].place.lng,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }
  let minLat = rows[0].place.lat;
  let maxLat = rows[0].place.lat;
  let minLng = rows[0].place.lng;
  let maxLng = rows[0].place.lng;
  for (const row of rows) {
    minLat = Math.min(minLat, row.place.lat);
    maxLat = Math.max(maxLat, row.place.lat);
    minLng = Math.min(minLng, row.place.lng);
    maxLng = Math.max(maxLng, row.place.lng);
  }
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.04, (maxLat - minLat) * 1.6 || 0.04);
  const longitudeDelta = Math.max(0.04, (maxLng - minLng) * 1.6 || 0.04);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

function DropInMapMarker({
  item,
  selected,
}: {
  item: MappableDropIn;
  selected: boolean;
}) {
  const uri = resolveAvatar(item.imageurl);
  const placeLabel = item.place.name?.trim() || "Nearby";
  const initial = (item.displayName.trim().charAt(0) || "?").toUpperCase();

  return (
    <View style={styles.markerRoot} collapsable={false}>
      <View
        style={[
          styles.markerAvatarWrap,
          selected && styles.markerAvatarSelected,
        ]}
      >
        {uri ? (
          <ExpoImage
            source={{ uri }}
            style={styles.markerAvatar}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.markerAvatar, styles.markerAvatarFallback]}>
            <Text style={styles.markerInitial}>{initial}</Text>
          </View>
        )}
        <View style={styles.markerLiveDot} />
      </View>
      <View style={[styles.markerLabel, selected && styles.markerLabelSelected]}>
        <Text style={styles.markerLabelText} numberOfLines={1}>
          {placeLabel}
        </Text>
      </View>
    </View>
  );
}

export default function FriendsDropInsMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const myId = auth.currentUser?.uid || "";
  const fittedKeyRef = useRef("");

  const [dropIns, setDropIns] = useState<FriendDropIn[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewerCoords, setViewerCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const mappable = useMemo(() => toMappable(dropIns), [dropIns]);
  const mappableKey = useMemo(
    () => mappable.map((r) => r.friendId).join("|"),
    [mappable]
  );
  const selected = useMemo(
    () => mappable.find((row) => row.friendId === selectedId) ?? null,
    [mappable, selectedId]
  );

  const refreshDropIns = useCallback(
    (force = false) => {
      if (!myId) {
        setDropIns([]);
        return;
      }
      const ids = (friendsListCacheByUser[myId] ?? []).map((f) => f.id);
      if (ids.length === 0) {
        setDropIns([]);
        return;
      }
      void pollActiveFriendDropIns(myId, ids, { force })
        .then((rows) => setDropIns(rows))
        .catch(() => setDropIns([]));
    },
    [myId]
  );

  useFocusEffect(
    useCallback(() => {
      refreshDropIns(true);
      const timer = setInterval(() => refreshDropIns(true), 15_000);
      return () => clearInterval(timer);
    }, [refreshDropIns])
  );

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    void getDoc(doc(db, "users", myId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const lat =
          typeof data.lat === "number" && Number.isFinite(data.lat)
            ? data.lat
            : null;
        const lng =
          typeof data.lng === "number" && Number.isFinite(data.lng)
            ? data.lng
            : null;
        if (lat != null && lng != null) {
          setViewerCoords({ lat, lng });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useEffect(() => {
    if (selectedId && !mappable.some((row) => row.friendId === selectedId)) {
      setSelectedId(null);
    }
  }, [mappable, selectedId]);

  // Custom marker bitmaps need a short tracksViewChanges window after pin set changes.
  useEffect(() => {
    if (!mappableKey) return;
    setTracksViewChanges(true);
    const t = setTimeout(() => setTracksViewChanges(false), 1400);
    return () => clearTimeout(t);
  }, [mappableKey, selectedId]);

  useEffect(() => {
    if (!mappableKey || mappableKey === fittedKeyRef.current) return;
    fittedKeyRef.current = mappableKey;
    const region = regionForDropIns(mappable);
    const t = setTimeout(() => {
      mapRef.current?.animateToRegion(region, 350);
    }, 80);
    return () => clearTimeout(t);
  }, [mappableKey, mappable]);

  useEffect(() => {
    if (!selected) return;
    mapRef.current?.animateToRegion(regionForDropIns(mappable, selected), 280);
  }, [selected, mappable]);

  const initialRegion = useMemo(() => {
    if (mappable.length > 0) return regionForDropIns(mappable);
    if (viewerCoords) {
      return {
        latitude: viewerCoords.lat,
        longitude: viewerCoords.lng,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      };
    }
    return FALLBACK_REGION;
  }, [mappable, viewerCoords]);

  const onSelectFriend = useCallback((friendId: string) => {
    void Haptics.selectionAsync();
    setSelectedId(friendId);
  }, []);

  const onRecenter = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (mappable.length > 0) {
      mapRef.current?.animateToRegion(regionForDropIns(mappable), 350);
      return;
    }
    if (viewerCoords) {
      mapRef.current?.animateToRegion(
        {
          latitude: viewerCoords.lat,
          longitude: viewerCoords.lng,
          latitudeDelta: 0.12,
          longitudeDelta: 0.12,
        },
        350
      );
    }
  }, [mappable, viewerCoords]);

  const onDirections = useCallback(() => {
    if (!selected?.place) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void openInMaps({
      name: selected.place.name,
      address: selected.place.address,
      lat: selected.place.lat,
      lng: selected.place.lng,
    });
  }, [selected]);

  const freshness = formatDropInFreshness(
    selected?.startedAtMs ??
      (selected ? selected.expiresAtMs - DROP_IN_EXPIRATION_MS : null)
  );
  const placeName = selected?.place?.name?.trim() || "Nearby";
  const statusText = selected?.text?.trim() || "";
  const address = selected?.place?.address?.trim() || "";
  const selectedAvatar = selected ? resolveAvatar(selected.imageurl) : "";

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        customMapStyle={DROP_IN_MAP_DARK_STYLE}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={() => setSelectedId(null)}
      >
        {mappable.map((item) => (
          <Marker
            key={item.friendId}
            coordinate={{
              latitude: item.place.lat,
              longitude: item.place.lng,
            }}
            onPress={(e) => {
              e.stopPropagation();
              onSelectFriend(item.friendId);
            }}
            tracksViewChanges={tracksViewChanges}
            anchor={{ x: 0.5, y: 1 }}
          >
            <DropInMapMarker
              item={item}
              selected={selectedId === item.friendId}
            />
          </Marker>
        ))}
      </MapView>

      <View
        pointerEvents="box-none"
        style={[styles.headerOverlay, { paddingTop: insets.top + 4 }]}
      >
        <BackButton onPress={() => router.back()} style={styles.backBtn} />
      </View>

      {mappable.length === 0 ? (
        <View
          pointerEvents="none"
          style={[styles.emptyBanner, { top: insets.top + 64 }]}
        >
          <Text style={styles.emptyTitle}>No live map pins</Text>
          <Text style={styles.emptyBody}>
            Friends need an active Drop-in with a place to show up here.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onRecenter}
        style={[
          styles.recenterBtn,
          {
            bottom: (selected ? 180 : 24) + Math.max(insets.bottom, 12),
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Recenter map"
      >
        <Ionicons name="navigate" size={20} color={TEXT} />
      </Pressable>

      {selected ? (
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.sheetGrabber} />
          <View style={styles.sheetRow}>
            <View style={styles.sheetAvatarWrap}>
              {selectedAvatar ? (
                <ExpoImage
                  source={{ uri: selectedAvatar }}
                  style={styles.sheetAvatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.sheetAvatar, styles.sheetAvatarFallback]}>
                  <Text style={styles.sheetInitial}>
                    {(selected.displayName.trim().charAt(0) || "?").toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.sheetLiveDot} />
            </View>
            <View style={styles.sheetMain}>
              <Text style={styles.sheetName} numberOfLines={1}>
                {selected.displayName.trim() || "Friend"}
              </Text>
              <Text style={styles.sheetPlace} numberOfLines={1}>
                {placeName}
              </Text>
              <Text style={styles.sheetMeta}>{freshness}</Text>
            </View>
          </View>
          {address ? (
            <Text style={styles.sheetAddress} numberOfLines={2}>
              {address}
            </Text>
          ) : null}
          {statusText && statusText !== placeName ? (
            <Text style={styles.sheetStatus} numberOfLines={3}>
              {statusText}
            </Text>
          ) : null}
          <Pressable
            onPress={onDirections}
            style={({ pressed }) => [
              styles.directionsBtn,
              pressed && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Directions to ${placeName}`}
          >
            <Ionicons name="navigate-outline" size={16} color={ACCENT} />
            <Text style={styles.directionsBtnText}>Directions</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_3,
    paddingBottom: SPACE_3,
  },
  backBtn: {
    backgroundColor: "rgba(9,10,11,0.72)",
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  emptyBanner: {
    position: "absolute",
    left: SPACE_5,
    right: SPACE_5,
    padding: SPACE_4,
    borderRadius: RADIUS_MD,
    backgroundColor: "rgba(20,20,20,0.92)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  emptyTitle: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_LEAD,
    color: TEXT,
    marginBottom: 4,
  },
  emptyBody: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    lineHeight: 18,
  },
  recenterBtn: {
    position: "absolute",
    right: SPACE_4,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ELEVATED,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
    }),
  },
  markerRoot: {
    alignItems: "center",
    maxWidth: 140,
  },
  markerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: SURFACE_ELEVATED,
    overflow: "visible",
  },
  markerAvatarSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.06 }],
  },
  markerAvatar: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  markerAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE_ELEVATED,
  },
  markerInitial: {
    fontFamily: fonts.heavy,
    color: TEXT,
    fontSize: 16,
  },
  markerLiveDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: BG,
  },
  markerLabel: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(9,10,11,0.88)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.35)",
    maxWidth: 130,
  },
  markerLabelSelected: {
    borderColor: ACCENT,
  },
  markerLabelText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: ACCENT,
    textAlign: "center",
  },
  sheet: {
    position: "absolute",
    left: SPACE_3,
    right: SPACE_3,
    bottom: SPACE_3,
    zIndex: 6,
    paddingHorizontal: SPACE_4,
    paddingTop: 10,
    borderRadius: 18,
    backgroundColor: SHEET_SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 8 },
    }),
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetAvatarWrap: {
    width: 56,
    height: 56,
  },
  sheetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  sheetAvatarFallback: {
    backgroundColor: SURFACE_ELEVATED,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetInitial: {
    fontFamily: fonts.heavy,
    color: TEXT,
    fontSize: 22,
  },
  sheetLiveDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ACCENT,
    borderWidth: 2,
    borderColor: SHEET_SURFACE,
  },
  sheetMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetName: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: TEXT,
  },
  sheetPlace: {
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
    color: ACCENT,
  },
  sheetMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  sheetAddress: {
    marginTop: 10,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    lineHeight: 18,
  },
  sheetStatus: {
    marginTop: 8,
    fontFamily: fonts.book,
    fontSize: TYPE_LEAD,
    color: TEXT,
    lineHeight: 20,
  },
  directionsBtn: {
    marginTop: 16,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  directionsBtnText: {
    ...synqOutlineAddBtnText,
    fontSize: TYPE_BUTTON,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
