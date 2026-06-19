import { sheetStyles } from "@/constants/sheetStyles";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MODAL_OVERLAY,
  MODAL_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_CTA,
  TYPE_LEAD,
  fonts,
} from "@/constants/Variables";
import * as Location from "expo-location";
import { doc, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../src/lib/firebase";

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

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export default function LocationUpdateModal({ visible, onClose, onSaved }: Props) {
  const [locating, setLocating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();
  const [alertMessage, setAlertMessage] = useState("");
  const [closeAfterAlert, setCloseAfterAlert] = useState(false);

  const showAlert = (message: string, title?: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    setCloseAfterAlert(false);
  }, [visible]);

  const handleUpdateFromCurrentLocation = async () => {
    if (!auth.currentUser) return;
    try {
      setLocating(true);
      setIsUpdating(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showAlert(
          "Enable location access to update your city and state.",
          "Location permission needed"
        );
        setLocating(false);
        setIsUpdating(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const results = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      const best = results?.[0];
      const detectedCity =
        (best?.city || best?.subregion || best?.district || "").trim();
      const detectedRegion = (best?.region || "").trim();

      if (!detectedCity || !detectedRegion) {
        showAlert("Please enter city and state manually.", "Couldn’t detect city/state");
        setLocating(false);
        setIsUpdating(false);
        return;
      }

      const abbrev =
        US_STATE_ABBREV[detectedRegion] ?? detectedRegion.toUpperCase().slice(0, 2);

      const nextLocation = `${detectedCity}, ${abbrev}`;
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        city: detectedCity,
        state: abbrev,
        locationDisplay: nextLocation,
        lat,
        lng,
        locationUpdatedAt: new Date().toISOString(),
      });

      setLocating(false);
      setIsUpdating(false);
      setCloseAfterAlert(true);
      showAlert("Location successfully updated!", "Success");
    } catch {
      setLocating(false);
      setIsUpdating(false);
      showAlert("Could not update your location.", "Error");
    }
  };

  const dismissAlert = () => {
    setAlertVisible(false);
    if (closeAfterAlert) {
      setCloseAfterAlert(false);
      onSaved();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={sheetStyles.overlayCentered}>
        <View style={sheetStyles.card}>
          <Text style={sheetStyles.title}>Improve nearby matches</Text>
          <Text style={[sheetStyles.body, styles.bodySpacing]}>
            Let Synq auto-fill your location so nearby matches are more accurate. Edit your location anytime on your profile.
          </Text>
          <Text style={styles.privacy}>
            Your location is only used for nearby matching.
          </Text>

          <TouchableOpacity
            onPress={handleUpdateFromCurrentLocation}
            disabled={isUpdating || locating}
            style={[styles.saveBtn, (isUpdating || locating) && { opacity: 0.7 }]}
            activeOpacity={0.85}
          >
            {isUpdating || locating ? (
              <ActivityIndicator size="small" color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.saveBtnText}>Use current location</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Not now</Text>
          </TouchableOpacity>
        </View>

        {alertVisible ? (
          <View style={styles.alertLayer} pointerEvents="auto">
            <View style={styles.alertCard}>
              {alertTitle ? <Text style={styles.alertTitle}>{alertTitle}</Text> : null}
              <Text style={styles.alertMessage}>{alertMessage}</Text>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={dismissAlert}
                activeOpacity={0.8}
              >
                <Text style={styles.alertButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bodySpacing: {
    marginBottom: 10,
  },
  privacy: {
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
    lineHeight: 18,
    marginBottom: 20,
  },
  saveBtn: {
    alignSelf: "center",
    width: "62%",
    height: 50,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: sheetStyles.primaryBtnText,
  cancelBtn: {
    marginTop: 12,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cancelText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_LEAD,
  },
  alertLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: MODAL_OVERLAY,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  alertCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  alertTitle: {
    color: TEXT,
    fontSize: TYPE_CTA,
    fontFamily: fonts.heavy,
    marginBottom: 6,
    textAlign: "center",
  },
  alertMessage: {
    color: MUTED2,
    fontSize: TYPE_LEAD,
    fontFamily: fonts.book,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  alertButton: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  alertButtonText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_LEAD,
  },
});
