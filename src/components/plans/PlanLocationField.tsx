import {
  BORDER,
  BUTTON_RADIUS,
  GROUP_BORDER,
  MUTED2,
  PLACEHOLDER_DARK,
  SURFACE_INPUT,
  TEXT,
  TEXT_MUTED_DARK,
  TYPE_BODY,
  TYPE_CAPTION,
  formInputText,
  fonts,
} from "@/constants/Variables";
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  newPlacesSessionToken,
  placesApiConfigured,
  type PlaceSuggestion,
  type PlacesLocationBias,
  type ResolvedPlace,
} from "@/src/lib/placesAutocomplete";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export type PlanLocationValue = {
  location: string;
  locationLat?: number;
  locationLng?: number;
  placeId?: string;
};

type Props = {
  value: PlanLocationValue;
  onChange: (next: PlanLocationValue) => void;
  locationBias?: PlacesLocationBias | null;
  onFocus?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  placeholder?: string;
  accessibilityLabel?: string;
};

const DEBOUNCE_MS = 280;

function coordsEqual(
  a?: number,
  b?: number
): boolean {
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  return Math.abs(a - b) < 1e-7;
}

export default function PlanLocationField({
  value,
  onChange,
  locationBias = null,
  onFocus,
  inputRef,
  placeholder = "Add location",
  accessibilityLabel = "Add location",
}: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const sessionTokenRef = useRef(newPlacesSessionToken());
  const abortRef = useRef<AbortController | null>(null);
  const pickLockRef = useRef(false);
  const localInputRef = useRef<TextInput>(null);
  const resolvedInputRef = inputRef || localInputRef;

  const hasStructured =
    typeof value.locationLat === "number" &&
    typeof value.locationLng === "number" &&
    Number.isFinite(value.locationLat) &&
    Number.isFinite(value.locationLng);

  const restartSession = useCallback(() => {
    sessionTokenRef.current = newPlacesSessionToken();
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const biasLat = locationBias?.lat;
  const biasLng = locationBias?.lng;
  const biasRadius = locationBias?.radiusMeters;

  useEffect(() => {
    if (!placesApiConfigured()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const q = String(value.location || "").trim();
    if (pickLockRef.current || hasStructured || q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const bias =
      typeof biasLat === "number" && typeof biasLng === "number"
        ? { lat: biasLat, lng: biasLng, radiusMeters: biasRadius }
        : null;

    setLoading(true);
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      void (async () => {
        try {
          const rows = await fetchPlaceSuggestions(
            q,
            sessionTokenRef.current,
            bias,
            ac.signal
          );
          if (ac.signal.aborted) return;
          setSuggestions(rows);
          setListOpen(true);
        } catch {
          if (ac.signal.aborted) return;
          setSuggestions([]);
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [value.location, hasStructured, biasLat, biasLng, biasRadius]);

  const handleTextChange = (text: string) => {
    pickLockRef.current = false;
    const next: PlanLocationValue = { location: text };
    // Clear structured place if the user edits after a pick.
    if (
      hasStructured ||
      value.placeId ||
      typeof value.locationLat === "number" ||
      typeof value.locationLng === "number"
    ) {
      // intentionally omit lat/lng/placeId
    }
    onChange(next);
    if (text.trim().length >= 2) setListOpen(true);
    else {
      setSuggestions([]);
      setListOpen(false);
    }
  };

  const handlePick = async (suggestion: PlaceSuggestion) => {
    if (resolvingPlaceId) return;
    setResolvingPlaceId(suggestion.placeId);
    pickLockRef.current = true;
    setListOpen(false);
    setSuggestions([]);

    try {
      const place: ResolvedPlace | null = await fetchPlaceDetails(
        suggestion.placeId,
        sessionTokenRef.current
      );
      restartSession();
      if (!place) {
        onChange({ location: suggestion.primaryText });
        pickLockRef.current = false;
        return;
      }
      onChange({
        location: place.name,
        locationLat: place.lat,
        locationLng: place.lng,
        placeId: place.placeId,
      });
    } catch {
      restartSession();
      onChange({ location: suggestion.primaryText });
      pickLockRef.current = false;
    } finally {
      setResolvingPlaceId(null);
    }
  };

  const showPlaceholder = !String(value.location || "").trim();
  const showDropdown =
    listOpen &&
    !hasStructured &&
    (loading || suggestions.length > 0 || resolvingPlaceId);

  return (
    <View style={styles.wrap}>
      <View style={styles.inputShell}>
        {showPlaceholder ? (
          <Text style={styles.placeholder} pointerEvents="none">
            {placeholder}
          </Text>
        ) : null}
        <TextInput
          ref={resolvedInputRef as React.RefObject<TextInput>}
          placeholder=""
          placeholderTextColor={PLACEHOLDER_DARK}
          style={styles.input}
          value={value.location}
          onFocus={() => {
            onFocus?.();
            if (!hasStructured && String(value.location || "").trim().length >= 2) {
              setListOpen(true);
            }
          }}
          onChangeText={handleTextChange}
          returnKeyType="done"
          accessibilityLabel={accessibilityLabel}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {suggestions.map((row) => (
            <Pressable
              key={row.placeId}
              style={({ pressed }) => [
                styles.suggestionRow,
                pressed && styles.suggestionRowPressed,
              ]}
              onPress={() => void handlePick(row)}
              disabled={!!resolvingPlaceId}
              accessibilityRole="button"
              accessibilityLabel={`${row.primaryText}${
                row.secondaryText ? `, ${row.secondaryText}` : ""
              }`}
            >
              <View style={styles.suggestionTextCol}>
                <Text style={styles.suggestionPrimary} numberOfLines={1}>
                  {row.primaryText}
                </Text>
                {row.secondaryText ? (
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {row.secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {!loading && suggestions.length === 0 && !resolvingPlaceId ? (
            <Text style={styles.emptyHint}>No matching places</Text>
          ) : null}
        </View>
      ) : null}

    </View>
  );
}

/** Compare location payloads for dirty checks. */
export function planLocationChanged(
  a: PlanLocationValue,
  b: PlanLocationValue
): boolean {
  return (
    String(a.location || "").trim() !== String(b.location || "").trim() ||
    !coordsEqual(a.locationLat, b.locationLat) ||
    !coordsEqual(a.locationLng, b.locationLng) ||
    String(a.placeId || "").trim() !== String(b.placeId || "").trim()
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  inputShell: {
    position: "relative",
    justifyContent: "center",
  },
  placeholder: {
    ...formInputText,
    position: "absolute",
    left: 14,
    top: 14,
    right: 14,
    color: PLACEHOLDER_DARK,
    zIndex: 1,
  },
  input: {
    ...formInputText,
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    padding: 14,
    borderRadius: BUTTON_RADIUS,
    marginBottom: 0,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: SURFACE_INPUT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: BUTTON_RADIUS,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GROUP_BORDER,
  },
  suggestionRowPressed: {
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  suggestionTextCol: {
    flex: 1,
    minWidth: 0,
  },
  suggestionPrimary: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
  },
  suggestionSecondary: {
    marginTop: 2,
    color: MUTED2,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
  },
  emptyHint: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: TEXT_MUTED_DARK,
    fontSize: TYPE_CAPTION,
    fontFamily: fonts.book,
  },
});
