import { formatVenueAddressDisplay } from "@/src/lib/helpers";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_MUTED,
  ACCENT_FILL_SUBTLE,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER,
  DESTRUCTIVE_FILL,
  MODAL_RADIUS,
  MUTED,
  ON_ACCENT_TEXT,
  OVERLAY_DARK,
  RADIUS_LG,
  SURFACE_SUBTLE,
  TEXT,
  TEXT_BRIGHT_HEX,
  TEXT_ON_BRIGHT,
  TYPE_CAPTION,
  TYPE_LEAD,
  TYPE_MICRO,
  TYPE_MODAL_TITLE,
  TYPE_SECTION,
  TYPE_SUBHEAD,
  TYPE_TITLE,
  cardMetaText,
  cardTitleText,
  emptyStateTitleText,
  fonts,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import {
    GROUP_BORDER,
    GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import { vibeCategoryImageUrl, vibeDisplayLabel } from "@/src/data/vibeCategoryImages";
import { SkeletonBlock } from "@/src/components/loading/BrandSkeletons";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    FlatList,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    FadeIn,
    interpolate,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const VIBES = [
    { label: "Drinks", display: "Drinks" },
    { label: "Dinner", display: "Dinner" },
    { label: "Coffee Spots", display: "Coffee" },
    { label: "Outdoors", display: "Outdoors" },
    { label: "Brunch", display: "Brunch" },
    { label: "Night out", display: "Night out" },
    { label: "Shopping", display: "Shopping" },
    { label: "Surprise Me", display: "Surprise me", featured: true },
];

const HERO_VIBES = VIBES.filter((v) => !v.featured);
const SURPRISE_VIBE = VIBES.find((v) => v.featured);

const GENERATING_LINE = "Finding the perfect spots nearby";

function GeneratingDot({ delay }: { delay: number }) {
    const reduced = useReducedMotion();
    const opacity = useSharedValue(0.2);

    useEffect(() => {
        if (reduced) {
            opacity.value = 0.45;
            return;
        }
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.2, { duration: delay }),
                withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.2, { duration: 520, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.2, { duration: 900 - delay })
            ),
            -1,
            false
        );
    }, [delay, opacity, reduced]);

    const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return <Animated.View style={[styles.generatingDot, style]} />;
}

function GeneratingStatus() {
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(reduced ? GENERATING_LINE : "");

    useEffect(() => {
        if (reduced) {
            setShown(GENERATING_LINE);
            return;
        }
        setShown("");
        let i = 0;
        const id = setInterval(() => {
            i += 1;
            setShown(GENERATING_LINE.slice(0, i));
            if (i >= GENERATING_LINE.length) clearInterval(id);
        }, 42);
        return () => clearInterval(id);
    }, [reduced]);

    const done = shown.length >= GENERATING_LINE.length;

    return (
        <View style={styles.generatingStatus}>
            <Text style={styles.generatingStatusText}>
                {shown}
                {done ? "" : " "}
            </Text>
            {done ? (
                <View style={styles.generatingDots}>
                    <GeneratingDot delay={0} />
                    <GeneratingDot delay={220} />
                    <GeneratingDot delay={440} />
                </View>
            ) : null}
        </View>
    );
}

