import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MUTED2,
  ON_ACCENT_TEXT,
  SURFACE_INPUT,
  TEXT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_SUBHEAD,
  fonts,
  stackScreenHeaderTitle,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnTextCompact,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { SkeletonBlock } from "@/src/components/loading/BrandSkeletons";
import { fetchOrCreateInviteCode } from "@/src/lib/inviteCode";
import {
  findFriendsFromContacts,
  getCachedContactsMatch,
  hydrateContactsMatchCache,
  shouldSoftRefreshContactsMatch,
  type ContactInvitee,
  type ContactMatchUser,
} from "@/src/lib/matchContacts";
import { buildProfileShareWebUrl } from "@/src/lib/profileShareUrl";
import { shareProfileLink } from "@/src/lib/shareProfileCard";
import { resolveAvatar } from "@/src/lib/helpers";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Linking,
  Modal,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FriendAction = "friends" | "pending" | "incoming" | "add";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onAddFriend: (user: ContactMatchUser) => void;
  onAcceptIncoming?: (user: ContactMatchUser) => void;
  getFriendAction: (userId: string) => FriendAction;
};

type Section =
  | { title: "On Synq"; data: ContactMatchUser[]; kind: "match" }
  | { title: "Invite to Synq"; data: ContactInvitee[]; kind: "invite" };

type RowItem = ContactMatchUser | ContactInvitee;

