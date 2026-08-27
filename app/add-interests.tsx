import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ONBOARDING_DIVIDER_MARGIN_TOP,
    ONBOARDING_H_PADDING,
    ONBOARDING_SUBTITLE_MARGIN_TOP,
    ONBOARDING_SUBTITLE_SIZE,
    ONBOARDING_TITLE_LETTER_SPACING,
    ONBOARDING_TITLE_LINE_HEIGHT,
    ONBOARDING_TITLE_SIZE,
    onboardingContentTopPadding,
} from "../constants/onboardingLayout";
import {
    ACCENT_BORDER,
    ACCENT_FILL,
    BG,
    BORDER,
    MUTED,
    PRIMARY_CTA_HEIGHT,
    PRIMARY_CTA_WIDTH,
    SURFACE_INPUT,
    TEXT,
    TYPE_LEAD,
    fonts,
    profileInterestPillText,
    profileInterestPillTextActive,
    synqOutlineAddBtn,
    synqOutlineAddBtnDisabled,
    synqOutlineAddBtnText,
    synqOutlineAddBtnTextDisabled,
} from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import { useAuthRefresh } from "./_layout";
import AlertModal from "./alert-modal";

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
            router.replace("/(auth)/invite-friends");
        } catch (e: any) {
            console.error(e);
            setAlertMessage("Could not save interests.");
            setAlertVisible(true);
            setLoading(false);
        }
    };

    const handleSkip = () => {
        refreshAuth();
        router.replace("/(auth)/invite-friends");
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
                activeOpacity={0.85}
                style={[
                    synqOutlineAddBtn,
                    styles.button,
                    !canContinue && synqOutlineAddBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
            >
                <Text
                    style={[
                        synqOutlineAddBtnText,
                        !canContinue && synqOutlineAddBtnTextDisabled,
                        loading && { opacity: 0.5 },
                    ]}
                >
                    Continue
                </Text>
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
        letterSpacing: ONBOARDING_TITLE_LETTER_SPACING,
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
        backgroundColor: SURFACE_INPUT,
        borderWidth: 1,
        borderColor: BORDER,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
    },
    pillOn: {
        backgroundColor: ACCENT_FILL,
        borderColor: ACCENT_BORDER,
    },
    pillText: profileInterestPillText,
    pillTextOn: profileInterestPillTextActive,

    button: {
        marginTop: 20,
        alignSelf: "center",
        width: PRIMARY_CTA_WIDTH,
        height: PRIMARY_CTA_HEIGHT,
        paddingVertical: 0,
        paddingHorizontal: 24,
    },
    skipButton: { marginTop: 20, alignSelf: "center" },
    skipText: {
        color: MUTED,
        fontSize: TYPE_LEAD,
        fontFamily: fonts.medium,
    },
});