function FindingMoveLoader({
    category,
    complete = false,
    onComplete,
}: {
    category: string;
    complete?: boolean;
    onComplete?: () => void;
}) {
    const reduced = useReducedMotion();
    const scan = useSharedValue(0);
    const progress = useSharedValue(0.06);
    const glow = useSharedValue(0.55);
    const finishedRef = useRef(false);

    useEffect(() => {
        if (reduced) {
            glow.value = 0.7;
            return;
        }
        scan.value = 0;
        scan.value = withRepeat(
            withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
            -1,
            false
        );
        glow.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
                withTiming(0.5, { duration: 1800, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );
    }, [glow, reduced, scan]);

    useEffect(() => {
        if (reduced) {
            progress.value = complete ? 1 : 0.42;
            return;
        }
        if (complete) {
            progress.value = withTiming(1, {
                duration: 320,
                easing: Easing.out(Easing.cubic),
            });
            return;
        }
        finishedRef.current = false;
        progress.value = 0.08;
        progress.value = withTiming(0.86, {
            duration: 24000,
            easing: Easing.out(Easing.quad),
        });
    }, [complete, progress, reduced]);

    useEffect(() => {
        if (!complete) return;
        const delay = reduced ? 0 : 360;
        const id = setTimeout(() => {
            if (finishedRef.current) return;
            finishedRef.current = true;
            onComplete?.();
        }, delay);
        return () => clearTimeout(id);
    }, [complete, onComplete, reduced]);

    const scanStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: interpolate(scan.value, [0, 1], [-120, 520]) }],
        opacity: reduced ? 0 : 1,
    }));
    const progressStyle = useAnimatedStyle(() => ({
        width: `${Math.max(8, Math.round(progress.value * 100))}%`,
    }));
    const glowStyle = useAnimatedStyle(() => ({
        opacity: glow.value,
    }));

    return (
        <View style={styles.ideaSkeletonList} accessibilityLabel={GENERATING_LINE}>
            <View style={styles.generatingCard}>
                <ExpoImage
                    source={{ uri: vibeCategoryImageUrl(category) }}
                    style={styles.featuredImage}
                    contentFit="cover"
                />
                <View style={styles.generatingDim} />
                {!reduced ? (
                    <Animated.View style={[styles.generatingScan, scanStyle]} pointerEvents="none">
                        <LinearGradient
                            colors={["transparent", "rgba(0,255,133,0.28)", "transparent"]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFill}
                        />
                    </Animated.View>
                ) : null}
                <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.82)"]}
                    locations={[0.35, 1]}
                    style={styles.featuredScrim}
                >
                    <Animated.View style={[styles.generatingBadge, glowStyle]}>
                        <Ionicons name="sparkles" size={12} color={ON_ACCENT_TEXT} />
                        <Text style={styles.generatingBadgeText}>Picking a spot</Text>
                    </Animated.View>
                    <GeneratingStatus />
                    <View style={styles.generatingTrack}>
                        <Animated.View style={[styles.generatingFill, progressStyle]} />
                    </View>
                </LinearGradient>
            </View>
            {Array.from({ length: 3 }).map((_, i) => (
                <Animated.View
                    key={i}
                    entering={reduced ? undefined : FadeIn.delay(280 + i * 220).duration(520)}
                    style={styles.ideaSkeletonRow}
                >
                    <View style={styles.ideaSkeletonCopy}>
                        <SkeletonBlock style={styles.ideaSkeletonTitle} />
                        <SkeletonBlock style={styles.ideaSkeletonMeta} />
                    </View>
                </Animated.View>
            ))}
        </View>
    );
}

const CONTENT_PAD_X = 20;
const NAV_SIDE = 44;

type Props = {
    visible: boolean;
    onClose: () => void;
    onBack: () => void;
    onSelectVibe: (label: string) => void;
    onShuffleOptions?: () => void;
    isAILoading: boolean;
    showOptionsList: boolean;
    aiOptions: any[];
    selectedOption: any;
    setSelectedOption: (item: any | null) => void;
    sendAISuggestionToChat: () => void;
    currentCategory: string;
    errorMessage?: string | null;
};

