import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
  onboardingContentTopPadding,
  ONBOARDING_DIVIDER_MARGIN_TOP,
  ONBOARDING_H_PADDING,
  ONBOARDING_SUBTITLE_MARGIN_TOP,
  ONBOARDING_SUBTITLE_SIZE,
  ONBOARDING_TITLE_LINE_HEIGHT,
  ONBOARDING_TITLE_SIZE,
} from "../constants/onboardingLayout";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL,
  BG,
  BORDER,
  BORDER_HAIRLINE,
  BUTTON_RADIUS,
  MUTED,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  TEXT,
  TYPE_CTA,
  TYPE_LEAD,
  ctaButtonText,
  fonts,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import AlertModal from "./alert-modal";
import { useAuthRefresh } from "./_layout";

const INTERESTS = [
    "🍽️ Going out to eat",
    "☕ Coffee",
    "🍹 Drinks",
    "🚶 Walking",
    "🏋️ Gym",
    "🧘 Pilates / Yoga",
    "🎾 Pickleball",
    "🏀 Basketball",
    "⚽ Soccer",
    "🎳 Bowling",
    "🎮 Games",
    "🎤 Karaoke",
    "🎶 Live music",
    "🖼️ Museums",
    "🎬 Movies",
    "🏈 Sports bars",
    "🌲 Hiking",
    "🛍️ Shopping",
    "🧑‍🍳 Cooking",
    "🐶 Dog park",
    "🎨 Art",
    "📚 Reading",
];

export default function InterestsOnboarding() {
    const router = useRouter();
    const { refreshAuth } = useAuthRefresh();

    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");

    const canContinue = selected.length > 0 && !loading;

    const toggle = (label: string) => {
        setSelected((prev) =>
            prev.includes(label)
                ? prev.filter((x) => x !== label)
                : [...prev, label]
        );
    };

    const saveInterests = async () => {
        if (!auth.currentUser) return;

        try {
            setLoading(true);

            await setDoc(
                doc(db, "users", auth.currentUser.uid),
                {
                    interests: selected,
                },
                { merge: true }
            );

            refreshAuth();
            router.replace("/(tabs)/friends");
        } catch (e: any) {
            console.error(e);
            setAlertMessage("Could not save interests.");
            setAlertVisible(true);
            setLoading(false);
        }
    };

    const handleSkip = () => {
        refreshAuth();
        router.replace("/(tabs)/friends");
    };

    return (
        <View style={[styles.container, { paddingTop: onboardingContentTopPadding() }]}>
            <Text style={styles.title}>Add your interests</Text>
            <Text style={styles.subtitle}>
                This helps Synq suggest plans and helps friends find common ground.
            </Text>

            <View style={styles.pillsSection}>
                <ScrollView
                    style={styles.pillsScroll}
                    contentContainerStyle={styles.pillsWrap}
                    showsVerticalScrollIndicator={false}
                >
                    {INTERESTS.map((label) => {
                        const isOn = selected.includes(label);
                        return (
                            <TouchableOpacity
                                key={label}
                                onPress={() => toggle(label)}
                                activeOpacity={0.85}
                                style={[styles.pill, isOn && styles.pillOn]}
                            >
                                <Text style={[styles.pillText, isOn && styles.pillTextOn]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <TouchableOpacity
                disabled={!canContinue}
                onPress={saveInterests}
                style={[styles.button, !canContinue && { opacity: 0.5 }]}
            >
                {loading ? (
                    <ActivityIndicator color="black" />
                ) : (
                    <Text style={ctaButtonText}>
                        Continue{selected.length ? ` (${selected.length})` : ""}
                    </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
            <AlertModal
                visible={alertVisible}
                title="Error"
                message={alertMessage}
                onClose={() => setAlertVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: ONBOARDING_H_PADDING,
        paddingBottom: 24,
    },
    title: {
        color: TEXT,
        fontSize: ONBOARDING_TITLE_SIZE,
        lineHeight: ONBOARDING_TITLE_LINE_HEIGHT,
        fontFamily: fonts.heavy,
        letterSpacing: 0.2,
    },
  subtitle: {
    color: MUTED,
    fontSize: ONBOARDING_SUBTITLE_SIZE,
    marginTop:
      ONBOARDING_DIVIDER_MARGIN_TOP + 1 + ONBOARDING_SUBTITLE_MARGIN_TOP,
        fontFamily: fonts.book,
        lineHeight: 22,
    },
    pillsSection: {
        marginTop: 28,
        marginBottom: 8,
    },
    pillsScroll: {
        maxHeight: 380,
    },
    pillsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingBottom: 6,
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 10,
        marginBottom: 10,
        backgroundColor: BORDER,
        borderWidth: 1,
        borderColor: BORDER_HAIRLINE,
    },
    pillOn: {
        backgroundColor: ACCENT_FILL,
        borderColor: ACCENT_BORDER,
    },
    pillText: {
        color: TEXT,
        fontSize: TYPE_LEAD,
        fontFamily: fonts.heavy,
    },
    pillTextOn: { color: TEXT },

    button: {
        marginTop: 20,
        alignSelf: "center",
        width: PRIMARY_CTA_WIDTH,
        backgroundColor: ACCENT,
        height: PRIMARY_CTA_HEIGHT,
        borderRadius: BUTTON_RADIUS,
        alignItems: "center",
        justifyContent: "center",
    },
    skipButton: { marginTop: 20, alignSelf: "center" },
    skipText: {
        color: MUTED,
        fontSize: TYPE_LEAD,
        fontFamily: fonts.medium,
    },
});
