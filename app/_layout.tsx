import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import {
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, signOut, updateProfile, User } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import {
  activityNotificationId,
  dismissActivityNotification,
} from "@/src/lib/activityNotifications";
import { requestDismissNavigationOverlays } from "@/src/lib/navigationOverlayEvents";
import { setPendingChatOpen } from "@/src/lib/pendingChatOpen";
import { parsePushNotificationTap } from "@/src/lib/pushNotificationTapCore";
import {
  parseProfileShareCodeFromUrl,
  resolveProfileShareCodeToFriendId,
} from "@/src/lib/profileShareUrl";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  DeviceEventEmitter,
  Image,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "../components/ErrorBoundary";
import LocationUpdateModal from "../components/LocationUpdateModal";
import RequiredUpdateBlocker from "../components/RequiredUpdateBlocker";
import { ACCENT, BG } from "../constants/Variables";
import { BlockedUsersProvider } from "../src/lib/blockedUsers";
import {
  getPreAuthTermsAccepted,
  persistCommunityTermsAcceptance,
  userHasAcceptedCommunityTerms,
} from "../src/lib/communityTerms";
import { auth, db } from "../src/lib/firebase";
import { checkAppUpdateRequired } from "../src/lib/appUpdateGate";
import { LOCATION_PROMPT_CHECK_REQUEST } from "../src/lib/locationPromptEvents";
import {
  hydrateOwnProfileFromDisk,
  prewarmMeTabScreen,
} from "../src/lib/ownProfileCache";
import { initSentry } from "../src/lib/sentryInit";
import { initAnalytics } from "../src/lib/analytics";
import {
  hydrateSocialCachesFromDisk,
  warmSocialCachesInBackground,
} from "../src/lib/socialCache";
import { SynqBootProvider } from "../src/lib/synqBootContext";
import {
  computeSynqActiveFromUserData,
  getCachedSynqActiveSync,
  hydrateSynqStatusFromDisk,
  readCachedSynqActive,
  writeCachedSynqActive,
} from "../src/lib/synqSession";
import {
  displayNameFromUserDoc,
  profileGateFromCache,
  userHasDisplayName,
  userHasLocation,
} from "../src/lib/userProfile";

initSentry();
void initAnalytics();

void SplashScreen.preventAutoHideAsync();

/** Must match app.json expo.splash.backgroundColor (BG) */
const SPLASH_LOGO = require("../assets/logo.png");

/** Never block touches longer than this (App Store / slow Firestore). */
const BOOT_SPLASH_MAX_MS = 6000;
const PROFILE_GATE_TIMEOUT_MS = 12000;

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    let token: string | null = null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: ACCENT,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return null;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
    }

    return token;
  } catch (e) {
    if (__DEV__) {
      console.warn("[push] Push token registration skipped:", e);
    }
    return null;
  }
}

const AuthContext = createContext({
  refreshAuth: () => {},
  user: null as User | null,
  markCommunityTermsOk: () => {},
});
export const useAuthRefresh = () => useContext(AuthContext);
const PENDING_INVITE_FROM_UID_KEY = "synq:pendingInviteFromUid";
const PENDING_INVITE_CODE_KEY = "synq:pendingInviteCode";
const PENDING_FRIEND_PROFILE_ID_KEY = "synq:pendingFriendProfileId";
const PENDING_PROFILE_SHARE_CODE_KEY = "synq:pendingProfileShareCode";

function cleanUid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v : null;
}

function parseFriendProfileIdFromUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const path = String(parsed.path || "").trim().replace(/^\//, "");
    const hostname = String(parsed.hostname || "").trim();
    const isFriendProfile =
      hostname === "friend-profile" || path === "friend-profile";
    const isOpenPage = path === "open" || path.endsWith("/open");
    if (!isFriendProfile && !isOpenPage) return null;
    const friendIdRaw = parsed.queryParams?.friendId;
    return cleanUid(Array.isArray(friendIdRaw) ? friendIdRaw[0] : friendIdRaw);
  } catch {
    return null;
  }
}