export default function ExploreModal({
    visible,
    onClose,
    onBack,
    onSelectVibe,
    onShuffleOptions,
    isAILoading,
    showOptionsList,
    aiOptions,
    selectedOption,
    setSelectedOption,
    sendAISuggestionToChat,
    currentCategory,
    errorMessage,
}: Props) {
    const insets = useSafeAreaInsets();
    const ideasPending = isAILoading && aiOptions.length === 0;
    const [showLoader, setShowLoader] = useState(false);
    const finishLoader = useCallback(() => setShowLoader(false), []);

    useEffect(() => {
        if (ideasPending) setShowLoader(true);
    }, [ideasPending]);

    useEffect(() => {
        if (!visible) setShowLoader(false);
    }, [visible]);

    if (!visible) return null;

    const dismissOverlay = () => {
        if (isAILoading) return;
        onClose();
    };

    const handleSelectVibe = (label: string) => {
        Keyboard.dismiss();
        onSelectVibe(label);
    };

    const featured = aiOptions[0];
    const rest = aiOptions.slice(1);
    const categoryLabel = vibeDisplayLabel(currentCategory);
    const showGenerating = ideasPending || showLoader;

    return (
        <View style={styles.overlay}>
            <Pressable style={styles.backdrop} onPress={dismissOverlay} accessibilityLabel="Close" />

            <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
                {errorMessage ? (
                    <View style={styles.errorBanner}>
                        <Ionicons name="alert-circle" size={20} color={DESTRUCTIVE} />
                        <Text style={styles.errorBannerText}>{errorMessage}</Text>
                        {!isAILoading && !showOptionsList ? (
                            <Text style={styles.errorHintText}>
                                Pick something below to try again.
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {!showOptionsList ? (
                    <View style={styles.pickerView}>
                        <View style={styles.pickerHeader}>
                            <View style={styles.pickerHeaderTop}>
                                <View style={styles.pickerHeaderCopy}>
                                    <Text style={styles.pickerTitle}>What are you down for?</Text>
                                </View>
                                <CloseButton onPress={onClose} style={styles.navIconBtn} />
                            </View>
                        </View>

                        <ScrollView
                            style={styles.pickerScroll}
                            contentContainerStyle={styles.pickerScrollContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            {SURPRISE_VIBE ? (
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    disabled={isAILoading}
                                    onPress={() => handleSelectVibe(SURPRISE_VIBE.label)}
                                    style={styles.surpriseHero}
                                    accessibilityRole="button"
                                    accessibilityLabel="Surprise me"
                                >
                                    <ExpoImage
                                        source={{ uri: vibeCategoryImageUrl(SURPRISE_VIBE.label) }}
                                        style={styles.surpriseHeroImage}
                                        contentFit="cover"
                                    />
                                    <LinearGradient
                                        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.78)"]}
                                        style={styles.surpriseHeroScrim}
                                    >
                                        <View style={styles.surpriseBadge}>
                                            <Ionicons name="sparkles" size={12} color={ON_ACCENT_TEXT} />
                                            <Text style={styles.surpriseBadgeText}>Let Synq pick</Text>
                                        </View>
                                        <Text style={styles.surpriseHeroTitle}>Surprise me</Text>
                                        <Text style={styles.surpriseHeroHint}>
                                            A mix based on this group
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ) : null}

                            <Text style={styles.sectionLabel}>Or pick a mood</Text>
                            <View style={styles.vibeGrid}>
                                {HERO_VIBES.map((item) => (
                                    <TouchableOpacity
                                        key={item.label}
                                        activeOpacity={0.88}
                                        disabled={isAILoading}
                                        onPress={() => handleSelectVibe(item.label)}
                                        style={styles.vibeTile}
                                        accessibilityRole="button"
                                        accessibilityLabel={item.display}
                                    >
                                        <ExpoImage
                                            source={{ uri: vibeCategoryImageUrl(item.label) }}
                                            style={styles.vibeTileImage}
                                            contentFit="cover"
                                        />
                                        <LinearGradient
                                            colors={["transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
                                            locations={[0.15, 0.55, 1]}
                                            style={styles.vibeTileScrim}
                                        >
                                            <Text style={styles.vibeTileLabel} numberOfLines={1}>
                                                {item.display}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.placesView}>
                        <View style={styles.placesHeader}>
                            <BackButton onPress={onBack} style={[styles.navIconBtn, styles.navIconBtnLeading]} />
                            <View style={styles.placesHeaderCopy}>
                                <Text style={styles.placesTitle} numberOfLines={1}>
                                    {categoryLabel}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.placesSection}>
                            {showGenerating ? (
                                <FindingMoveLoader
                                    category={currentCategory}
                                    complete={!ideasPending}
                                    onComplete={finishLoader}
                                />
                            ) : aiOptions.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateTitle}>No spots found</Text>
                                    <Text style={styles.emptyStateText}>
                                        Try something else or check back later.
                                    </Text>
                                </View>
                            ) : (
                                <FlatList
                                    style={styles.placesList}
                                    data={rest}
                                    keyExtractor={(item, index) =>
                                        `${item.name}-${item.address || item.location || index}`
                                    }
                                    contentContainerStyle={styles.bodyContent}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    ListHeaderComponent={
                                        featured ? (
                                            <View>
                                                <TouchableOpacity
                                                    activeOpacity={0.9}
                                                    style={[
                                                        styles.featuredCard,
                                                        selectedOption?.name === featured.name &&
                                                            styles.featuredCardSelected,
                                                    ]}
                                                    onPress={() =>
                                                        setSelectedOption(
                                                            selectedOption?.name === featured.name
                                                                ? null
                                                                : featured
                                                        )
                                                    }
                                                    accessibilityRole="radio"
                                                    accessibilityState={{
                                                        selected: selectedOption?.name === featured.name,
                                                    }}
                                                >
                                                    <ExpoImage
                                                        source={{
                                                            uri: vibeCategoryImageUrl(currentCategory),
                                                        }}
                                                        style={styles.featuredImage}
                                                        contentFit="cover"
                                                    />
                                                    <LinearGradient
                                                        colors={[
                                                            "transparent",
                                                            "rgba(0,0,0,0.55)",
                                                            "rgba(0,0,0,0.88)",
                                                        ]}
                                                        locations={[0.2, 0.55, 1]}
                                                        style={styles.featuredScrim}
                                                    >
                                                        <View style={styles.topPickBadge}>
                                                            <Text style={styles.topPickText}>Top pick</Text>
                                                        </View>
                                                        <Text style={styles.featuredName} numberOfLines={2}>
                                                            {featured.name}
                                                        </Text>
                                                        {featured.address || featured.location ? (
                                                            <Text style={styles.featuredAddress} numberOfLines={1}>
                                                                {formatVenueAddressDisplay(
                                                                    featured.address || featured.location || ""
                                                                )}
                                                            </Text>
                                                        ) : null}
                                                        {featured.why ? (
                                                            <Text style={styles.featuredWhy} numberOfLines={1}>
                                                                {featured.why}
                                                            </Text>
                                                        ) : null}
                                                    </LinearGradient>
                                                </TouchableOpacity>
                                                {rest.length > 0 ? (
                                                    <View style={styles.moreRow}>
                                                        <Text style={[styles.sectionLabel, styles.moreLabel]}>
                                                            More nearby
                                                        </Text>
                                                        {onShuffleOptions ? (
                                                            <TouchableOpacity
                                                                onPress={onShuffleOptions}
                                                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                                accessibilityRole="button"
                                                                accessibilityLabel="Shuffle"
                                                            >
                                                                <Ionicons name="shuffle" size={20} color={ACCENT} />
                                                            </TouchableOpacity>
                                                        ) : null}
                                                    </View>
                                                ) : null}
                                            </View>
                                        ) : null
                                    }
                                    renderItem={({ item }) => {
                                        const isSelected = selectedOption?.name === item.name;
                                        const address = formatVenueAddressDisplay(
                                            item.address || item.location || ""
                                        );
                                        return (
                                            <TouchableOpacity
                                                activeOpacity={0.85}
                                                style={[
                                                    styles.placeRow,
                                                    isSelected && styles.placeRowSelected,
                                                ]}
                                                onPress={() =>
                                                    setSelectedOption(isSelected ? null : item)
                                                }
                                                accessibilityRole="radio"
                                                accessibilityState={{ selected: isSelected }}
                                            >
                                                <View style={styles.placeCopy}>
                                                    <Text style={styles.placeName} numberOfLines={1}>
                                                        {item.name}
                                                    </Text>
                                                    <Text style={styles.placeWhy} numberOfLines={1}>
                                                        {address}
                                                    </Text>
                                                </View>
                                                {isSelected ? (
                                                    <Ionicons
                                                        name="checkmark-circle"
                                                        size={22}
                                                        color={ACCENT}
                                                    />
                                                ) : null}
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListFooterComponent={<View style={styles.listFooterSpacer} />}
                                />
                            )}
                        </View>

                        {!showGenerating && aiOptions.length > 0 ? (
                            <View style={[styles.footerDock, { paddingBottom: 12 }]}>
                                <TouchableOpacity
                                    style={[
                                        synqOutlineAddBtn,
                                        styles.sendBtn,
                                        !selectedOption && synqOutlineAddBtnDisabled,
                                    ]}
                                    disabled={!selectedOption}
                                    onPress={sendAISuggestionToChat}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityLabel="Send to chat"
                                >
                                    <Text
                                        style={[
                                            synqOutlineAddBtnText,
                                            !selectedOption && synqOutlineAddBtnTextDisabled,
                                        ]}
                                    >
                                        {selectedOption
                                            ? "Send to chat"
                                            : "Pick a spot and send it to the chat"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: OVERLAY_DARK,
    },
    panel: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        top: "10%",
        backgroundColor: BG,
        borderTopLeftRadius: MODAL_RADIUS + 8,
        borderTopRightRadius: MODAL_RADIUS + 8,
        overflow: "hidden",
        flexDirection: "column",
    },
    pickerView: {
        flex: 1,
        backgroundColor: BG,
    },
    pickerHeader: {
        paddingTop: 20,
        paddingHorizontal: CONTENT_PAD_X,
        paddingBottom: 12,
        gap: 12,
    },
    pickerHeaderTop: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    pickerHeaderCopy: {
        flex: 1,
        minWidth: 0,
        paddingTop: 6,
    },
    moodEyebrow: {
        color: ACCENT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MICRO,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        marginBottom: 6,
    },
    pickerTitle: {
        color: TEXT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_SECTION,
        lineHeight: 26,
        letterSpacing: 0.04,
    },
    pickerSubtitle: {
        ...cardMetaText,
        marginTop: 6,
        lineHeight: 18,
    },
    pickerScroll: {
        flex: 1,
        backgroundColor: BG,
    },
    pickerScrollContent: {
        paddingHorizontal: CONTENT_PAD_X,
        paddingBottom: 28,
    },
    surpriseHero: {
        height: 168,
        borderRadius: RADIUS_LG + 4,
        overflow: "hidden",
        backgroundColor: SURFACE_SUBTLE,
        marginBottom: 18,
    },
    surpriseHeroImage: {
        ...StyleSheet.absoluteFillObject,
    },
    surpriseHeroScrim: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "flex-end",
        padding: 16,
        gap: 6,
    },
    surpriseBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: ACCENT,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginBottom: 4,
    },
    surpriseBadgeText: {
        color: ON_ACCENT_TEXT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MICRO,
        letterSpacing: 0.4,
        textTransform: "uppercase",
    },
    surpriseHeroTitle: {
        color: TEXT_BRIGHT_HEX,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MODAL_TITLE,
        lineHeight: 26,
    },
    surpriseHeroHint: {
        color: TEXT_ON_BRIGHT,
        fontFamily: fonts.medium,
        fontSize: TYPE_LEAD,
    },
    sectionLabel: {
        color: MUTED,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MICRO,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 10,
    },
    vibeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    vibeTile: {
        width: "48%",
        flexGrow: 1,
        maxWidth: "48.5%",
        height: 92,
        borderRadius: RADIUS_LG,
        overflow: "hidden",
        backgroundColor: SURFACE_SUBTLE,
    },
    vibeTileImage: {
        ...StyleSheet.absoluteFillObject,
    },
    vibeTileScrim: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "flex-end",
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    vibeTileLabel: {
        color: TEXT_BRIGHT_HEX,
        fontFamily: fonts.heavy,
        fontSize: TYPE_LEAD,
        lineHeight: 18,
        letterSpacing: 0.04,
    },
    placesView: {
        flex: 1,
    },
    placesHeader: {
        flexDirection: "row",
        alignItems: "center",
        paddingTop: 18,
        paddingHorizontal: CONTENT_PAD_X,
        paddingBottom: 8,
        gap: 4,
    },
    placesHeaderCopy: {
        flex: 1,
        minWidth: 0,
        justifyContent: "center",
    },
    placesTitle: {
        color: TEXT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_SECTION,
        lineHeight: 24,
    },
    navIconBtn: {
        width: NAV_SIDE,
        height: NAV_SIDE,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
    },
    navIconBtnLeading: {
        marginLeft: -10,
    },
    placesSection: {
        flex: 1,
        paddingHorizontal: CONTENT_PAD_X,
    },
    placesList: {
        flex: 1,
    },
    bodyContent: {
        paddingBottom: 24,
        paddingTop: 6,
    },
    featuredCard: {
        height: 220,
        borderRadius: RADIUS_LG + 4,
        overflow: "hidden",
        backgroundColor: SURFACE_SUBTLE,
        marginBottom: 18,
        borderWidth: 1.5,
        borderColor: "transparent",
    },
    featuredCardSelected: {
        borderColor: ACCENT,
    },
    featuredImage: {
        ...StyleSheet.absoluteFillObject,
    },
    featuredScrim: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "flex-end",
        padding: 16,
        gap: 4,
    },
    topPickBadge: {
        alignSelf: "flex-start",
        backgroundColor: ACCENT,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 8,
    },
    topPickText: {
        color: ON_ACCENT_TEXT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MICRO,
        letterSpacing: 0.8,
        textTransform: "uppercase",
    },
    featuredName: {
        color: TEXT_BRIGHT_HEX,
        fontFamily: fonts.heavy,
        fontSize: TYPE_TITLE,
        lineHeight: 28,
    },
    featuredAddress: {
        color: TEXT_ON_BRIGHT,
        fontFamily: fonts.medium,
        fontSize: TYPE_LEAD,
        marginTop: 2,
    },
    featuredWhy: {
        color: ACCENT,
        fontFamily: fonts.medium,
        fontSize: TYPE_CAPTION,
        marginTop: 6,
    },
    moreRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    moreLabel: {
        marginBottom: 0,
    },
    placeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: GROUP_SURFACE,
        borderRadius: RADIUS_LG,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    placeRowSelected: {
        borderColor: ACCENT_BORDER,
        backgroundColor: ACCENT_FILL_MUTED,
    },
    placeCopy: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    placeName: {
        ...cardTitleText,
        fontSize: TYPE_SUBHEAD,
        lineHeight: 22,
    },
    placeWhy: {
        ...cardMetaText,
        lineHeight: 18,
    },
    listFooterSpacer: {
        height: 8,
    },
    generatingCard: {
        height: 220,
        borderRadius: RADIUS_LG + 4,
        overflow: "hidden",
        backgroundColor: SURFACE_SUBTLE,
        marginBottom: 18,
    },
    generatingDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.38)",
    },
    generatingScan: {
        position: "absolute",
        top: 0,
        bottom: 0,
        width: 96,
    },
    generatingBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: ACCENT,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginBottom: 10,
    },
    generatingBadgeText: {
        color: ON_ACCENT_TEXT,
        fontFamily: fonts.heavy,
        fontSize: TYPE_MICRO,
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    generatingStatus: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 22,
        marginBottom: 12,
    },
    generatingStatusText: {
        color: TEXT_BRIGHT_HEX,
        fontFamily: fonts.medium,
        fontSize: TYPE_LEAD,
        lineHeight: 20,
        letterSpacing: 0.2,
    },
    generatingDots: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginLeft: 8,
    },
    generatingDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: ACCENT,
    },
    generatingTrack: {
        height: 3,
        borderRadius: 99,
        backgroundColor: ACCENT_FILL_SUBTLE,
        overflow: "hidden",
    },
    generatingFill: {
        height: "100%",
        borderRadius: 99,
        backgroundColor: ACCENT,
    },
    ideaSkeletonList: {
        paddingTop: 6,
        paddingBottom: 16,
    },
    ideaSkeletonRow: {
        backgroundColor: GROUP_SURFACE,
        borderRadius: RADIUS_LG,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 10,
    },
    ideaSkeletonCopy: {
        gap: 8,
    },
    ideaSkeletonTitle: {
        width: "62%",
        height: 14,
        borderRadius: 7,
    },
    ideaSkeletonMeta: {
        width: "84%",
        height: 11,
        borderRadius: 6,
    },
    footerDock: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: BORDER,
        paddingTop: 14,
        paddingHorizontal: 20,
        backgroundColor: BG,
        alignItems: "center",
    },
    sendBtn: {
        alignSelf: "center",
        minHeight: 48,
        paddingHorizontal: 28,
    },
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingBottom: 48,
    },
    emptyStateTitle: {
        ...emptyStateTitleText,
        marginBottom: 8,
    },
    emptyStateText: {
        ...cardMetaText,
        textAlign: "center",
        lineHeight: 20,
    },
    errorBanner: {
        marginHorizontal: 20,
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: BUTTON_RADIUS,
        backgroundColor: DESTRUCTIVE_FILL,
        borderWidth: 1,
        borderColor: DESTRUCTIVE_BORDER,
        alignItems: "center",
        gap: 8,
    },
    errorBannerText: {
        color: DESTRUCTIVE,
        fontSize: TYPE_LEAD,
        fontFamily: fonts.medium,
        lineHeight: 20,
        textAlign: "center",
    },
    errorHintText: {
        color: DESTRUCTIVE,
        fontSize: TYPE_CAPTION,
        fontFamily: fonts.medium,
        textAlign: "center",
    },
});