export default function FindFromContactsModal({
  visible,
  onClose,
  onOpenProfile,
  onAddFriend,
  onAcceptIncoming,
  getFriendAction,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [matches, setMatches] = useState<ContactMatchUser[]>([]);
  const [invitees, setInvitees] = useState<ContactInvitee[]>([]);
  const [invitingKey, setInvitingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const softRefreshGenRef = useRef(0);

  const applyResult = useCallback((result: {
    matches: ContactMatchUser[];
    invitees: ContactInvitee[];
    permission: string;
    warning?: string;
  }, opts?: { quiet?: boolean }) => {
    if (result.permission !== "granted") {
      setPermissionDenied(true);
      if (!hasLoadedOnceRef.current) {
        setMatches([]);
        setInvitees([]);
      }
      return;
    }
    setPermissionDenied(false);
    setMatches(result.matches);
    setInvitees(result.invitees);
    hasLoadedOnceRef.current = true;
    if (result.warning && !opts?.quiet) setError(result.warning);
  }, []);

  const softRefresh = useCallback(async () => {
    const gen = ++softRefreshGenRef.current;
    try {
      const result = await findFriendsFromContacts({ force: true });
      if (gen !== softRefreshGenRef.current) return;
      // Keep showing cache if matching failed (rate limit, etc.).
      if (result.warning) return;
      applyResult(result, { quiet: true });
      setError(null);
    } catch {
      // Quiet refresh — leave cached list as-is.
    }
  }, [applyResult]);

  const runMatch = useCallback(async (force = false) => {
    if (!force) {
      let cached = getCachedContactsMatch();
      if (!cached) {
        cached = await hydrateContactsMatchCache();
      }
      if (cached) {
        setError(null);
        applyResult(cached, { quiet: true });
        setLoading(false);
        if (shouldSoftRefreshContactsMatch()) {
          void softRefresh();
        }
        return;
      }
    }

    const showFullLoading = force || !hasLoadedOnceRef.current;
    if (showFullLoading) setLoading(true);
    setError(null);
    setPermissionDenied(false);
    try {
      const result = await findFriendsFromContacts({ force });
      applyResult(result);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not read contacts right now. Please try again.";
      setError(message);
      if (!hasLoadedOnceRef.current) {
        setMatches([]);
        setInvitees([]);
      }
    } finally {
      setLoading(false);
    }
  }, [applyResult, softRefresh]);

  useEffect(() => {
    if (!visible) {
      setInvitingKey(null);
      softRefreshGenRef.current += 1;
      return;
    }
    void runMatch(false);
  }, [visible, runMatch]);

  const openSystemSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      try {
        await Linking.openURL("app-settings:");
      } catch {
        // Device may not support deep-linking into Settings.
      }
    }
  }, []);

  const handleInvite = useCallback(async (invitee: ContactInvitee) => {
    if (invitingKey) return;
    setInvitingKey(invitee.key);
    try {
      const code = await fetchOrCreateInviteCode();
      const shareUrl = buildProfileShareWebUrl(code);
      if (!shareUrl) {
        setError("We couldn't generate your invite link. Try again in a moment.");
        return;
      }
      await shareProfileLink(shareUrl);
    } catch {
      setError("Could not open the share sheet. Please try again.");
    } finally {
      setInvitingKey(null);
    }
  }, [invitingKey]);

  const sections: Section[] = [];
  if (matches.length) {
    sections.push({ title: "On Synq", data: matches, kind: "match" });
  }
  if (invitees.length) {
    sections.push({ title: "Invite to Synq", data: invitees, kind: "invite" });
  }

  const renderMatchRow = (item: ContactMatchUser) => {
    const action = getFriendAction(item.id);
    let label = "Add";
    let disabled = false;
    let onPress: (() => void) | undefined = () => onAddFriend(item);
    if (action === "friends") {
      label = "Friends";
      disabled = true;
      onPress = undefined;
    } else if (action === "pending") {
      label = "Pending";
      disabled = true;
      onPress = undefined;
    } else if (action === "incoming") {
      label = "Accept";
      onPress = () => onAcceptIncoming?.(item);
    }

    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.rowMain}
          onPress={() => onOpenProfile(item.id)}
          activeOpacity={0.8}
        >
          <ExpoImage
            source={{ uri: resolveAvatar(item.imageurl) }}
            style={styles.avatar}
            cachePolicy="memory-disk"
          />
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>
              {item.displayName || "User"}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[synqOutlineAddBtnCompact, disabled && synqOutlineAddBtnDisabled]}
          disabled={disabled || !onPress}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <Text
            style={[
              synqOutlineAddBtnTextCompact,
              disabled && synqOutlineAddBtnTextDisabled,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderInviteRow = (item: ContactInvitee) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person-outline" size={18} color={MUTED2} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={[synqOutlineAddBtnCompact, invitingKey === item.key && synqOutlineAddBtnDisabled]}
        disabled={invitingKey === item.key}
        onPress={() => void handleInvite(item)}
        activeOpacity={0.85}
      >
        <Text
          style={[
            synqOutlineAddBtnTextCompact,
            invitingKey === item.key && synqOutlineAddBtnTextDisabled,
          ]}
        >
          {invitingKey === item.key ? "…" : "Invite"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Find from contacts</Text>
          <CloseButton onPress={onClose} accessibilityLabel="Close contacts finder" />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <SkeletonBlock style={styles.loadingSkeleton} />
            <Text style={styles.hint}>Looking for friends on Synq…</Text>
          </View>
        ) : permissionDenied ? (
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={36} color={MUTED2} />
            <Text style={styles.emptyTitle}>Contacts access needed</Text>
            <Text style={styles.hint}>
              Allow contacts access so Synq can show who&apos;s already here and help you invite
              others.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => void openSystemSettings()}
              accessibilityRole="button"
              accessibilityLabel="Open Settings"
            >
              <Text style={styles.primaryBtnText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : error && sections.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Something went wrong</Text>
            <Text style={styles.hint}>{error}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => void runMatch(true)}>
              <Text style={styles.primaryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={36} color={MUTED2} />
            <Text style={styles.emptyTitle}>No contacts found</Text>
            <Text style={styles.hint}>
              Add phone contacts on your device, then come back to find friends on Synq.
            </Text>
          </View>
        ) : (
          <SectionList<RowItem, Section>
            sections={sections}
            keyExtractor={(item) => ("id" in item ? item.id : item.key)}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item, section }) =>
              section.kind === "match"
                ? renderMatchRow(item as ContactMatchUser)
                : renderInviteRow(item as ContactInvitee)
            }
            ListHeaderComponent={
              error ? <Text style={styles.listError}>{error}</Text> : null
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: {
    ...stackScreenHeaderTitle,
    flex: 1,
    marginRight: 12,
    lineHeight: 30,
    includeFontPadding: false,
  },
  listContent: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_INPUT,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SURFACE_INPUT,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
  },
  loadingSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  emptyTitle: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: TYPE_SUBHEAD,
    textAlign: "center",
  },
  hint: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    textAlign: "center",
    lineHeight: 18,
  },
  listError: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    marginBottom: 8,
  },
  primaryBtn: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 22,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BUTTON,
    color: ON_ACCENT_TEXT,
  },
});
