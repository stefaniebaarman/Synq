import StackScreenHeader from '@/src/components/StackScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  LayoutAnimation,
  Platform,
  StatusBar,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { formScreenStyles } from "../constants/formScreenStyles";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { filterOrReject } from "@/src/lib/contentFilter";
import { buildUserSearchFields } from "@/src/lib/userSearchFields";
import {
  fetchCurrentCityState,
  foregroundLocationAccessGranted,
  getForegroundLocationPermission,
  requestForegroundLocationAccess,
  type LocationResolvePhase,
  type ResolvedCityState,
} from "@/src/lib/locationAccess";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type LocationAutofillState = "offered" | "locating" | "success" | "dismissed";

const US_STATE_ABBREV: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const [locating, setLocating] = useState(false);
  const [locatingPhase, setLocatingPhase] = useState<LocationResolvePhase>("gps");
  const [locationAutofill, setLocationAutofill] =
    useState<LocationAutofillState>("offered");
  const [resolvedLocationPreview, setResolvedLocationPreview] = useState("");
  const [locationPermissionPromptVisible, setLocationPermissionPromptVisible] =
    useState(false);
  const [locationPermissionRequesting, setLocationPermissionRequesting] =
    useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const locationGlow = useSharedValue(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [goBackOnClose, setGoBackOnClose] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showRemoveLocationConfirm, setShowRemoveLocationConfirm] = useState(false);
  const [removingLocation, setRemovingLocation] = useState(false);

  type Baseline = {
    displayName: string;
    city: string;
    state: string;
    coords: { lat: number; lng: number } | null;
  };
  const [baseline, setBaseline] = useState<Baseline>({
    displayName: "",
    city: "",
    state: "",
    coords: null,
  });

  const normalizeState = (s: string) => s.trim().toUpperCase();

  const coordsEqual = (
    a: { lat: number; lng: number } | null,
    b: { lat: number; lng: number } | null
  ) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.lat === b.lat && a.lng === b.lng;
  };

  const isDirty =
    displayName.trim() !== baseline.displayName.trim() ||
    city.trim() !== baseline.city.trim() ||
    normalizeState(state) !== normalizeState(baseline.state) ||
    !coordsEqual(coords, baseline.coords);

  const hasSavedLocation =
    !!city.trim() || !!state.trim() || coords !== null;

  const showAlert = (message: string, title?: string, closeAndGoBack = false) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setGoBackOnClose(closeAndGoBack);
    setAlertVisible(true);
  };

  const locationFieldsAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(0, 255, 133, ${0.08 + locationGlow.value * 0.42})`,
    backgroundColor: `rgba(0, 255, 133, ${locationGlow.value * 0.05})`,
  }));

  const pulseLocationFields = () => {
    locationGlow.value = withSequence(
      withTiming(1, { duration: 320 }),
      withTiming(0, { duration: 700 })
    );
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (!auth.currentUser) return;
      const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (snap.exists()) {
        const data = snap.data();
        setDisplayName(data.displayName || '');
        setCity(data.city || '');
        setState(data.state || '');
        const lat = typeof data.lat === "number" ? data.lat : null;
        const lng = typeof data.lng === "number" ? data.lng : null;
        const nextCoords =
          lat !== null && lng !== null ? { lat, lng } : null;
        if (nextCoords) {
          setCoords(nextCoords);
        } else {
          setCoords(null);
        }
        setBaseline({
          displayName: data.displayName || "",
          city: data.city || "",
          state: (data.state || "").trim().toUpperCase(),
          coords: nextCoords,
        });
      }
      setLoading(false);
    };
    loadUserData();
  }, []);

  const applyResolvedLocation = (data: ResolvedCityState) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCoords({ lat: data.lat, lng: data.lng });
    setCity(data.city);
    setState(data.stateAbbrev);
    setResolvedLocationPreview(`${data.city}, ${data.stateAbbrev}`);
    setLocationAutofill("success");
    pulseLocationFields();
  };

  const resetLocationAutofill = () => {
    setLocating(false);
    setLocatingPhase("gps");
    setLocationAutofill("offered");
    setResolvedLocationPreview("");
  };

  const readLocationAfterAccess = async () => {
    setLocationAutofill("locating");
    setLocatingPhase("gps");
    setLocating(true);
    try {
      const result = await fetchCurrentCityState(US_STATE_ABBREV, (phase) => {
        setLocatingPhase(phase);
      });
      if (result.ok) {
        setLocating(false);
        applyResolvedLocation(result.data);
        return;
      }
      resetLocationAutofill();
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
    } catch (e) {
      console.error(e);
      resetLocationAutofill();
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
    if (saving || locating || removingLocation || locationPermissionRequesting) {
      return;
    }
    if (locationAutofill === "success") return;

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

  const locatingSubtitle =
    locatingPhase === "gps"
      ? "Getting your position…"
      : "Looking up city and state…";

  const handleSave = async () => {
    if (!auth.currentUser || !isDirty || saving || removingLocation) return;
    const nameCheck = filterOrReject(displayName.trim());
    if (!nameCheck.ok) {
      showAlert(nameCheck.reason, "Content not allowed");
      return;
    }
    setSaving(true);

    try {
      const c = city.trim();
      const s = state.trim().toUpperCase();

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: displayName.trim(),
        city: c,
        state: s,
        locationDisplay: c && s ? `${c}, ${s}` : "",
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        locationUpdatedAt: new Date().toISOString(),
        ...buildUserSearchFields({
          displayName: displayName.trim(),
          email: auth.currentUser.email,
        }),
      });

      setBaseline({
        displayName: displayName.trim(),
        city: c,
        state: s,
        coords: coords?.lat != null && coords?.lng != null ? { ...coords } : null,
      });

      showAlert("Profile updated!", "Success", true);
    } catch (e) {
      showAlert("Could not save profile.", "Error");
    } finally {
      setSaving(false);
    }
  };

  const leaveScreen = () => {
    router.back();
  };

  const handleCancel = () => {
    if (!isDirty) {
      leaveScreen();
      return;
    }
    setShowDiscardConfirm(true);
  };

  const confirmRemoveLocation = async () => {
    if (!auth.currentUser) return;
    setShowRemoveLocationConfirm(false);
    setRemovingLocation(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        city: deleteField(),
        state: deleteField(),
        locationDisplay: deleteField(),
        lat: deleteField(),
        lng: deleteField(),
        locationUpdatedAt: deleteField(),
        locationPromptSnoozedUntil: deleteField(),
      });
      setCity("");
      setState("");
      setCoords(null);
      resetLocationAutofill();
      setBaseline((prev) => ({
        ...prev,
        city: "",
        state: "",
        coords: null,
      }));
    } catch {
      showAlert("Could not remove location.", "Error");
    } finally {
      setRemovingLocation(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.darkFill}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <StackScreenHeader title="Edit profile" onBack={handleCancel} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={formScreenStyles.groupTitle}>Name</Text>
          <View style={formScreenStyles.group}>
            <View style={styles.fieldRow}>
              <TextInput
                style={styles.fieldInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor={MUTED3}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <Text style={formScreenStyles.groupTitle}>Location</Text>
          <Animated.View
            style={[
              formScreenStyles.group,
              locationFieldsAnimatedStyle,
              locating && styles.locationFieldsLocating,
            ]}
          >
            <View style={styles.locationFieldsRow}>
              <TextInput
                style={[styles.fieldInput, styles.cityInput]}
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  if (locationAutofill === "success") {
                    setLocationAutofill("dismissed");
                  }
                }}
                placeholder="City"
                placeholderTextColor={MUTED3}
                autoCapitalize="words"
                editable={!locating && !removingLocation}
              />
              <View style={styles.colDivider} />
              <TextInput
                style={[styles.fieldInput, styles.stateInput]}
                value={state}
                onChangeText={(text) => {
                  setState(text);
                  if (locationAutofill === "success") {
                    setLocationAutofill("dismissed");
                  }
                }}
                placeholder="ST"
                placeholderTextColor={MUTED3}
                maxLength={2}
                autoCapitalize="characters"
                editable={!locating && !removingLocation}
              />
            </View>
          </Animated.View>

          {locationAutofill !== "dismissed" && (
            <View style={formScreenStyles.group}>
              <TouchableOpacity
                onPress={fillFromCurrentLocation}
                disabled={
                  saving ||
                  locating ||
                  removingLocation ||
                  locationPermissionRequesting ||
                  locationAutofill === "success"
                }
                activeOpacity={0.75}
                style={[
                  styles.actionRow,
                  (saving ||
                    locating ||
                    removingLocation ||
                    locationPermissionRequesting) &&
                    styles.disabledControl,
                ]}
              >
                <View
                  style={[
                    styles.actionIconWrap,
                    locationAutofill === "success" && styles.actionIconSuccess,
                  ]}
                >
                  {locating || locationPermissionRequesting ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : locationAutofill === "success" ? (
                    <Ionicons name="checkmark" size={20} color={ACCENT} />
                  ) : (
                    <Ionicons name="location-outline" size={20} color={ACCENT} />
                  )}
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>
                    {locationAutofill === "success"
                      ? "Location found"
                      : locating || locationPermissionRequesting
                        ? "Using current location…"
                        : "Use current location"}
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    {locationAutofill === "success"
                      ? resolvedLocationPreview
                      : locating || locationPermissionRequesting
                        ? locatingSubtitle
                        : "Auto-fill city and state"}
                  </Text>
                </View>
                {locationAutofill === "offered" &&
                  !locating &&
                  !locationPermissionRequesting && (
                    <Ionicons name="chevron-forward" size={18} color={MUTED2} />
                  )}
              </TouchableOpacity>
            </View>
          )}

          {hasSavedLocation && (
            <TouchableOpacity
              onPress={() => setShowRemoveLocationConfirm(true)}
              disabled={saving || locating || removingLocation}
              style={styles.removeLocationBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.removeLocationText}>Remove location</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || saving || removingLocation}
            style={[
              styles.saveButton,
              (!isDirty || saving || removingLocation) && styles.saveButtonDisabled,
            ]}
            activeOpacity={isDirty && !saving && !removingLocation ? 0.9 : 1}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            accessibilityState={{ disabled: !isDirty || saving || removingLocation }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="black" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            disabled={saving || removingLocation}
            style={[
              styles.cancelButton,
              (saving || removingLocation) && styles.disabledControl,
            ]}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.footerSpace} />
        </ScrollView>
        <AlertModal
          visible={alertVisible}
          title={alertTitle}
          message={alertMessage}
          onClose={() => {
            setAlertVisible(false);
            if (goBackOnClose) router.back();
            setGoBackOnClose(false);
          }}
        />
        <ConfirmModal
          visible={showDiscardConfirm}
          title="Discard changes?"
          message="You have unsaved changes. Discard them and go back?"
          confirmText="Discard"
          cancelText="Keep editing"
          destructive
          onConfirm={() => {
            setShowDiscardConfirm(false);
            leaveScreen();
          }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
        <ConfirmModal
          visible={showRemoveLocationConfirm}
          title="Remove location?"
          message="This clears your city, state, and saved coordinates from your profile. You can add a location again anytime."
          confirmText="Remove"
          cancelText="Cancel"
          destructive
          onConfirm={confirmRemoveLocation}
          onCancel={() => setShowRemoveLocationConfirm(false)}
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
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  darkFill: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: {
    paddingBottom: SPACE_6,
    paddingTop: SPACE_3,
  },

  fieldRow: {
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: 10,
    justifyContent: "center",
  },
  locationFieldsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: 10,
    minHeight: 44,
  },
  colDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginHorizontal: SPACE_3 - 2,
    marginVertical: 6,
  },
  fieldInput: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    paddingVertical: Platform.OS === "ios" ? 6 : 4,
    paddingHorizontal: 0,
    includeFontPadding: false,
  },
  cityInput: {
    flex: 1,
    minWidth: 0,
    alignSelf: "center",
  },
  stateInput: {
    width: 56,
    alignSelf: "center",
    textAlign: "center",
    letterSpacing: 1.2,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE_4,
    paddingHorizontal: SPACE_4 + 2,
    gap: SPACE_3 + 2,
  },
  locationFieldsLocating: {
    opacity: 0.55,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,255,133,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSuccess: {
    backgroundColor: "rgba(0,255,133,0.18)",
    borderColor: "rgba(0,255,133,0.45)",
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    lineHeight: 22,
  },
  actionSubtitle: {
    marginTop: 2,
    color: MUTED,
    fontSize: TYPE_CAPTION + 1,
    fontFamily: fonts.book,
    lineHeight: 18,
  },

  removeLocationBtn: {
    alignSelf: "flex-start",
    marginTop: SPACE_3 - 4,
    marginLeft: SPACE_5,
    marginBottom: SPACE_3,
    paddingVertical: SPACE_3 - 4,
  },
  removeLocationText: {
    color: MUTED2,
    fontSize: TYPE_CAPTION + 2,
    fontFamily: fonts.medium,
  },

  saveButton: {
    marginTop: SPACE_5,
    alignSelf: "center",
    minWidth: 200,
    minHeight: 48,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: SPACE_5,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    color: ON_ACCENT_TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  cancelButton: {
    marginTop: SPACE_4,
    alignSelf: "center",
    paddingVertical: SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  cancelButtonText: {
    color: MUTED2,
    fontSize: TYPE_BODY - 1,
    fontFamily: fonts.medium,
  },

  disabledControl: { opacity: 0.5 },
  footerSpace: { height: SPACE_5 },
});
