import { formatVenueAddressDisplay } from "@/src/lib/helpers";
import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_MUTED,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  DESTRUCTIVE_BORDER,
  DESTRUCTIVE_FILL,
  MODAL_RADIUS,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  OVERLAY_DARK,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
  RADIUS_LG,
  SURFACE_SUBTLE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_LEAD,
  TYPE_SUBHEAD,
  TYPE_TITLE,
  cardMetaText,
  cardTitleText,
  fonts,
  listRowTitleText,
  primaryButtonText,
  profileNameText,
  sheetTitleText,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import {
    GROUP_BORDER,
    GROUP_ROW_INSET,
    GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import { vibeCategoryImageUrl } from "@/src/data/vibeCategoryImages";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const VIBES = [
    { label: "Drinks", display: "Drinks" },
    { label: "Dinner", display: "Dinner" },
    { label: "Coffee Spots", display: "Coffee" },
    { label: "Outdoors", display: "Outdoors" },
    { label: "Surprise Me", display: "Surprise me", featured: true },
];

const HERO_VIBES = VIBES.filter((v) => !v.featured);
const SURPRISE_VIBE = VIBES.find((v) => v.featured);

function vibeDisplayLabel(label: string): string {
    return VIBES.find((v) => v.label === label)?.display ?? label;
}

const CONTENT_PAD_X = 20;
const NAV_SIDE = 44;
const VIBE_THUMB_SIZE = 44;

type Props = {
    visible: boolean;
    onClose: () => void;
    onBack: () => void;
    onSelectVibe: (label: string) => void;
    isAILoading: boolean;
    showOptionsList: boolean;
    aiOptions: any[];
    selectedOption: any;
    setSelectedOption: (item: any | null) => void;
    sendAISuggestionToChat: () => void;
    currentCategory: string;
    errorMessage?: string | null;
};

function SheetHeader({
    title,
    onClose,
    onBack,
    compact,
    hint,
}: {
    title: string;
    onClose?: () => void;
    onBack?: () => void;
    compact?: boolean;
    hint?: string;
}) {
    const showClose = !onBack && !!onClose;

    return (
        <View
            style={[
                styles.sheetHeader,
                compact && styles.sheetHeaderCompact,
                hint ? styles.sheetHeaderWithHint : null,
            ]}
        >
            <View style={[styles.headerRow, showClose && styles.headerRowWithClose]}>
                {onBack ? (
                    <BackButton onPress={onBack} style={[styles.navIconBtn, styles.navIconBtnLeading]} />
                ) : null}
                <View style={styles.headerTitleWrap}>
                    <Text
                        style={styles.headerTitle}
                        numberOfLines={showClose || onBack ? 1 : 2}
                    >
                        {title}
                    </Text>
                </View>
                {showClose ? (
                    <CloseButton onPress={onClose} style={[styles.navIconBtn, styles.navIconBtnTrailing]} />
                ) : null}
            </View>
            {hint ? <Text style={styles.sheetHint}>{hint}</Text> : null}
        </View>
    );
}

export default function ExploreModal({
    visible,
    onClose,
    onBack,
    onSelectVibe,
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

    if (!visible) return null;

    const dismissOverlay = () => {
        if (isAILoading) return;
        onClose();
    };

    const handleSelectVibe = (label: string) => {
        Keyboard.dismiss();
        onSelectVibe(label);
    };

    const renderVibeListRow = (item: (typeof VIBES)[number], showDivider: boolean) => (
        <React.Fragment key={item.label}>
            <TouchableOpacity
                activeOpacity={0.85}
                disabled={isAILoading}
                onPress={() => handleSelectVibe(item.label)}
                style={styles.vibeListRow}
            >
                <View style={styles.vibeListThumb}>
                    <ExpoImage
                        source={{ uri: vibeCategoryImageUrl(item.label) }}
                        style={styles.vibeListThumbImage}
                        contentFit="cover"
                        transition={120}
                    />
                </View>
                <Text style={styles.vibeListLabel} numberOfLines={1}>
                    {item.display}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={MUTED3} />
            </TouchableOpacity>
            {showDivider ? <View style={styles.vibeListDivider} /> : null}
        </React.Fragment>
    );

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
                                Pick a vibe below to try again.
                            </Text>
                        ) : null}
                    </View>
                ) : null}

                {!showOptionsList ? (
                    <View style={styles.pickerView}>
                        <SheetHeader title="Choose your vibe" onClose={onClose} />

                        <ScrollView
                            style={styles.pickerScroll}
                            contentContainerStyle={[
                                styles.pickerScrollContent,
                                { paddingBottom: 24 },
                            ]}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={[styles.vibePickerBlock, isAILoading && styles.vibeListLoading]}>
                                <View style={styles.vibeListSurface}>
                                    {HERO_VIBES.map((item, index) =>
                                        renderVibeListRow(item, index < HERO_VIBES.length - 1)
                                    )}
                                </View>

                                {SURPRISE_VIBE ? (
                                    <TouchableOpacity
                                        activeOpacity={0.92}
                                        disabled={isAILoading}
                                        onPress={() => handleSelectVibe(SURPRISE_VIBE.label)}
                                        style={styles.surprisePill}
                                    >
                                        <Ionicons name="sparkles" size={17} color={ACCENT} />
                                        <Text style={styles.surprisePillText}>
                                            {SURPRISE_VIBE.display}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            {isAILoading ? (
                                <View style={styles.loadingRow}>
                                    <ActivityIndicator size="small" color={ACCENT} />
                                    <Text style={styles.loadingText}>Finding spots…</Text>
                                </View>
                            ) : null}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.placesView}>
                        <View style={styles.placesHeaderBlock}>
                            <SheetHeader
                                title={vibeDisplayLabel(currentCategory)}
                                onBack={onBack}
                                compact
                                hint={
                                    aiOptions.length > 0
                                        ? "Select a spot and send it to the chat"
                                        : undefined
                                }
                            />
                        </View>

                        {aiOptions.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateTitle}>No spots found</Text>
                                <Text style={styles.emptyStateText}>
                                    Try another vibe or check back later.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                style={styles.placesList}
                                data={aiOptions}
                                keyExtractor={(item, index) =>
                                    `${item.name}-${item.address || item.location || index}`
                                }
                                contentContainerStyle={styles.bodyContent}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
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
                                        >
                                            <View style={styles.placeIconWrap}>
                                                <Ionicons
                                                    name="location-outline"
                                                    size={20}
                                                    color={MUTED2}
                                                />
                                            </View>
                                            <View style={styles.placeCopy}>
                                                <Text style={styles.placeName} numberOfLines={2}>
                                                    {item.name}
                                                </Text>
                                                {address ? (
                                                    <Text style={styles.placeAddress} numberOfLines={2}>
                                                        {address}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <View style={styles.placeCheckSlot}>
                                                {isSelected ? (
                                                    <Ionicons
                                                        name="checkmark-circle"
                                                        size={22}
                                                        color={ACCENT}
                                                    />
                                                ) : (
                                                    <View style={styles.placeCheckEmpty} />
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListFooterComponent={<View style={styles.listFooterSpacer} />}
                            />
                        )}

                        <View style={[styles.footerDock, { paddingBottom: 12 }]}>
                            <TouchableOpacity
                                style={[
                                    styles.sendBtn,
                                    !selectedOption && styles.sendBtnDisabled,
                                ]}
                                disabled={!selectedOption}
                                onPress={sendAISuggestionToChat}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.sendText}>Send idea</Text>
                            </TouchableOpacity>
                        </View>
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
        top: "14%",
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
    pickerScroll: {
        flex: 1,
        backgroundColor: BG,
    },
    pickerScrollContent: {
        flexGrow: 1,
        paddingHorizontal: CONTENT_PAD_X,
    },
    vibePickerBlock: {
        gap: 12,
        paddingTop: 2,
    },
    vibeListLoading: {
        opacity: 0.55,
    },
    vibeListSurface: {
        backgroundColor: GROUP_SURFACE,
        borderRadius: RADIUS_LG,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
        overflow: "hidden",
    },
    vibeListRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 16,
        backgroundColor: GROUP_SURFACE,
    },
    vibeListThumb: {
        width: VIBE_THUMB_SIZE,
        height: VIBE_THUMB_SIZE,
        borderRadius: VIBE_THUMB_SIZE / 2,
        overflow: "hidden",
        backgroundColor: SURFACE_SUBTLE,
        flexShrink: 0,
    },
    vibeListThumbImage: {
        width: VIBE_THUMB_SIZE,
        height: VIBE_THUMB_SIZE,
    },
    vibeListLabel: {
        ...listRowTitleText,
        flex: 1,
        minWidth: 0,
    },
    vibeListDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: GROUP_BORDER,
        marginLeft: GROUP_ROW_INSET,
    },
    surprisePill: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        borderRadius: RADIUS_LG,
        backgroundColor: GROUP_SURFACE,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
    },
    surprisePillText: {
        color: ACCENT,
        fontFamily: fonts.medium,
        fontSize: TYPE_BODY,
        letterSpacing: 0.04,
    },
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        marginTop: 24,
    },
    loadingText: {
        color: MUTED2,
        fontSize: TYPE_LEAD,
        fontFamily: fonts.medium,
    },
    sheetHeader: {
        paddingTop: 26,
        paddingBottom: 16,
    },
    sheetHeaderCompact: {
        paddingBottom: 0,
    },
    sheetHeaderWithHint: {
        paddingBottom: 12,
    },
    sheetHint: {
        ...cardMetaText,
        paddingHorizontal: CONTENT_PAD_X,
        marginTop: 6,
    },
    placesHeaderBlock: {
        paddingBottom: 14,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: CONTENT_PAD_X,
        gap: 4,
    },
    headerRowWithClose: {
        minHeight: NAV_SIDE,
    },
    navIconBtn: {
        width: NAV_SIDE,
        height: NAV_SIDE,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        alignSelf: "center",
    },
    navIconBtnLeading: {
        marginLeft: -10,
    },
    navIconBtnTrailing: {
        marginRight: -10,
    },
    headerTitleWrap: {
        flex: 1,
        minHeight: NAV_SIDE,
        justifyContent: "center",
        minWidth: 0,
    },
    headerTitle: {
        ...profileNameText,
        lineHeight: 32,
        letterSpacing: 0.15,
    },
    bodyContent: {
        paddingHorizontal: CONTENT_PAD_X,
        paddingBottom: 24,
    },
    placesView: {
        flex: 1,
    },
    placesList: {
        flex: 1,
    },
    placeRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: GROUP_SURFACE,
        borderRadius: RADIUS_LG,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 10,
    },
    placeRowSelected: {
        borderColor: ACCENT_BORDER,
        backgroundColor: ACCENT_FILL_MUTED,
    },
    placeIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: SURFACE_SUBTLE,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: GROUP_BORDER,
        alignItems: "center",
        justifyContent: "center",
    },
    placeCopy: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    placeName: {
        ...cardTitleText,
        fontSize: TYPE_SUBHEAD,
        lineHeight: 22,
    },
    placeAddress: {
        ...cardMetaText,
        lineHeight: 18,
    },
    placeCheckSlot: {
        width: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    placeCheckEmpty: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: MUTED3,
    },
    listFooterSpacer: {
        height: 8,
    },
    footerDock: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: BORDER,
        paddingTop: 14,
        paddingHorizontal: 20,
        backgroundColor: BG,
    },
    sendBtn: {
        alignSelf: "center",
        width: PRIMARY_CTA_WIDTH,
        height: PRIMARY_CTA_HEIGHT,
        backgroundColor: ACCENT,
        borderRadius: BUTTON_RADIUS,
        alignItems: "center",
        justifyContent: "center",
    },
    sendBtnDisabled: {
        opacity: 0.45,
    },
    sendText: primaryButtonText,
    emptyState: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 40,
        paddingBottom: 48,
    },
    emptyStateTitle: {
        ...sheetTitleText,
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
        borderRadius: 14,
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
