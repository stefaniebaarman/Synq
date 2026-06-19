import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { stateAbbreviations } from "../../assets/Mocks";
import {
  ONBOARDING_H_PADDING,
  ONBOARDING_SCROLL_BOTTOM,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_SIZE,
  onboardingContentTopPadding,
} from "@/constants/onboardingLayout";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_LEAD,
  fonts,
} from "../../constants/Variables";
import { auth, db } from "../../src/lib/firebase";
import { getCachedOwnProfile } from "../../src/lib/ownProfileCache";
import {
  fetchCurrentCityState,
  getForegroundLocationPermission,
  foregroundLocationAccessGranted,
  requestForegroundLocationAccess,
} from "../../src/lib/locationAccess";
import { userHasLocation } from "../../src/lib/userProfile";
import { useAuthRefresh } from "../_layout";
import AlertModal from "../alert-modal";

const US_STATE_ABBREV: Record<string, string> = stateAbbreviations;

const VALID_US_STATE_ABBREVS = new Set(Object.values(stateAbbreviations));

function isValidStateAbbrev(abbrev: string): boolean {
  return VALID_US_STATE_ABBREVS.has(abbrev.trim().toUpperCase());
}

export default function LocationDetails() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isSignupOnboarding = onboarding === "1";
  const { refreshAuth, user } = useAuthRefresh();
  const insets = useSafeAreaInsets();
  const [skipScreen, setSkipScreen] = useState(
    () => !isSignupOnboarding
  );

  useEffect(() => {
    if (!isSignupOnboarding) {
      router.replace("/(tabs)");
      return;
    }

    const uid = user?.uid;
    if (!uid) return;

    const cached = getCachedOwnProfile(uid);
    if (cached?.city?.trim() && cached?.state?.trim()) {
      setSkipScreen(true);
      router.replace("/(tabs)");
      return;
    }

    let cancelled = false;
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        if (userHasLocation(snap.data() as Record<string, unknown>)) {
          setSkipScreen(true);
          router.replace("/(tabs)");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignupOnboarding, user?.uid, router]);

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationUsed, setLocationUsed] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [locationPermissionPromptVisible, setLocationPermissionPromptVisible] =
    useState(false);
  const [locationPermissionRequesting, setLocationPermissionRequesting] =
    useState(false);

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const canContinue = useMemo(() => {
    const s = state.trim().toUpperCase();
    return (
      !!city.trim() &&
      s.length === 2 &&
      isValidStateAbbrev(s) &&
      !loading &&
      !locating
    );
  }, [city, state, loading, locating]);

  const applyResolvedLocation = (data: {
    lat: number;
    lng: number;
    city: string;
    stateAbbrev: string;
  }) => {
    setCoords({ lat: data.lat, lng: data.lng });
    setCity(data.city);
    setState(data.stateAbbrev);
    setLocationUsed(true);
  };

  const readLocationAfterAccess = async () => {
    setLocating(true);
    try {
      const result = await fetchCurrentCityState(US_STATE_ABBREV);
      if (result.ok) {
        applyResolvedLocation(result.data);
        return;
      }
      if (result.reason === "denied") {
        showAlert(
          "Allow location access in Settings to auto-fill your city and state.",
          "Location permission needed"
        );
        return;
      }
      if (result.reason === "undetected") {
        showAlert("Please enter it manually.", "Couldn’t detect city/state");
        return;
      }
      showAlert("Could not get your current location.", "Error");
    } finally {
      setLocating(false);
    }
  };

  const requestLocationAccessAndFill = async () => {
    setLocationPermissionRequesting(true);
    try {
      const granted = await requestForegroundLocationAccess();
      if (!granted) {
        showAlert(
          "Allow location access in Settings to auto-fill your city and state.",
          "Location permission needed"
        );
        return;
      }
      await readLocationAfterAccess();
    } finally {
      setLocationPermissionRequesting(false);
    }
  };

  const fillFromCurrentLocation = async () => {
    if (loading || locating || locationPermissionRequesting) return;

    const permission = await getForegroundLocationPermission();
    if (foregroundLocationAccessGranted(permission)) {
      await readLocationAfterAccess();
      return;
    }

    if (permission.status === "undetermined") {
      setLocationPermissionPromptVisible(true);
      return;
    }

    await requestLocationAccessAndFill();
  };

  const saveLocation = async () => {
    if (!auth.currentUser) return;

    const c = city.trim();
    const s = state.trim().toUpperCase();

    if (s.length !== 2 || !isValidStateAbbrev(s)) {
      showAlert(
        "Enter a valid 2-letter US state or DC abbreviation (for example WA, CA, or DC).",
        "Invalid state abbreviation"
      );
      return;
    }

    try {
      setLoading(true);

      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          city: c,
          state: s,
          locationDisplay: `${c}, ${s}`,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          locationUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      refreshAuth();
      router.push("/add-interests");
    } catch (e: any) {
      console.error(e);
      showAlert("Could not save location.", "Error");
      setLoading(false);
    }
  };

  const handleSkip = () => {
    refreshAuth();
    router.push("/add-interests");
  };

  if (skipScreen) {
    return <View style={styles.container} />;
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(
                onboardingContentTopPadding(),
                insets.top + 24
              ),
              paddingBottom: ONBOARDING_SCROLL_BOTTOM + 48 + insets.bottom,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        >
        <View style={styles.innerContent}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Where do you live?</Text>
            <Text style={styles.subtitle}>
              This helps friends see who is nearby for a quick Synq.
            </Text>
          </View>

        <View style={styles.formBlock}>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="City (e.g. Seattle)"
            placeholderTextColor={MUTED3}
            style={styles.input}
          />

          <TextInput
            value={state}
            onChangeText={setState}
            placeholder="State (e.g. WA)"
            placeholderTextColor={MUTED3}
            autoCapitalize="characters"
            maxLength={2}
            style={[styles.input, { marginTop: 12 }]}
          />

          {!locationUsed && (
            <TouchableOpacity
              onPress={fillFromCurrentLocation}
              disabled={loading || locating || locationPermissionRequesting}
              activeOpacity={0.75}
              style={[
                styles.locationRow,
                (loading || locating || locationPermissionRequesting) &&
                  styles.locationRowDisabled,
              ]}
            >
              <View style={styles.locationIconWrap}>
                {locating ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <Ionicons name="location-outline" size={18} color={ACCENT} />
                )}
              </View>
              <View style={styles.locationCopy}>
                <Text style={styles.locationPrimary}>
                  {locating
                    ? "Using current location…"
                    : "Use current location"}
                </Text>
                <Text style={styles.locationSecondary}>
                  {locating
                    ? "Finding your city and state"
                    : "Auto-fill your city and state"}
                </Text>
              </View>
              {!locating && (
                <Ionicons name="chevron-forward" size={18} color={MUTED2} />
              )}
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          disabled={!canContinue}
          onPress={saveLocation}
          style={[
            styles.button,
            !canContinue && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
        <AlertModal
          visible={locationPermissionPromptVisible}
          title="Location access"
          message="Synq uses your location once to auto-fill your city and state."
          buttonText="Continue"
          onClose={() => {
            setLocationPermissionPromptVisible(false);
            void requestLocationAccessAndFill();
          }}
        />
        </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: ONBOARDING_H_PADDING,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: ONBOARDING_SCROLL_BOTTOM + 48,
  },
  innerContent: {
    width: "100%",
  },
  headerSection: {
    marginBottom: 10,
  },
  formBlock: {
    marginTop: 4,
  },
  title: {
    color: TEXT,
    fontSize: ONBOARDING_TITLE_SIZE,
    lineHeight: 38,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop: 9,
    marginBottom: 10,
    fontFamily: fonts.book,
    lineHeight: 22,
  },

  input: {
    color: TEXT,
    backgroundColor: BORDER,
    height: 52,
    borderRadius: BUTTON_RADIUS,
    paddingHorizontal: 14,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },

  locationRow: {
    marginTop: 12,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: BORDER,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationRowDisabled: {
    opacity: 0.55,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,255,133,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationCopy: {
    flex: 1,
    minWidth: 0,
  },
  locationPrimary: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  locationSecondary: {
    marginTop: 2,
    color: MUTED,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    lineHeight: 18,
  },

  button: {
    marginTop: 32,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    height: PRIMARY_CTA_HEIGHT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
  },

  skipButton: { marginTop: 20, alignSelf: "center" },
  skipText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: TYPE_LEAD,
    fontFamily: fonts.medium,
  },
});
