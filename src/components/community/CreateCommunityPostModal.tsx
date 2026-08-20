import AlertModal from "@/app/alert-modal";
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED2,
  MUTED3,
  OVERLAY_HEAVY,
  RADIUS_MD,
  SURFACE_INPUT,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
  fonts,
  formInputText,
  modalTitleText,
  synqOutlineAddBtn,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnText,
  synqOutlineAddBtnTextDisabled,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import {
  MAX_COMMUNITY_POST_BODY,
  MAX_COMMUNITY_POST_LINK,
} from "@/src/lib/communityPosts";
import { filterOrReject } from "@/src/lib/contentFilter";
import { useCallback, useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onCreate: (input: { body: string; linkUrl: string }) => Promise<void>;
};

function firestoreErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Please try again.";
  const message = err.message || "";
  if (/permission|insufficient/i.test(message)) {
    return "Couldn’t save this post. Deploy the latest Firestore rules, then try again.";
  }
  return message || "Please try again.";
}

export default function CreateCommunityPostModal({
  visible,
  busy,
  isAdmin,
  onClose,
  onCreate,
}: Props) {
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  useEffect(() => {
    if (!visible) {
      setBody("");
      setLinkUrl("");
      setSubmitting(false);
    }
  }, [visible]);

  const showError = useCallback((message: string) => {
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting || busy) return;
    Keyboard.dismiss();
    onClose();
  }, [busy, onClose, submitting]);

  const trimmedBody = body.trim();
  const isBusy = busy || submitting;
  const canPost = trimmedBody.length > 0 && !isBusy;

  const handleSubmit = async () => {
    if (!canPost) return;
    const bodyCheck = filterOrReject(trimmedBody);
    if (!bodyCheck.ok) {
      showError(bodyCheck.reason);
      return;
    }
    const linkTrimmed = linkUrl.trim();
    if (linkTrimmed) {
      const linkCheck = filterOrReject(linkTrimmed);
      if (!linkCheck.ok) {
        showError(linkCheck.reason);
        return;
      }
    }
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await onCreate({ body: trimmedBody, linkUrl: linkTrimmed });
    } catch (err: unknown) {
      showError(firestoreErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Dismiss"
          />
          <KeyboardAvoidingView
            style={styles.avoid}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
          >
            <View style={styles.card}>
              <View style={styles.header}>
                <Text style={styles.title}>New post</Text>
                <CloseButton onPress={handleClose} />
              </View>
              <Text style={styles.hint}>
                {isAdmin
                  ? "Posts created by an admin go live immediately."
                  : "Your post will be reviewed by the community admin before it appears."}
              </Text>
              <TextInput
                style={[styles.input, styles.bodyInput]}
                placeholder="Share a post with the community…"
                placeholderTextColor={MUTED3}
                value={body}
                onChangeText={setBody}
                maxLength={MAX_COMMUNITY_POST_BODY}
                multiline
                textAlignVertical="top"
                editable={!isBusy}
                autoFocus
              />
              <TextInput
                style={styles.input}
                placeholder="Link (optional)"
                placeholderTextColor={MUTED3}
                value={linkUrl}
                onChangeText={setLinkUrl}
                maxLength={MAX_COMMUNITY_POST_LINK}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!isBusy}
              />
              <TouchableOpacity
                style={[
                  synqOutlineAddBtn,
                  styles.submitBtn,
                  !canPost && synqOutlineAddBtnDisabled,
                ]}
                disabled={!canPost}
                onPress={() => void handleSubmit()}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={isAdmin ? "Post" : "Submit for approval"}
              >
                <Text
                  style={[
                    synqOutlineAddBtnText,
                    !canPost && synqOutlineAddBtnTextDisabled,
                  ]}
                >
                  {isBusy ? "Posting…" : isAdmin ? "Post" : "Submit for approval"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <AlertModal
        visible={alertVisible}
        title="Couldn't post"
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_HEAVY,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  avoid: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    ...modalTitleText,
    color: TEXT,
    flex: 1,
    letterSpacing: -0.2,
  },
  hint: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    lineHeight: 18,
  },
  input: {
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: SURFACE_INPUT,
    color: TEXT,
    ...formInputText,
    fontSize: TYPE_BODY,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  bodyInput: {
    minHeight: 120,
    paddingTop: 12,
  },
  submitBtn: {
    marginTop: 4,
    alignSelf: "center",
    minWidth: "56%",
  },
});