function snoozedUntilMsFromField(raw: unknown): number {
  if (typeof raw === "string") return Date.parse(raw);
  if (
    raw &&
    typeof raw === "object" &&
    typeof (raw as { toMillis?: unknown }).toMillis === "function"
  ) {
    return (raw as { toMillis: () => number }).toMillis();
  }
  return Number.NaN;
}

export default function RootLayout() {
  const segments = useSegments();
  const router = useRouter();

  const navState = useRootNavigationState();
  const navReady = !!navState?.key;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);
  const [bootSplashDismissed, setBootSplashDismissed] = useState(false);
  const nativeSplashHiddenRef = useRef(false);
  const [synqBoot, setSynqBoot] = useState<{
    cachedSynqActive: boolean;
  } | null>(null);
  const synqBootUidRef = useRef<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [updateRequired, setUpdateRequired] = useState<{
    checked: boolean;
    required: boolean;
    storeUrl: string | null;
  }>({ checked: false, required: false, storeUrl: null });
  const [communityTermsOk, setCommunityTermsOk] = useState<boolean | null>(null);
  const communityTermsOkRef = useRef<boolean | null>(null);
  const [userProfileGate, setUserProfileGate] = useState<{
    hasDisplayName: boolean;
    hasLocation: boolean;
  } | null>(null);
  const inviteProcessingRef = useRef(false);
  const inviteAttemptsRef = useRef<Set<string>>(new Set());

  const [pendingNotificationTap, setPendingNotificationTap] = useState<
    | { kind: "chat"; chatId: string; messageId?: string }
    | { kind: "notifications" }
    | { kind: "friend_profile"; friendId: string }
    | { kind: "community_group"; groupId: string; planId?: string }
    | {
        kind: "synq_home";
        fromUserId?: string;
        notificationType?: "friend_synq_active" | "synq_nudge";
      }
    | { kind: "me"; focusEventId?: string; notificationId?: string }
    | null
  >(null);

  const refreshAuth = () => {
    setUser(auth.currentUser ? ({ ...auth.currentUser } as User) : null);
  };

  const setCommunityTermsGate = useCallback(
    (value: boolean | null | ((prev: boolean | null) => boolean | null)) => {
      setCommunityTermsOk((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        communityTermsOkRef.current = next;
        return next;
      });
    },
    []
  );

  const markCommunityTermsOk = useCallback(() => {
    setCommunityTermsGate(true);
  }, [setCommunityTermsGate]);

  useEffect(() => {
    let cancelled = false;
    void checkAppUpdateRequired().then((result) => {
      if (cancelled) return;
      setUpdateRequired({
        checked: true,
        required: result.required,
        storeUrl: result.storeUrl,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const captureDeepLinkFromUrl = async (url: string | null) => {
      if (!url) return;
      try {
        const shareCode = parseProfileShareCodeFromUrl(url);
        if (shareCode) {
          requestDismissNavigationOverlays();
          await AsyncStorage.setItem(PENDING_PROFILE_SHARE_CODE_KEY, shareCode);
          return;
        }

        const friendId = parseFriendProfileIdFromUrl(url);
        if (friendId) {
          requestDismissNavigationOverlays();
          await AsyncStorage.setItem(PENDING_FRIEND_PROFILE_ID_KEY, friendId);
          return;
        }

        const parsed = Linking.parse(url);
        const path = String(parsed.path || "").trim();
        const fromRaw = parsed.queryParams?.from ?? parsed.queryParams?.inviteFrom;
        const fromUid = cleanUid(Array.isArray(fromRaw) ? fromRaw[0] : fromRaw);
        if (fromUid) {
          await AsyncStorage.setItem(PENDING_INVITE_FROM_UID_KEY, fromUid);
          return;
        }
        const invitePathMatch = path.match(/^(?:invite|i)\/([^/?#]+)/i);
        const inviteCode = cleanUid(
          invitePathMatch ? decodeURIComponent(invitePathMatch[1] || "") : null
        );
        if (inviteCode) {
          await AsyncStorage.setItem(PENDING_INVITE_CODE_KEY, inviteCode);
        }
      } catch {}
    };

    void Linking.getInitialURL().then(captureDeepLinkFromUrl);
    const sub = Linking.addEventListener("url", ({ url }) => {
      void captureDeepLinkFromUrl(url);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const dismissForPendingProfileLink = async () => {
      const [shareCode, friendId] = await AsyncStorage.multiGet([
        PENDING_PROFILE_SHARE_CODE_KEY,
        PENDING_FRIEND_PROFILE_ID_KEY,
      ]);
      if (shareCode[1] || friendId[1]) {
        requestDismissNavigationOverlays();
      }
    };

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void dismissForPendingProfileLink();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const applyNotificationData = (data: Record<string, unknown> | undefined) => {
      const tap = parsePushNotificationTap(data);
      if (tap) {
        setPendingNotificationTap(
          tap as NonNullable<typeof pendingNotificationTap>
        );
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        applyNotificationData(
          response.notification.request.content.data as Record<string, unknown> | undefined
        );
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      applyNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user) {
      synqBootUidRef.current = null;
      setSynqBoot(null);
      return;
    }
    let cancelled = false;
    if (synqBootUidRef.current !== user.uid) {
      synqBootUidRef.current = user.uid;
      setSynqBoot({ cachedSynqActive: getCachedSynqActiveSync(user.uid) });
    }
    (async () => {
      let cachedSynqActive = getCachedSynqActiveSync(user.uid);
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        cachedSynqActive = userSnap.exists()
          ? computeSynqActiveFromUserData(userSnap.data())
          : cachedSynqActive;
        writeCachedSynqActive(user.uid, cachedSynqActive);
      } catch {
        try {
          cachedSynqActive = await readCachedSynqActive(user.uid);
          writeCachedSynqActive(user.uid, cachedSynqActive);
        } catch {
          cachedSynqActive = getCachedSynqActiveSync(user.uid);
        }
      }
      if (!cancelled) {
        setSynqBoot({ cachedSynqActive });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMinimumSplashElapsed(true);
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setBootSplashDismissed(true);
    }, BOOT_SPLASH_MAX_MS);
    return () => clearTimeout(timeoutId);
  }, []);

  const hideNativeSplash = () => {
    if (nativeSplashHiddenRef.current || !assetsReady) return;
    nativeSplashHiddenRef.current = true;
    void SplashScreen.hideAsync();
  };

  useEffect(() => {
    let mounted = true;
    const preloadAssets = async () => {
      try {
        await Asset.loadAsync([
          require("../assets/logo.png"),
          require("../assets/pulse.gif"),
        ]);
      } catch {} finally {
        if (mounted) setAssetsReady(true);
      }
    };
    preloadAssets();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await Promise.all([
          hydrateSocialCachesFromDisk(u.uid),
          hydrateOwnProfileFromDisk(u.uid),
          hydrateSynqStatusFromDisk(u.uid),
        ]);
        setSynqBoot({ cachedSynqActive: getCachedSynqActiveSync(u.uid) });
        prewarmMeTabScreen(u.uid);
        const cachedGate = profileGateFromCache(u.uid);
        if (cachedGate) {
          setUserProfileGate(cachedGate);
        } else {
          setUserProfileGate({ hasDisplayName: false, hasLocation: false });
        }
        void getPreAuthTermsAccepted().then((accepted) => {
          if (accepted) setCommunityTermsGate(true);
        });
      } else {
        setUserProfileGate(null);
        setCommunityTermsGate(null);
      }
      setUser(u);
      setAuthReady(true);

      if (u) {
        warmSocialCachesInBackground(u.uid);
        if (Platform.OS !== "web") {
          void registerForPushNotificationsAsync()
            .then(async (token) => {
              if (!token) return;
              try {
                await updateDoc(doc(db, "users", u.uid), { pushToken: token });
              } catch {}
            })
            .catch(() => {});
        }
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !authReady || !navReady) return;

    const maybePromptForLocationUpdate = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) return;
        const data = userSnap.data() as any;
        const hasCoords =
          typeof data?.lat === "number" && typeof data?.lng === "number";
        const hasCityState =
          typeof data?.city === "string" &&
          data.city.trim().length > 0 &&
          typeof data?.state === "string" &&
          data.state.trim().length > 0;
        if (hasCoords && hasCityState) return;

        const now = Date.now();
        const snoozedUntilMs = snoozedUntilMsFromField(
          data?.locationPromptSnoozedUntil
        );
        if (!Number.isNaN(snoozedUntilMs) && snoozedUntilMs > now) return;

        setShowLocationModal(true);
      } catch {}
    };

    const sub = DeviceEventEmitter.addListener(
      LOCATION_PROMPT_CHECK_REQUEST,
      () => {
        void maybePromptForLocationUpdate();
      }
    );
    return () => sub.remove();
  }, [user?.uid, authReady, navReady]);

  const markLocationPromptSnoozed = async () => {
    if (!user) return;
    const snoozeDays = 7;
    const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const currentCount =
        snap.exists() && typeof (snap.data() as any)?.locationPromptCount === "number"
          ? (snap.data() as any).locationPromptCount
          : 0;
      await updateDoc(doc(db, "users", user.uid), {
        locationPromptCount: currentCount + 1,
        lastLocationPromptAt: new Date().toISOString(),
        locationPromptSnoozedUntil: snoozedUntil,
      });
    } catch {}
  };

  useEffect(() => {
    if (!user?.uid) {
      setCommunityTermsGate(null);
      setUserProfileGate(null);
      return;
    }
    let cancelled = false;
    const cachedGate = profileGateFromCache(user.uid);
    if (cachedGate) setUserProfileGate(cachedGate);

    const gateTimeoutId = setTimeout(() => {
      if (cancelled) return;
      setUserProfileGate((prev) => {
        if (prev) return prev;
        return (
          cachedGate ?? {
            hasDisplayName: !!user.displayName,
            hasLocation: false,
          }
        );
      });
      setCommunityTermsGate((prev) => {
        if (prev !== null) return prev;
        return cachedGate?.hasDisplayName || !!user.displayName ? true : false;
      });
    }, PROFILE_GATE_TIMEOUT_MS);

    const markTermsOkForReturningUser = () => {
      if (cancelled) return;
      setCommunityTermsGate(true);
      void persistCommunityTermsAcceptance(user.uid).catch(() => {});
    };

    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() as Record<string, unknown> | undefined;
        const hasDisplayName = userHasDisplayName(data);
        const hasLocation = userHasLocation(data);

        if (!cancelled) {
          setUserProfileGate({ hasDisplayName, hasLocation });
        }

        if (data?.suspended === true) {
          await signOut(auth);
          if (!cancelled) {
            setCommunityTermsGate(null);
            setUserProfileGate(null);
          }
          return;
        }

        if (hasDisplayName && auth.currentUser && !auth.currentUser.displayName) {
          const name = displayNameFromUserDoc(data);
          if (name) {
            try {
              await updateProfile(auth.currentUser, {
                displayName: name,
                photoURL:
                  typeof data?.imageurl === "string" ? data.imageurl : null,
              });
              await auth.currentUser.reload();
              if (!cancelled) {
                setUser(auth.currentUser);
              }
            } catch {}
          }
        }

        if (userHasAcceptedCommunityTerms(data)) {
          if (!cancelled) setCommunityTermsGate(true);
          return;
        }

        // Returning accounts: terms were accepted at sign-up; do not re-prompt on login.
        if (hasDisplayName) {
          markTermsOkForReturningUser();
          return;
        }

        const preAuth = await getPreAuthTermsAccepted();
        if (preAuth) {
          markTermsOkForReturningUser();
          return;
        }
        if (!cancelled) {
          setCommunityTermsGate((prev) => (prev === true ? true : false));
        }
      } catch {
        if (!cancelled) {
          const fallbackGate =
            cachedGate ??
            (user.displayName
              ? { hasDisplayName: true, hasLocation: false }
              : { hasDisplayName: false, hasLocation: false });
          setUserProfileGate(fallbackGate);
          setCommunityTermsGate((prev) => {
            if (prev === true) return true;
            if (fallbackGate.hasDisplayName || !!user.displayName) return true;
            return prev;
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(gateTimeoutId);
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!authReady || !navReady) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onLocationPage =
      segments[0] === "location" ||
      (segments[0] === "(auth)" && segments[1] === "location");
    const onInterestsPage = segments[0] === "add-interests";
    const onDetailsPage = segments[1] === "details";
    const onProfilePhotoCropPage = segments[0] === "profile-photo-crop";
    const onCommunityTermsPage = segments[1] === "community-terms";
    const onFriendProfile = segments[0] === "friend-profile";
    const hasName =
      !!user?.displayName || userProfileGate?.hasDisplayName === true;

    if (!user) {
      if (!inAuthGroup) {
        if (onFriendProfile && !authReady) return;
        router.replace("/(auth)/welcome");
      }
      return;
    }

    // Legacy persisted route from before location moved under (auth)
    if (segments[0] === "location") {
      router.replace("/(tabs)");
      return;
    }

    if (userProfileGate === null) return;

    if (!hasName) {
      if (!onDetailsPage && !onProfilePhotoCropPage) {
        router.replace("/(auth)/details");
      }
      return;
    }

    const termsAccepted =
      communityTermsOk === true || communityTermsOkRef.current === true;

    if (!termsAccepted) {
      if (communityTermsOk === false && !onCommunityTermsPage) {
        router.replace("/(auth)/community-terms?postAuth=1");
      }
      return;
    }

    if (
      (onLocationPage && userProfileGate.hasLocation) ||
      (onInterestsPage && userProfileGate.hasDisplayName)
    ) {
      router.replace("/(tabs)");
      return;
    }

    if (onLocationPage || onInterestsPage) return;

    if (inAuthGroup && !onCommunityTermsPage) router.replace("/(tabs)");
  }, [authReady, navReady, user, segments, communityTermsOk, userProfileGate]);

  useEffect(() => {
    if (!authReady || !navReady || !user?.uid) return;
    const hasName =
      !!user.displayName || userProfileGate?.hasDisplayName === true;
    if (!hasName) return;
    if (inviteProcessingRef.current) return;

    const processPendingInvite = async () => {
      const fromUidRaw = await AsyncStorage.getItem(PENDING_INVITE_FROM_UID_KEY);
      const fromUid = cleanUid(fromUidRaw);
      const inviteCodeRaw = await AsyncStorage.getItem(PENDING_INVITE_CODE_KEY);
      const inviteCode = cleanUid(inviteCodeRaw);
      if (!fromUid && !inviteCode) return;
      if (fromUid === user.uid) {
        await AsyncStorage.multiRemove([
          PENDING_INVITE_FROM_UID_KEY,
          PENDING_INVITE_CODE_KEY,
        ]);
        return;
      }

      const attemptValue = fromUid || inviteCode || "";
      const attemptKey = `${user.uid}:${attemptValue}`;
      if (inviteAttemptsRef.current.has(attemptKey)) return;
      inviteAttemptsRef.current.add(attemptKey);
      inviteProcessingRef.current = true;
      try {
        const functions = getFunctions(undefined, "us-central1");
        const acceptInviteFromLink = httpsCallable(functions, "acceptInviteFromLink");
        await acceptInviteFromLink({
          ...(fromUid ? { fromUid } : {}),
          ...(inviteCode ? { inviteCode } : {}),
        });
        await AsyncStorage.multiRemove([
          PENDING_INVITE_FROM_UID_KEY,
          PENDING_INVITE_CODE_KEY,
        ]);
      } catch (err: any) {
        const code = String(err?.code || "");
        const shouldDropInvite =
          code.includes("invalid-argument") ||
          code.includes("already-exists") ||
          code.includes("failed-precondition");
        if (shouldDropInvite) {
          await AsyncStorage.multiRemove([
            PENDING_INVITE_FROM_UID_KEY,
            PENDING_INVITE_CODE_KEY,
          ]);
        } else {
          inviteAttemptsRef.current.delete(attemptKey);
        }
      } finally {
        inviteProcessingRef.current = false;
      }
    };

    void processPendingInvite();
  }, [authReady, navReady, user?.uid, user?.displayName, userProfileGate]);

  useEffect(() => {
    if (!authReady || !navReady || !assetsReady) return;
    if (!user?.uid) return;
    const hasName =
      !!user.displayName || userProfileGate?.hasDisplayName === true;
    if (!hasName) return;
    if (synqBoot === null) return;

    let cancelled = false;
    const processPendingFriendProfile = async () => {
      const friendId = cleanUid(
        await AsyncStorage.getItem(PENDING_FRIEND_PROFILE_ID_KEY)
      );
      if (!friendId || cancelled) return;
      if (friendId === user.uid) {
        await AsyncStorage.removeItem(PENDING_FRIEND_PROFILE_ID_KEY);
        return;
      }
      if (segments[0] === "friend-profile") return;
      requestDismissNavigationOverlays();
      router.push({
        pathname: "/friend-profile",
        params: { friendId },
      });
      await AsyncStorage.removeItem(PENDING_FRIEND_PROFILE_ID_KEY);
      requestAnimationFrame(() => requestDismissNavigationOverlays());
    };

    void processPendingFriendProfile();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    navReady,
    assetsReady,
    user?.uid,
    user?.displayName,
    userProfileGate,
    synqBoot,
    segments,
    router,
  ]);

  useEffect(() => {
    if (!authReady || !navReady || !assetsReady) return;
    if (!user?.uid) return;
    const hasName =
      !!user.displayName || userProfileGate?.hasDisplayName === true;
    if (!hasName) return;
    if (synqBoot === null) return;

    let cancelled = false;
    const processPendingProfileShareCode = async () => {
      const shareCode = cleanUid(
        await AsyncStorage.getItem(PENDING_PROFILE_SHARE_CODE_KEY)
      );
      if (!shareCode || cancelled) return;
      const friendId = await resolveProfileShareCodeToFriendId(shareCode);
      if (!friendId || cancelled) return;
      if (friendId === user.uid) {
        await AsyncStorage.removeItem(PENDING_PROFILE_SHARE_CODE_KEY);
        return;
      }
      if (segments[0] === "friend-profile") return;
      requestDismissNavigationOverlays();
      router.push({
        pathname: "/friend-profile",
        params: { friendId },
      });
      await AsyncStorage.removeItem(PENDING_PROFILE_SHARE_CODE_KEY);
      requestAnimationFrame(() => requestDismissNavigationOverlays());
    };

    void processPendingProfileShareCode();
    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    navReady,
    assetsReady,
    user?.uid,
    user?.displayName,
    userProfileGate,
    synqBoot,
    segments,
    router,
  ]);

  useEffect(() => {
    if (!authReady || !navReady || !assetsReady) return;
    if (!user) return;
    if (synqBoot === null) return;
    if (!pendingNotificationTap) return;

    const pending = pendingNotificationTap;
    setPendingNotificationTap(null);

    if (pending.kind === "notifications") {
      router.push("/notifications");
      return;
    }

    if (pending.kind === "community_group") {
      router.push({
        pathname: "/community-group/[id]",
        params: {
          id: pending.groupId,
          ...(pending.planId ? { planId: pending.planId } : {}),
        },
      });
      return;
    }

    if (pending.kind === "friend_profile") {
      if (pending.friendId !== user.uid) {
        void dismissActivityNotification(
          user.uid,
          `${pending.friendId}_accepted_${user.uid}`
        ).catch(() => {});
        requestDismissNavigationOverlays();
        router.push({
          pathname: "/friend-profile",
          params: { friendId: pending.friendId },
        });
      }
      return;
    }

    if (pending.kind === "synq_home") {
      const fromUserId = pending.fromUserId;
      const notificationType = pending.notificationType;
      if (fromUserId && notificationType) {
        void dismissActivityNotification(
          user.uid,
          activityNotificationId(notificationType, fromUserId, user.uid)
        ).catch(() => {});
      }
      router.push("/(tabs)");
      return;
    }

    if (pending.kind === "me") {
      if (pending.notificationId) {
        void dismissActivityNotification(user.uid, pending.notificationId).catch(
          () => {}
        );
      }
      if (pending.focusEventId) {
        router.push(
          `/(tabs)/me?focusEventId=${encodeURIComponent(pending.focusEventId)}`
        );
      } else {
        router.push("/(tabs)/me");
      }
      return;
    }

    if (pending.kind === "chat") {
      requestDismissNavigationOverlays();
      setPendingChatOpen(pending.chatId, pending.messageId);
      router.replace("/(tabs)");
      return;
    }
  }, [
    authReady,
    navReady,
    assetsReady,
    user,
    synqBoot,
    pendingNotificationTap,
    router,
  ]);

  const synqBootReady = user == null || synqBoot !== null;
  /** Splash only waits for profile gate; routing still waits on communityTermsOk. */
  const authGateReady = !user || userProfileGate !== null;
  const onOnboardingScreen =
    segments[0] === "location" ||
    (segments[0] === "(auth)" && segments[1] === "location") ||
    segments[0] === "add-interests";
  const holdSplashForStaleOnboarding =
    !!user &&
    onOnboardingScreen &&
    userProfileGate !== null &&
    (((segments[0] === "location" ||
      (segments[0] === "(auth)" && segments[1] === "location")) &&
      userProfileGate.hasLocation) ||
      (segments[0] === "add-interests" && userProfileGate.hasDisplayName));
  const appReady =
    authReady && navReady && assetsReady && synqBootReady && authGateReady;
  const onSignupFlowScreen =
    segments[1] === "details" ||
    segments[1] === "community-terms" ||
    segments[0] === "location" ||
    (segments[0] === "(auth)" && segments[1] === "location") ||
    segments[0] === "profile-photo-crop" ||
    segments[0] === "add-interests";
  const hideBootSplashDuringSignup =
    appReady && !!user && onSignupFlowScreen;
  const shouldDismissBootSplash =
    !bootSplashDismissed &&
    !holdSplashForStaleOnboarding &&
    !hideBootSplashDuringSignup &&
    appReady &&
    minimumSplashElapsed;

  useEffect(() => {
    if (!shouldDismissBootSplash) return;
    setBootSplashDismissed(true);
  }, [shouldDismissBootSplash]);

  const showBootSplashOverlay =
    !bootSplashDismissed && !hideBootSplashDuringSignup;

  useEffect(() => {
    if (showBootSplashOverlay) return;
    hideNativeSplash();
  }, [showBootSplashOverlay, assetsReady]);

  const locationModals =
    user && authReady ? (
      <LocationUpdateModal
        visible={showLocationModal}
        onClose={async () => {
          setShowLocationModal(false);
          await markLocationPromptSnoozed();
        }}
        onSaved={async () => {
          setShowLocationModal(false);
          await markLocationPromptSnoozed();
        }}
      />
    ) : null;

  if (updateRequired.checked && updateRequired.required) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RequiredUpdateBlocker storeUrl={updateRequired.storeUrl} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <ErrorBoundary>
        <AuthContext.Provider value={{ refreshAuth, user, markCommunityTermsOk }}>
          <SynqBootProvider
            value={synqBoot ?? { cachedSynqActive: false }}
          >
            <BlockedUsersProvider>
            <View style={styles.root}>
              {navReady ? (
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="friend-profile"
                    options={({ route }) => ({
                      animation:
                        (route.params as { from?: string } | undefined)?.from ===
                        "chat"
                          ? "none"
                          : "slide_from_right",
                      gestureEnabled: true,
                    })}
                  />
                  <Stack.Screen
                    name="friend-group/[id]"
                    options={{
                      animation: "slide_from_right",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="community-group/edit"
                    options={{
                      animation: "slide_from_right",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="community-group/[id]"
                    options={{
                      animation: "slide_from_right",
                      gestureEnabled: true,
                    }}
                  />
                  <Stack.Screen
                    name="profile-photo-crop"
                    options={{
                      animation: "slide_from_bottom",
                      presentation: "fullScreenModal",
                      gestureEnabled: false,
                    }}
                  />
                </Stack>
              ) : null}
              {showBootSplashOverlay ? (
                <View
                  style={styles.bootSplashOverlay}
                  onLayout={hideNativeSplash}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <Image
                    source={SPLASH_LOGO}
                    style={styles.bootSplashLogo}
                    resizeMode="contain"
                    accessibilityRole="image"
                    accessibilityLabel="Synq"
                  />
                </View>
              ) : null}
            </View>
            {locationModals}
            </BlockedUsersProvider>
          </SynqBootProvider>
        </AuthContext.Provider>
      </ErrorBoundary>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bootSplashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  bootSplashLogo: {
    width: 150,
    height: 150,
    maxWidth: "42%",
    maxHeight: "22%",
  },
});
