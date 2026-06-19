import {
  ACCENT,
  BG,
  BORDER,
  BORDER_MUTED,
  BUTTON_RADIUS,
  Friend,
  MODAL_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  SPACE_6,
  SURFACE,
  SURFACE_INPUT,
  SURFACE_WELL,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  fonts,
  profileInterestPillText,
  profileInterestPillTextActive,
  profileLocationText,
  profileNameText,
  profileScreenSectionTitle,
  tabScreenMainHeaderTitle,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import NotificationBadge from "@/src/components/NotificationBadge";
import ProfileShareCard from "@/src/components/profile/ProfileShareCard";
import ProfilePhotoActionSheet from "@/src/components/ProfilePhotoActionSheet";
import ProfileTabHeaderOverlay, {
  useTabHeaderLayout,
} from "@/src/components/ProfileTabHeaderOverlay";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import { filterOrReject } from "@/src/lib/contentFilter";
import { ignoreSnapshotPermissionDenied } from "@/src/lib/firestoreListeners";
import { prefetchResolvedAvatar, resolveAvatar } from "@/src/lib/helpers";
import { setPendingProfilePhotoSource } from "@/src/lib/pendingProfilePhoto";
import {
  getPhotoLibraryPermission,
  launchProfilePhotoPicker,
  photoLibraryAccessGranted,
  requestPhotoLibraryAccess,
} from "@/src/lib/profilePhotoPicker";
import { buildProfileShareWebUrl } from "@/src/lib/profileShareUrl";
import { clearPushTokenOnSignOut } from "@/src/lib/pushToken";
import {
  captureAndShareProfileCard,
  shareProfileLink,
} from "@/src/lib/shareProfileCard";
import { removeProfilePhoto } from "@/src/lib/uploadProfilePhoto";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import ViewShot from "react-native-view-shot";
import { presetActivities, stateAbbreviations } from "../../assets/Mocks";
import { auth, db } from "../../src/lib/firebase";
import {
  FRIEND_REQUESTS_LISTENER_LIMIT,
  NOTIFICATIONS_LISTENER_LIMIT,
} from "../../src/lib/listenerLimits";
import { registerDismissNavigationOverlaysHandler } from "../../src/lib/navigationOverlayEvents";
import {
  computeTopSynqRows,
  getCachedOwnProfile,
  getMeTabInitialState,
  hydrateOwnProfileFromDisk,
  mergeCachedOwnProfile,
  setCachedOwnProfile,
  topSynqRowsEqual,
  topSynqRowsToCache,
  type TopSynqRow,
} from "../../src/lib/ownProfileCache";
import { filterOutPastOpenPlans, findHostOpenPlanIndex, hostPlanRowWithIdentity, matchesPlanEvent, sortOpenPlansByDateTime } from "../../src/lib/planEvents";
import { revokePlanInvite, revokePlanInviteErrorMessage, sendPlanInvites, type PlanInviteHint } from "../../src/lib/planInvite";
import { reconcileHostOpenPlansFromFriends } from "../../src/lib/reconcileHostOpenPlans";
import {
  friendsListCacheByUser,
  pruneSocialCachesToFriendIds,
  warmFriendsAndConnectionsCache,
} from "../../src/lib/socialCache";
import {
  subscribeFriendsIdsMultiplexed,
  subscribeUserDocMultiplexed,
} from "../../src/lib/socialListenerHub";
import { useAuthRefresh } from "../_layout";
import AlertModal from "../alert-modal";
import ConfirmModal from "../confirm-modal";
import MonthlyMemo from "../monthly-memo";

const allActivities = Object.values(presetActivities).flat();

type OpenPlanFields = {
  title: string;
  date: string;
  time: string;
  location: string;
};

type FirestorePlanRow = {
  id?: string;
  date?: string;
  time?: string;
  title?: string;
  location?: string;
  planHostUid?: string;
  [key: string]: unknown;
};

async function ensureHostPlanReadyForInvite(
  hostUid: string,
  planId: string,
  snapshot: Record<string, unknown>,
  fields?: OpenPlanFields
): Promise<{ planId: string; hint: PlanInviteHint } | null> {
  const ref = doc(db, "users", hostUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const evs: FirestorePlanRow[] = Array.isArray((snap.data() as { events?: unknown }).events)
    ? [...((snap.data() as { events: FirestorePlanRow[] }).events)]
    : [];

  const lookupOptions = { hostUid, fields };
  let idx = findHostOpenPlanIndex(evs, planId, snapshot, lookupOptions);
  if (idx < 0) {
    idx = findHostOpenPlanIndex(evs, planId, { ...snapshot, planHostUid: hostUid }, lookupOptions);
  }
  if (idx < 0) return null;

  const merged: FirestorePlanRow = fields ? { ...evs[idx], ...fields } : { ...evs[idx] };
  const nextRow = hostPlanRowWithIdentity(merged, planId, hostUid);
  const storedId = String(evs[idx]?.id || "").trim();
  const storedHost = String(evs[idx]?.planHostUid || "").trim();
  evs[idx] = nextRow as FirestorePlanRow;

  const needsWrite =
    storedId !== planId || !storedHost || storedHost !== hostUid || !!fields;
  if (needsWrite) {
    await updateDoc(ref, { events: sortOpenPlansByDateTime(evs) });
  }

  const canonicalId = String(nextRow.id || planId).trim();
  if (!canonicalId) return null;

  return {
    planId: canonicalId,
    hint: {
      title: String(nextRow.title || "").trim(),
      date: String(nextRow.date || "").trim(),
      time: String(nextRow.time || "").trim(),
      location: String(nextRow.location || "").trim(),
    },
  };
}

async function sendPlanInvitesWhenReady(
  hostUid: string,
  planId: string,
  snapshot: Record<string, unknown>,
  inviteFriendIds: string[],
  fields: OpenPlanFields,
  onInvited: (eventId: string, friendIds: string[]) => void,
  showAlert: (title: string, message: string) => void,
  savedWord: "saved" | "posted" = "saved"
): Promise<void> {
  if (inviteFriendIds.length === 0) return;

  const ready = await ensureHostPlanReadyForInvite(hostUid, planId, snapshot, fields);
  const invitePlanId = ready?.planId || planId;
  const hint: PlanInviteHint = ready?.hint ?? {
    title: fields.title,
    date: fields.date,
    time: fields.time || "",
    location: fields.location || "",
  };

  if (!invitePlanId || !hint.title || !hint.date) {
    showAlert(
      "Invites not sent",
      "Could not find your plan to invite friends. Try again from Edit plan."
    );
    return;
  }

  try {
    const { invitedIds, alreadyInvitedIds, errors } = await sendPlanInvites(
      inviteFriendIds,
      invitePlanId,
      hint
    );
    const sent = [...invitedIds, ...alreadyInvitedIds];
    if (sent.length > 0) {
      onInvited(invitePlanId, sent);
    }
    if (errors.length > 0) {
      showAlert(
        "Some invites failed",
        sent.length > 0
          ? `Your plan was ${savedWord}, but some invites could not be sent.`
          : errors[0] || `Your plan was ${savedWord}, but invites could not be sent.`
      );
    } else if (!ready && sent.length === 0) {
      showAlert(
        "Invites not sent",
        "Could not find your plan to invite friends. Try again from Edit plan."
      );
    }
  } catch {
    showAlert(
      "Invites not sent",
      `Your plan was ${savedWord}, but invites could not be sent. Try again from Edit plan.`
    );
  }
}

type ProfilePressableProps = {
  onPress: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: "button";
  disabled?: boolean;
  haptic?: boolean;
  animatePress?: boolean;
};

function ProfilePressable({
  onPress,
  onLongPress,
  children,
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityRole,
  disabled,
  haptic = true,
  animatePress = true,
}: ProfilePressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: animatePress ? scale.value : 1 }],
  }));
  return (
    <Pressable
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      onPress={() => {
        if (animatePress) {
          scale.value = withSpring(1, { damping: 16, stiffness: 380 });
        }
        if (haptic && !disabled) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              if (haptic && !disabled) {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onLongPress();
            }
          : undefined
      }
      onPressIn={() => {
        if (!disabled && animatePress) {
          scale.value = withSpring(0.96, { damping: 16, stiffness: 380 });
        }
      }}
      onPressOut={() => {
        if (animatePress) {
          scale.value = withSpring(1, { damping: 16, stiffness: 380 });
        }
      }}
      style={style}
    >
      <Animated.View style={[animatedStyle, contentStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const isFocused = useIsFocused();
  const headerLayout = useTabHeaderLayout();
  const scrollRef = useRef<ScrollView>(null);
  const shareCardRef = useRef<ViewShot>(null);
  const [sharingProfile, setSharingProfile] = useState(false);
  const profileScrollPaddingBottom = TAB_BAR_SCROLL_INSET + SPACE_6;
  const params = useLocalSearchParams<{ focusEventId?: string | string[] }>();
  const focusEventIdRaw = params.focusEventId;
  const focusEventId =
    typeof focusEventIdRaw === "string"
      ? focusEventIdRaw
      : Array.isArray(focusEventIdRaw)
        ? focusEventIdRaw[0]
        : undefined;

  const [planHighlightId, setPlanHighlightId] = useState<string | null>(null);

  const { user } = useAuthRefresh();
  const myId = user?.uid ?? "";
  const meBootstrap = useMemo(
    () => (myId ? getMeTabInitialState(myId) : null),
    [myId]
  );
  const [friendsForHostNames, setFriendsForHostNames] = useState<Friend[]>(
    () => meBootstrap?.friendsForHostNames ?? []
  );
  const [friendsDataEpoch, setFriendsDataEpoch] = useState(0);
  const [topSynqRows, setTopSynqRows] = useState<TopSynqRow[]>(
    () => meBootstrap?.topSynqRows ?? []
  );
  const [topSynqsReady, setTopSynqsReady] = useState(
    () => meBootstrap?.topSynqsReady ?? false
  );
  const [profileImage, setProfileImage] = useState<string | null>(
    () => meBootstrap?.profileImage ?? null
  );
  const [avatarRenderVersion, setAvatarRenderVersion] = useState(0);
  const [isQRExpanded, setQRExpanded] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [photoMenuVisible, setPhotoMenuVisible] = useState(false);
  const [photoPermissionPromptVisible, setPhotoPermissionPromptVisible] =
    useState(false);
  const photoPermissionRef = useRef<{
    granted: boolean;
    status: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    () => meBootstrap?.selectedInterests ?? []
  );
  const [interests, setInterests] = useState<string[]>(() => meBootstrap?.interests ?? []);
  const [city, setCity] = useState<string | null>(() => meBootstrap?.city ?? null);
  const [state, setState] = useState<string | null>(() => meBootstrap?.state ?? null);
  const [requestCount, setRequestCount] = useState(0);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  type OpenPlanEvent = {
    id: string;
    date: string;
    title: string;
    time?: string;
    location?: string;
    planHostUid?: string;
    joinedFromId?: string;
    joinedFromIds?: string[];
    joinedFromName?: string;
    joinedFromNames?: string[];
    joinedFromFriendUid?: string;
    planInvitedIds?: string[];
    attendeeDisplayNames?: Record<string, string>;
  };

  const [events, setEvents] = useState<OpenPlanEvent[]>(
    () => (meBootstrap?.events as OpenPlanEvent[] | undefined) ?? []
  );
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [pendingInterestDelete, setPendingInterestDelete] = useState<string | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const resolvedProfileImage = useMemo(() => resolveAvatar(profileImage), [profileImage]);

  const [showEventModal, setShowEventModal] = useState(false);
  const [fetchedPlanDisplayNames, setFetchedPlanDisplayNames] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!myId || events.length === 0) return;

    const known = new Set<string>();
    if (auth.currentUser?.displayName) known.add(myId);
    friendsForHostNames.forEach((f) => {
      if (f.id) known.add(f.id);
    });

    const missing = new Set<string>();
    events.forEach((event) => {
      const host = String(event.planHostUid || "").trim();
      if (host && !known.has(host)) missing.add(host);
      (Array.isArray(event.joinedFromIds) ? event.joinedFromIds : []).forEach((id) => {
        const uid = String(id || "").trim();
        if (uid && !known.has(uid)) missing.add(uid);
      });
      Object.keys(event.attendeeDisplayNames || {}).forEach((uid) => {
        const id = String(uid || "").trim();
        if (id) known.add(id);
      });
    });

    const toFetch = [...missing].filter((uid) => !fetchedPlanDisplayNames[uid]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    void (async () => {
      const fetched: Record<string, string> = {};
      await Promise.all(
        toFetch.map(async (uid) => {
          try {
            const snap = await getDoc(doc(db, "users", uid));
            if (!snap.exists()) return;
            const name = String((snap.data() as { displayName?: string })?.displayName || "").trim();
            if (name) fetched[uid] = name;
          } catch {}
        })
      );
      if (!cancelled && Object.keys(fetched).length > 0) {
        setFetchedPlanDisplayNames((prev) => ({ ...prev, ...fetched }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [myId, events, friendsForHostNames, fetchedPlanDisplayNames]);

  const dismissMeTabOverlays = useCallback(() => {
    setQRExpanded(false);
    setAvatarPreviewOpen(false);
    setShowInputModal(false);
    setPhotoMenuVisible(false);
    setShowEventModal(false);
  }, []);

  useEffect(() => {
    return registerDismissNavigationOverlaysHandler(dismissMeTabOverlays);
  }, [dismissMeTabOverlays]);

  useEffect(() => {
    const id = typeof focusEventId === "string" ? focusEventId.trim() : "";
    if (!id) return;
    setPlanHighlightId(id);
    const t = setTimeout(() => setPlanHighlightId(null), 12000);
    return () => clearTimeout(t);
  }, [focusEventId]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
  });

  const hostDisplayNameByUid = useMemo(() => {
    const m: Record<string, string> = {};
    if (myId) {
      const selfName = auth.currentUser?.displayName?.trim();
      if (selfName) m[myId] = selfName;
    }
    friendsForHostNames.forEach((f) => {
      const name = (f.displayName || "").trim();
      if (f.id && name) m[f.id] = name;
    });
    events.forEach((event) => {
      const names = event?.attendeeDisplayNames;
      if (!names || typeof names !== "object") return;
      Object.entries(names).forEach(([uid, name]) => {
        const id = String(uid || "").trim();
        const label = String(name || "").trim();
        if (id && label && !m[id]) m[id] = label;
      });
    });
    Object.entries(fetchedPlanDisplayNames).forEach(([uid, name]) => {
      const id = String(uid || "").trim();
      const label = String(name || "").trim();
      if (id && label && !m[id]) m[id] = label;
    });
    return m;
  }, [myId, friendsForHostNames, events, fetchedPlanDisplayNames]);

  const computedTopSynqRows = useMemo(
    () => computeTopSynqRows(myId, friendsForHostNames),
    [myId, friendsForHostNames, friendsDataEpoch]
  );

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const markPlanInvited = useCallback((eventId: string, friendIds: string[]) => {
    const targetId = String(eventId || "").trim();
    if (!targetId) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (String(e.id || "").trim() !== targetId) return e;
        const invited = new Set(
          (Array.isArray(e.planInvitedIds) ? e.planInvitedIds : [])
            .map((id) => String(id || "").trim())
            .filter(Boolean)
        );
        friendIds.forEach((id) => {
          const uid = String(id || "").trim();
          if (uid) invited.add(uid);
        });
        return { ...e, planInvitedIds: [...invited] };
      })
    );
  }, []);

  const unmarkPlanInvited = useCallback((eventId: string, friendId: string) => {
    const targetId = String(eventId || "").trim();
    const uid = String(friendId || "").trim();
    if (!targetId || !uid) return;
    setEvents((prev) =>
      prev.map((e) => {
        if (String(e.id || "").trim() !== targetId) return e;
        const invited = (Array.isArray(e.planInvitedIds) ? e.planInvitedIds : [])
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .filter((id) => id !== uid);
        return { ...e, planInvitedIds: invited };
      })
    );
  }, []);

  const signOut = async () => {
    try {
      await clearPushTokenOnSignOut();
      router.replace("/(auth)/welcome");
      await auth.signOut();
    } catch {
      showAlert("Sign out failed", "Please try again.");
    }
  };

  const saveEvent = async (eventOverride?: any): Promise<boolean> => {
    if (!auth.currentUser) return false;

    const eventToSave = eventOverride || newEvent;

    if (!eventToSave.title) {
      showAlert("Missing info", "Add a title");
      return false;
    }

    for (const field of [eventToSave.title, eventToSave.location]) {
      if (!field) continue;
      const check = filterOrReject(String(field));
      if (!check.ok) {
        showAlert("Content not allowed", check.reason);
        return false;
      }
    }

    const newItem = {
      id: String(eventToSave.id || Date.now().toString()),
      date: eventToSave.date,
      title: eventToSave.title,
      time: eventToSave.time || "",
      location: eventToSave.location || "",
      planHostUid: auth.currentUser.uid,
    };

    const inviteFriendIds = Array.isArray(eventToSave.inviteFriendIds)
      ? eventToSave.inviteFriendIds
          .map((id: unknown) => String(id || "").trim())
          .filter(Boolean)
      : [];

    const ref = doc(db, "users", auth.currentUser.uid);
    try {
      const snap = await getDoc(ref);
      const raw = snap.exists()
        ? (snap.data() as { events?: unknown }).events
        : undefined;
      const existing = Array.isArray(raw) ? (raw as OpenPlanEvent[]) : [];
      const updatedEvents = sortOpenPlansByDateTime([...existing, newItem]);

      await updateDoc(ref, {
        events: updatedEvents,
      });

      await sendPlanInvitesWhenReady(
        auth.currentUser.uid,
        newItem.id,
        newItem,
        inviteFriendIds,
        {
          title: newItem.title,
          date: newItem.date,
          time: newItem.time,
          location: newItem.location,
        },
        markPlanInvited,
        showAlert,
        "posted"
      );

      setShowEventModal(false);
      setNewEvent({ title: "", date: "", time: "", location: "" });
      return true;
    } catch (e) {
      showAlert("Error", "Could not save event.");
      return false;
    }
  };

  const updateEvent = async (
    id: string,
    fields: { title: string; date: string; time: string; location: string },
    options?: { inviteFriendIds?: string[]; uninviteFriendIds?: string[] }
  ): Promise<boolean> => {
    if (!auth.currentUser) return false;

    const planId = String(id || "").trim();
    const existing = events.find((e) => String(e.id || "").trim() === planId);
    if (!existing) {
      showAlert("Error", "Could not find this plan to update.");
      return false;
    }

    const myUid = auth.currentUser.uid;
    const host = String(existing.planHostUid || myUid).trim();
    if (host !== myUid) {
      showAlert("Can't edit", "You can only edit plans you created.");
      return false;
    }

    if (!fields.title.trim()) {
      showAlert("Missing info", "Add a title");
      return false;
    }

    for (const field of [fields.title, fields.location]) {
      if (!field) continue;
      const check = filterOrReject(String(field));
      if (!check.ok) {
        showAlert("Content not allowed", check.reason);
        return false;
      }
    }

    const updatedPayload = {
      title: fields.title.trim(),
      date: fields.date,
      time: fields.time || "",
      location: fields.location || "",
    };

    const oldSnapshot = {
      ...existing,
      id: planId,
      planHostUid: myUid,
    };
    const attendeeIds = new Set<string>();
    attendeeIds.add(myUid);
    if (host) attendeeIds.add(host);
    for (const raw of [
      ...((Array.isArray(existing.joinedFromIds) ? existing.joinedFromIds : []) as string[]),
      existing.joinedFromId,
    ].filter(Boolean)) {
      attendeeIds.add(String(raw).trim());
    }

    const patchOnUserCalendar = async (uid: string) => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const evs = (snap.data() as any).events || [];
      let changed = false;
      const hostIdx =
        uid === myUid
          ? findHostOpenPlanIndex(evs, planId, oldSnapshot, {
              hostUid: myUid,
              fields: updatedPayload,
            })
          : -1;
      const next = evs.map((e: any, i: number) => {
        if (uid === myUid) {
          if (i !== hostIdx) return e;
          changed = true;
          return hostPlanRowWithIdentity({ ...e, ...updatedPayload }, planId, myUid);
        }
        if (!matchesPlanEvent(e, oldSnapshot, evs)) return e;
        changed = true;
        return { ...e, ...updatedPayload };
      });
      const toWrite = uid === myUid ? sortOpenPlansByDateTime(next) : next;
      if (changed) await updateDoc(ref, { events: toWrite });
    };

    try {
      await patchOnUserCalendar(myUid);
    } catch {
      showAlert("Error", "Could not update event.");
      return false;
    }

    const otherAttendeeIds = [...attendeeIds].filter((uid) => uid !== myUid);
    await Promise.allSettled(otherAttendeeIds.map((uid) => patchOnUserCalendar(uid)));

    const inviteFriendIds = Array.isArray(options?.inviteFriendIds)
      ? options.inviteFriendIds
          .map((friendId) => String(friendId || "").trim())
          .filter(Boolean)
      : [];
    const uninviteFriendIds = Array.isArray(options?.uninviteFriendIds)
      ? options.uninviteFriendIds
          .map((friendId) => String(friendId || "").trim())
          .filter(Boolean)
      : [];

    if (uninviteFriendIds.length > 0) {
      const revokeErrors: string[] = [];
      let revokedCount = 0;
      for (const friendId of uninviteFriendIds) {
        try {
          await revokePlanInvite(friendId, planId);
          unmarkPlanInvited(planId, friendId);
          revokedCount += 1;
        } catch (err) {
          revokeErrors.push(revokePlanInviteErrorMessage(err));
        }
      }
      if (revokeErrors.length > 0) {
        showAlert(
          "Some invites not removed",
          revokedCount > 0
            ? "Your plan was saved, but some invites could not be removed."
            : revokeErrors[0] || "Your plan was saved, but invites could not be removed."
        );
      }
    }

    await sendPlanInvitesWhenReady(
      myUid,
      planId,
      oldSnapshot,
      inviteFriendIds,
      updatedPayload,
      markPlanInvited,
      showAlert
    );

    setShowEventModal(false);
    setNewEvent({ title: "", date: "", time: "", location: "" });
    return true;
  };

  const deleteEvent = async (id: string) => {
    if (!auth.currentUser) return;

    const toRemove = events.find((e) => e.id === id);
    if (!toRemove) return;

    const myUid = auth.currentUser.uid;
    const attendeeIds = new Set<string>();
    attendeeIds.add(myUid);
    const host = String((toRemove as any).planHostUid || "").trim();
    if (host) attendeeIds.add(host);
    for (const raw of [
      ...((Array.isArray((toRemove as any).joinedFromIds) ? (toRemove as any).joinedFromIds : []) as string[]),
      (toRemove as any).joinedFromId,
    ].filter(Boolean)) {
      attendeeIds.add(String(raw).trim());
    }

    const removeFromUserCalendar = async (uid: string) => {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return false;
      const evs = (snap.data() as any).events || [];
      const next = evs.filter((e: any) => !matchesPlanEvent(e, toRemove, evs));
      if (next.length === evs.length) return true;
      await updateDoc(ref, { events: next });
      return true;
    };

    try {
      await removeFromUserCalendar(myUid);
    } catch (e) {
      showAlert("Error", "Could not delete event.");
      return;
    }

    const otherAttendeeIds = [...attendeeIds].filter((uid) => uid !== myUid);
    await Promise.allSettled(
      otherAttendeeIds.map((uid) => removeFromUserCalendar(uid))
    );
  };

  useEffect(() => {
    if (!myId) return;

    const userDocRef = doc(db, "users", myId);

    const unsubscribeProfile = subscribeUserDocMultiplexed(myId, (userData) => {
      if (!userData) return;
      const nextCity = userData.city || null;
      const stateAbbr =
        stateAbbreviations[userData.state] || userData.state || null;
      const rawEvents = (userData.events || []) as OpenPlanEvent[];
      const prunedEvents = filterOutPastOpenPlans(rawEvents);
      if (prunedEvents.length < rawEvents.length) {
        updateDoc(userDocRef, { events: prunedEvents }).catch(() => {});
      }
      const nextInterests = userData.interests || [];
      const nextImage = userData?.imageurl || null;
      const nextInviteCode = String(userData.inviteCode || "")
        .trim()
        .toUpperCase();
      if (nextInviteCode) {
        setInviteCode(nextInviteCode);
      }

      const prevOwn = getCachedOwnProfile(myId);
      setCachedOwnProfile(myId, {
        imageurl: nextImage,
        interests: nextInterests,
        events: prunedEvents,
        city: nextCity,
        state: stateAbbr,
        topSynqs: prevOwn?.topSynqs ?? [],
      });

      setCity(nextCity);
      setState(stateAbbr);
      setEvents(prunedEvents);
      setInterests(nextInterests);
      setSelectedInterests(nextInterests);
      setProfileImage(nextImage);
      prefetchResolvedAvatar(nextImage);
    });

    const reqRef = query(
      collection(db, "users", myId, "friendRequests"),
      limit(FRIEND_REQUESTS_LISTENER_LIMIT)
    );
    const notifRef = query(
      collection(db, "users", myId, "notifications"),
      orderBy("createdAt", "desc"),
      limit(NOTIFICATIONS_LISTENER_LIMIT)
    );
    const unsubscribeRequests = onSnapshot(
      reqRef,
      (snap) => {
        setRequestCount(snap.docs.length);
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          const senderId = data.from || data.fromId || d.id;
          const inline =
            data.senderImageUrl || data.fromImageUrl || data.fromImageurl || data.imageurl;
          prefetchResolvedAvatar(inline);
          const hasHttp =
            typeof inline === "string" && inline.trim().startsWith("http");
          if (!hasHttp && senderId) {
            getDoc(doc(db, "users", senderId))
              .then((u) => {
                if (u.exists()) prefetchResolvedAvatar((u.data() as any)?.imageurl);
              })
              .catch(() => {});
          }
        });
      },
      ignoreSnapshotPermissionDenied
    );

    const unsubscribeNotifications = onSnapshot(
      notifRef,
      (snap) => {
        const unread = snap.docs.filter((d) => d.data()?.read !== true).length;
        setUnreadActivityCount(unread);
      },
      ignoreSnapshotPermissionDenied
    );

    const unsubscribeFriends = subscribeFriendsIdsMultiplexed(myId, async (friendIdList) => {
        const friendIds = new Set(friendIdList);
        pruneSocialCachesToFriendIds(myId, friendIds);

        const cachedList = friendsListCacheByUser[myId] ?? [];
        const friendsCacheMatches =
          cachedList.length > 0 &&
          cachedList.length === friendIds.size &&
          cachedList.every((f) => friendIds.has(f.id));

        if (friendsCacheMatches) {
          setFriendsForHostNames((prev) =>
            prev.length === cachedList.length &&
            prev.every((f, i) => f.id === cachedList[i]?.id)
              ? prev
              : cachedList
          );
          setFriendsDataEpoch((n) => n + 1);
          setTopSynqsReady(true);
          return;
        }

        try {
          await warmFriendsAndConnectionsCache(myId);
          const nextFriends = friendsListCacheByUser[myId] ?? [];
          setFriendsForHostNames((prev) =>
            prev.length === nextFriends.length &&
            prev.every((f, i) => f.id === nextFriends[i]?.id)
              ? prev
              : nextFriends
          );
          setFriendsDataEpoch((n) => n + 1);
        } catch (e) {
          console.error("[ProfileScreen] warmFriendsAndConnectionsCache:", e);
        } finally {
          setTopSynqsReady(true);
        }
    });

    return () => {
      unsubscribeProfile();
      unsubscribeRequests();
      unsubscribeNotifications();
      unsubscribeFriends();
    };
  }, [myId]);

  const prunePastEventsToFirestore = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setEvents((prev) => {
      const pruned = filterOutPastOpenPlans(prev);
      if (pruned.length === prev.length) return prev;
      updateDoc(doc(db, "users", uid), { events: pruned }).catch(() => {});
      return pruned;
    });
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    prunePastEventsToFirestore();
    const id = setInterval(() => prunePastEventsToFirestore(), 60_000);
    return () => clearInterval(id);
  }, [isFocused, prunePastEventsToFirestore]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === "active") prunePastEventsToFirestore();
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => sub.remove();
  }, [prunePastEventsToFirestore]);

  const reconcileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const myUid = auth.currentUser.uid;
    if (reconcileDebounceRef.current) clearTimeout(reconcileDebounceRef.current);
    reconcileDebounceRef.current = setTimeout(() => {
      reconcileHostOpenPlansFromFriends(myUid).catch(() => {});
    }, 3000);
    return () => {
      if (reconcileDebounceRef.current) clearTimeout(reconcileDebounceRef.current);
    };
  }, [events]);

  const handleDeleteInterest = (interestName: string) => {
    setPendingInterestDelete(interestName);
  };

  const openPhotoMenu = useCallback(async () => {
    const permission = await getPhotoLibraryPermission();
    photoPermissionRef.current = {
      granted: photoLibraryAccessGranted(permission),
      status: permission.status,
    };
    setPhotoMenuVisible(true);
  }, []);

  const navigateToCropWithPhoto = (pickedUri: string) => {
    setPendingProfilePhotoSource(pickedUri);
    router.push("/profile-photo-crop");
  };

  const openPhotoPickerAfterAccess = async () => {
    const result = await launchProfilePhotoPicker();
    if (result.ok) {
      navigateToCropWithPhoto(result.uri);
      return;
    }
    if (result.reason === "denied") {
      showAlert(
        "Photo access needed",
        "Allow photo library access in Settings to update your profile picture."
      );
    }
  };

  const handleUploadPhoto = async () => {
    const cached = photoPermissionRef.current;
    if (!cached?.granted) {
      setPhotoMenuVisible(false);
      if (cached?.status === "undetermined") {
        setPhotoPermissionPromptVisible(true);
        return;
      }
      setIsPickingImage(true);
      try {
        const granted = await requestPhotoLibraryAccess();
        photoPermissionRef.current = {
          granted,
          status: granted ? "granted" : "denied",
        };
        if (!granted) {
          showAlert(
            "Photo access needed",
            "Allow photo library access in Settings to update your profile picture."
          );
          return;
        }
        const result = await launchProfilePhotoPicker();
        if (result.ok) {
          navigateToCropWithPhoto(result.uri);
        } else if (result.reason === "denied") {
          showAlert(
            "Photo access needed",
            "Allow photo library access in Settings to update your profile picture."
          );
        }
      } catch {
        showAlert("Error", "Could not open your photo library.");
      } finally {
        setAvatarRenderVersion((prev) => prev + 1);
        setIsPickingImage(false);
      }
      return;
    }

    setIsPickingImage(true);
    try {
      const result = await launchProfilePhotoPicker();
      setPhotoMenuVisible(false);

      if (result.ok) {
        navigateToCropWithPhoto(result.uri);
        return;
      }
      if (result.reason === "denied") {
        showAlert(
          "Photo access needed",
          "Allow photo library access in Settings to update your profile picture."
        );
      }
    } catch {
      setPhotoMenuVisible(false);
      showAlert("Error", "Could not open your photo library.");
    } finally {
      setAvatarRenderVersion((prev) => prev + 1);
      setIsPickingImage(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoMenuVisible(false);
    if (!auth.currentUser) return;

    setIsUploading(true);
    try {
      await removeProfilePhoto();
      setProfileImage(null);
      setAvatarRenderVersion((prev) => prev + 1);
    } catch {
      showAlert("Error", "Could not remove profile photo.");
    } finally {
      setIsUploading(false);
    }
  };

  const saveInterests = async () => {
    if (!auth.currentUser || !interestsDirty) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        interests: selectedInterests,
      });
      setInterests([...selectedInterests]);
      setShowInputModal(false);
    } catch (e) {
      showAlert("Error", "Could not save interests.");
    }
  };

  const interestsDirty = useMemo(() => {
    if (selectedInterests.length !== interests.length) return true;
    const saved = new Set(interests);
    return selectedInterests.some((interest) => !saved.has(interest));
  }, [interests, selectedInterests]);

  const openInterestsModal = useCallback(() => {
    setSelectedInterests([...interests]);
    setShowInputModal(true);
  }, [interests]);

  const profileQrUrl = useMemo(() => {
    if (!inviteCode) return "";
    return buildProfileShareWebUrl(inviteCode);
  }, [inviteCode]);
  const inviteShareUrl = useMemo(() => {
    if (!inviteCode) return "";
    return `synq://invite/${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  const fetchInviteCode = useCallback(async (): Promise<string> => {
    if (inviteCode) return inviteCode;
    const uid = auth.currentUser?.uid;
    if (uid) {
      const userSnap = await getDoc(doc(db, "users", uid));
      const existing = String(userSnap.data()?.inviteCode || "")
        .trim()
        .toUpperCase();
      if (existing) {
        setInviteCode(existing);
        return existing;
      }
    }
    const functions = getFunctions(undefined, "us-central1");
    const getOrCreateInviteCode = httpsCallable(functions, "getOrCreateInviteCode");
    const result = await getOrCreateInviteCode({});
    const code = String((result.data as any)?.inviteCode || "")
      .trim()
      .toUpperCase();
    if (!code) {
      throw new Error("Could not create invite code.");
    }
    setInviteCode(code);
    return code;
  }, [inviteCode]);

  useEffect(() => {
    if (!auth.currentUser?.uid) {
      setInviteCode("");
      return;
    }
    let cancelled = false;
    const ensureInviteCode = async () => {
      try {
        const code = await fetchInviteCode();
        if (!cancelled && code) setInviteCode(code);
      } catch {}
    };
    void ensureInviteCode();
    return () => {
      cancelled = true;
    };
  }, [auth.currentUser?.uid, fetchInviteCode]);

  const shareProfile = async () => {
    if (sharingProfile) return;
    setSharingProfile(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const code = await fetchInviteCode();
      const shareUrl = buildProfileShareWebUrl(code);
      if (!shareUrl) {
        showAlert(
          "Share unavailable",
          "We couldn't generate your profile link yet. Please try again in a moment."
        );
        return;
      }
      const uid = auth.currentUser?.uid;
      if (!uid) {
        showAlert("Share unavailable", "Please sign in and try again.");
        return;
      }
      await captureAndShareProfileCard(shareCardRef, shareUrl);
    } catch {
      try {
        const code = await fetchInviteCode();
        const shareUrl = buildProfileShareWebUrl(code);
        if (shareUrl) {
          await shareProfileLink(shareUrl);
        }
      } catch {
        // User dismissed the share sheet.
      }
    } finally {
      setSharingProfile(false);
    }
  };

  const locationLower =
    city && state ? `${city}, ${state}` : null;

  const profileNameParts = useMemo(() => {
    const raw = auth.currentUser?.displayName?.trim() || "";
    if (!raw) return { first: "Your", last: "profile" };
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }, [auth.currentUser?.displayName]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    void hydrateOwnProfileFromDisk(myId).then(() => {
      if (cancelled) return;
      const next = getMeTabInitialState(myId);
      setProfileImage((prev) => prev ?? next.profileImage);
      setInterests((prev) => (prev.length > 0 ? prev : next.interests));
      setSelectedInterests((prev) => (prev.length > 0 ? prev : next.selectedInterests));
      setCity((prev) => prev ?? next.city);
      setState((prev) => prev ?? next.state);
      setEvents((prev) => (prev.length > 0 ? prev : (next.events as OpenPlanEvent[])));
      setFriendsForHostNames((prev) =>
        prev.length > 0 ? prev : next.friendsForHostNames
      );
      setTopSynqRows((prev) =>
        prev.length > 0 ? prev : next.topSynqRows
      );
      if (next.topSynqsReady) {
        setTopSynqsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  useEffect(() => {
    if (computedTopSynqRows.length > 0) {
      setTopSynqRows((prev) => {
        if (topSynqRowsEqual(computedTopSynqRows, prev)) return prev;
        if (myId) {
          mergeCachedOwnProfile(myId, {
            topSynqs: topSynqRowsToCache(computedTopSynqRows),
          });
        }
        return computedTopSynqRows;
      });
      return;
    }
    if (!topSynqsReady) return;
    setTopSynqRows((prev) => {
      if (prev.length === 0) return prev;
      if (myId) {
        mergeCachedOwnProfile(myId, { topSynqs: [] });
      }
      return [];
    });
  }, [computedTopSynqRows, topSynqsReady, myId]);

  useEffect(() => {
    if (isFocused) return;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [isFocused]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerLayout.contentPaddingTop - 20,
            paddingBottom: profileScrollPaddingBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ right: 0 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={styles.heroOuter}>
          <View style={styles.heroGradient}>
          <View style={styles.profileSection}>
            <View style={styles.qrContainer}>
              <View style={styles.qrBg}>
                {profileQrUrl ? (
                  <QRCode
                    value={profileQrUrl}
                    size={160}
                    color="black"
                    backgroundColor="white"
                  />
                ) : (
                  <View style={{ width: 160, height: 160, backgroundColor: BORDER_MUTED }} />
                )}
              </View>

              <View style={styles.avatarGlowWrap}>
                <ProfilePressable
                  onPress={() => void openPhotoMenu()}
                  onLongPress={() => setAvatarPreviewOpen(true)}
                  disabled={isUploading || isPickingImage}
                  contentStyle={styles.imageWrapper}
                  accessibilityLabel="Profile photo. Tap to change, hold to expand."
                  animatePress={false}
                >
                  <ExpoImage
                    key={`${resolvedProfileImage}-${avatarRenderVersion}`}
                    source={{ uri: resolvedProfileImage }}
                    style={styles.profileImg}
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    recyclingKey={`${resolvedProfileImage}-${avatarRenderVersion}`}
                    transition={0}
                  />
                </ProfilePressable>
              </View>

              <ProfilePressable
                style={styles.qrToggle}
                contentStyle={styles.qrToggleInner}
                onPress={() => setQRExpanded(true)}
                accessibilityLabel="Expand QR code"
              >
                <Ionicons name="qr-code-outline" size={13} color={ON_ACCENT_TEXT} />
              </ProfilePressable>
            </View>

            <Text style={styles.nameAccent} numberOfLines={2}>
              {profileNameParts.first}
              {profileNameParts.last.length > 0 ? ` ${profileNameParts.last}` : ""}
            </Text>

            {locationLower ? (
              <View style={styles.locationRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={MUTED2}
                  style={styles.locationIcon}
                />
                <Text style={styles.locationText} numberOfLines={1}>
                  {locationLower}
                </Text>
              </View>
            ) : null}

            <View style={styles.profileActionsRow}>
              <ProfilePressable
                contentStyle={styles.editProfileBtn}
                onPress={() => router.push("/edit-profile")}
                accessibilityLabel="Edit profile"
              >
                <Ionicons name="create-outline" size={14} color={MUTED2} />
                <Text style={styles.editProfileBtnText}>Edit profile</Text>
              </ProfilePressable>
              <ProfilePressable
                contentStyle={styles.editProfileBtn}
                onPress={shareProfile}
                disabled={sharingProfile}
                accessibilityLabel="Share profile"
              >
                <Ionicons name="share-social-outline" size={14} color={MUTED2} />
                <Text style={styles.editProfileBtnText}>
                  {sharingProfile ? "Preparing…" : "Share profile"}
                </Text>
              </ProfilePressable>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionAfterHero}>
        <Text style={styles.sectionTitle}>Top Synqs</Text>
        {topSynqRows.length > 0 ? (
          <View style={styles.synqsContainer}>
            {topSynqRows.map(({ friend }) => {
              const firstName =
                String(friend.displayName || "Friend")
                  .trim()
                  .split(/\s+/)[0] || "Friend";
              return (
                <View key={friend.id} style={styles.connItem}>
                  <ProfilePressable
                    style={styles.connAvatarPress}
                    contentStyle={styles.connAvatarPressInner}
                    onPress={() =>
                      router.push({
                        pathname: "/friend-profile",
                        params: { friendId: friend.id },
                      })
                    }
                    accessibilityLabel={`${firstName}, top messaging friend`}
                  >
                    <View style={styles.imageCircle}>
                      <ExpoImage
                        source={{ uri: resolveAvatar(friend.imageurl) }}
                        style={styles.connImg}
                        cachePolicy="memory-disk"
                        transition={0}
                        recyclingKey={friend.id}
                      />
                    </View>
                  </ProfilePressable>
                  <Text style={styles.connName} numberOfLines={1}>
                    {firstName}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : topSynqsReady ? (
          <Text style={styles.profileHelperText}>
            {friendsForHostNames.length === 0
              ? "Add friends to see your top Synqs here."
              : "Message friends to see your top Synqs here."}
          </Text>
        ) : (
          <ActivityIndicator color={ACCENT} style={styles.topSynqsLoading} />
        )}
      </View>

      <View style={styles.section}>
        <MonthlyMemo
          ACCENT={ACCENT}
          setShowEventModal={setShowEventModal}
          showEventModal={showEventModal}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          saveEvent={saveEvent}
          updateEvent={updateEvent}
          events={events}
          deleteEvent={deleteEvent}
          viewerUid={myId}
          hostDisplayNameByUid={hostDisplayNameByUid}
          highlightEventId={planHighlightId}
          friends={friendsForHostNames}
          onPlanUninvited={unmarkPlanInvited}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        {interests.length === 0 ? (
          <>
            <Text style={styles.profileHelperText}>
              Add a few interests so friends know what you are into.
            </Text>
            <SynqPlusAddButton
              onPress={openInterestsModal}
              accessibilityLabel="Add interests"
              style={styles.interestsAddPlanBtnSpacing}
            />
          </>
        ) : (
          <>
            <View style={styles.interestsWrapper}>
              {interests.map((interest, i) => (
                <ProfilePressable
                  key={i}
                  style={styles.interestRectOuter}
                  contentStyle={styles.interestRect}
                  onPress={() => handleDeleteInterest(interest)}
                  accessibilityLabel={`Interest ${interest}, tap to remove`}
                >
                  <Text style={styles.interestText}>{interest}</Text>
                </ProfilePressable>
              ))}
            </View>
            <SynqPlusAddButton
              onPress={openInterestsModal}
              accessibilityLabel="Add more interests"
              style={styles.interestsAddBelow}
            />
          </>
        )}
      </View>

      <View style={[styles.section, styles.signOutSection]}>
        <TouchableOpacity
          onPress={() => setShowSignOutModal(true)}
          style={styles.signOutBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutBtnText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      </ScrollView>

      <Modal visible={isQRExpanded} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setQRExpanded(false)}
            accessibilityRole="button"
            accessibilityLabel="Close QR code"
          />
          <View style={styles.qrModalBox} pointerEvents="box-none">
            {profileQrUrl ? (
              <QRCode value={profileQrUrl} size={260} color="black" backgroundColor="white" />
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={avatarPreviewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarPreviewOpen(false)}
      >
        <Pressable
          style={styles.avatarPreviewOverlay}
          onPress={() => setAvatarPreviewOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile photo preview"
        >
          <View style={styles.avatarPreviewDim} pointerEvents="none" />
          <ExpoImage
            source={{ uri: resolvedProfileImage }}
            style={styles.avatarPreviewImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            recyclingKey={`${resolvedProfileImage}-${avatarRenderVersion}`}
          />
        </Pressable>
      </Modal>

      <Modal
        visible={showInputModal}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.interestModalFullscreen} edges={["top", "left", "right", "bottom"]}>
            <StatusBar barStyle="light-content" />
            <View style={styles.interestSheet}>
              <View style={styles.interestHeader}>
                <Text style={styles.interestTitle}>What are you into?</Text>
                <CloseButton
                  onPress={() => {
                    setSelectedInterests([...interests]);
                    setShowInputModal(false);
                  }}
                  accessibilityLabel="Close interests"
                />
              </View>
              <Text style={styles.interestSubtitle}>
                Pick a few things you enjoy doing with friends.
              </Text>

            <View style={styles.interestPillsSection}>
              <ScrollView
                style={styles.interestPillsScroll}
                contentContainerStyle={styles.interestPillsWrap}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
              >
                {allActivities.map((item) => {
                  const active = selectedInterests.includes(item.name);
                  return (
                    <TouchableOpacity
                      key={item.name}
                      onPress={() =>
                        setSelectedInterests((prev) =>
                          active ? prev.filter((i) => i !== item.name) : [...prev, item.name]
                        )
                      }
                      activeOpacity={0.85}
                      style={[styles.interestPill, active && styles.interestPillOn]}
                    >
                      <Text style={[styles.interestPillText, active && styles.interestPillTextOn]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity
              onPress={saveInterests}
              disabled={!interestsDirty}
              style={[
                styles.interestSaveBtn,
                !interestsDirty && styles.interestSaveBtnDisabled,
              ]}
              activeOpacity={interestsDirty ? 0.85 : 1}
              accessibilityRole="button"
              accessibilityLabel="Save interests"
              accessibilityState={{ disabled: !interestsDirty }}
            >
              <Text style={styles.interestSaveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
      <AlertModal
        visible={photoPermissionPromptVisible}
        title="Photo library access"
        message="Synq needs access to your photo library so you can choose a profile photo."
        buttonText="Continue"
        onClose={() => {
          setPhotoPermissionPromptVisible(false);
          void (async () => {
            setIsPickingImage(true);
            try {
              const granted = await requestPhotoLibraryAccess();
              photoPermissionRef.current = {
                granted,
                status: granted ? "granted" : "denied",
              };
              if (!granted) {
                showAlert(
                  "Photo access needed",
                  "Allow photo library access in Settings to update your profile picture."
                );
                return;
              }
              await openPhotoPickerAfterAccess();
            } catch {
              showAlert("Error", "Could not open your photo library.");
            } finally {
              setAvatarRenderVersion((prev) => prev + 1);
              setIsPickingImage(false);
            }
          })();
        }}
      />
      <AlertModal
  visible={alertVisible}
  title={alertTitle}
  message={alertMessage}
  onClose={() => setAlertVisible(false)}
/>
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign out?"
        message="You can sign back in anytime."
        confirmText="Sign out"
        destructive
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={async () => {
          setShowSignOutModal(false);
          await signOut();
        }}
      />

      <ConfirmModal
        visible={!!pendingInterestDelete}
        title="Remove Interest"
        message={
          pendingInterestDelete
            ? `Remove "${pendingInterestDelete}"?`
            : "Remove this interest?"
        }
        confirmText="Delete"
        destructive
        onCancel={() => setPendingInterestDelete(null)}
        onConfirm={async () => {
          if (!pendingInterestDelete || !auth.currentUser) return;
          const updatedInterests = interests.filter((i) => i !== pendingInterestDelete);
          try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
              interests: updatedInterests,
            });
            setPendingInterestDelete(null);
          } catch {
            showAlert("Error", "Could not remove interest. Please try again.");
            setPendingInterestDelete(null);
          }
        }}
      />

      <ProfileTabHeaderOverlay>
        <HeaderIconButton
          name="notifications-outline"
          onPress={() => router.push("/notifications")}
          accessibilityLabel="Notifications"
          badge={
            requestCount + unreadActivityCount > 0 ? (
              <NotificationBadge
                variant="count"
                count={requestCount + unreadActivityCount}
              />
            ) : undefined
          }
        />
        <HeaderIconButton
          name="settings-outline"
          onPress={() => router.push("/settings")}
          accessibilityLabel="Settings"
        />
      </ProfileTabHeaderOverlay>

      <ProfilePhotoActionSheet
        visible={photoMenuVisible}
        showRemove={Boolean(profileImage)}
        onClose={() => setPhotoMenuVisible(false)}
        onUpload={handleUploadPhoto}
        onRemove={handleRemovePhoto}
      />

      {auth.currentUser?.uid ? (
        <View
          pointerEvents="none"
          style={styles.shareCardCaptureHost}
          collapsable={false}
        >
          <ViewShot
            ref={shareCardRef}
            options={{ format: "png", quality: 1, result: "tmpfile" }}
          >
            <ProfileShareCard
              displayName={auth.currentUser?.displayName || ""}
              avatarUri={resolvedProfileImage}
              location={locationLower}
            />
          </ViewShot>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Full-width scroll (no gutter scrollbar); sections pad themselves. */
  screen: { flex: 1, backgroundColor: BG, position: "relative" },
  shareCardCaptureHost: {
    position: "absolute",
    top: 0,
    left: -5000,
    opacity: 1,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroOuter: { marginTop: 0 },
  heroGradient: {
    backgroundColor: BG,
    paddingBottom: 8,
    position: "relative",
  },
  topSynqsLoading: { alignSelf: "center", marginVertical: 16 },
  profileSection: { alignItems: "center", marginTop: 0, overflow: "visible" },
  qrContainer: {
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  qrBg: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 180,
    height: 180,
    opacity: 0.4,
    backgroundColor: "white",
    borderRadius: 25,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 0,
  },
  avatarGlowWrap: {
    borderRadius: 84,
    zIndex: 2,
    elevation: 8,
  },
  imageWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: SURFACE_WELL,
    justifyContent: "center",
    alignItems: "center",
  },
  profileImg: { width: "100%", height: "100%" },
  avatarPreviewOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 24,
  },
  avatarPreviewDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.88)",
  },
  avatarPreviewImage: {
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 2,
    borderColor: MUTED3,
  },
  qrToggle: { position: "absolute", bottom: 10, right: 10, backgroundColor: ACCENT, padding: 10, borderRadius: 25, zIndex: 2 },
  qrToggleInner: { alignItems: "center", justifyContent: "center" },
  nameAccent: {
    ...profileNameText,
    color: ACCENT,
    letterSpacing: 0.2,
    marginTop: 14,
    textAlign: "center",
    maxWidth: "92%",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    maxWidth: "88%",
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    ...profileLocationText,
    color: MUTED,
    flexShrink: 1,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  profileActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  editProfileBtnText: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    letterSpacing: 0.1,
  },
  synqsContainer: { flexDirection: "row", justifyContent: "flex-start", gap: 14 },
  connItem: { alignItems: "center", width: 72 },
  connAvatarPress: { alignItems: "center" },
  connAvatarPressInner: { borderRadius: 50, overflow: "hidden" },
  imageCircle: {
    width: 55,
    height: 55,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: SURFACE,
  },
  connImg: { width: 55, height: 55, borderRadius: 50 },
  connName: {
    ...profileInterestPillText,
    marginTop: 8,
    textAlign: "center",
  },
  profileHelperText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    lineHeight: 19,
    fontFamily: fonts.book,
    textAlign: "left",
  },
  sectionAfterHero: {
    marginTop: 4,
    paddingTop: 6,
  },
  section: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  sectionTitle: profileScreenSectionTitle,
  interestsAddPlanBtnSpacing: { marginTop: 16 },
  interestsAddBelow: { marginTop: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  interestsWrapper: { flexDirection: "row", flexWrap: "wrap" },
  interestRectOuter: { marginRight: 8, marginBottom: 8 },
  interestRect: {
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interestText: profileInterestPillText,
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  qrModalBox: { backgroundColor: "white", padding: 25, borderRadius: MODAL_RADIUS + 18 },
  interestModalFullscreen: {
    flex: 1,
    backgroundColor: BG,
  },
  interestSheet: {
    flex: 1,
    backgroundColor: BG,
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  interestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 34,
    paddingTop: 40,
    marginBottom: 10,
  },
  interestTitle: {
    ...tabScreenMainHeaderTitle,
    flex: 1,
    lineHeight: 32,
    includeFontPadding: false,
    marginRight: 12,
  },
  interestSubtitle: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    lineHeight: 19,
    fontFamily: fonts.book,
    marginBottom: 16,
  },
  interestPillsSection: {
    flex: 1,
    marginBottom: 8,
    minHeight: 0,
  },
  interestPillsScroll: {
    flex: 1,
  },
  interestPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingBottom: 6,
  },
  interestPill: {
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  interestPillOn: {
    backgroundColor: "rgba(0,255,133,0.12)",
    borderColor: "rgba(0,255,133,0.55)",
  },
  interestPillText: profileInterestPillText,
  interestPillTextOn: profileInterestPillTextActive,
  interestSaveBtn: {
    marginTop: 20,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
  },
  interestSaveBtnDisabled: {
    opacity: 0.45,
  },
  interestSaveBtnText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  signOutSection: {
    paddingBottom: 20,
  },
  signOutBtn: {
    marginTop: 4,
    alignSelf: "center",
    paddingVertical: 11,
    paddingHorizontal: 32,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  signOutBtnText: {
    color: MUTED,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
});
