import {
  ACCENT,
  ACCENT_BORDER,
  ACCENT_FILL_SUBTLE,
  BG,
  BORDER,
  BORDER_SOFT,
  BUTTON_RADIUS,
  MODAL_RADIUS,
  MUTED2,
  MUTED3,
  ON_ACCENT_TEXT,
  OVERLAY_HEAVY,
  PLACEHOLDER_DARK,
  PRIMARY_CTA_WIDTH,
  RADIUS_LG,
  SURFACE_DEEP,
  SURFACE_DEEPER,
  TEXT,
  TEXT_MUTED_DARK,
  TEXT_MUTED_LIGHT,
  TYPE_BODY,
  TYPE_BUTTON,
  TYPE_CAPTION,
  TYPE_FINE,
  TYPE_LEAD,
  TYPE_MICRO,
  TYPE_NANO,
  TYPE_SECTION,
  cardMetaText,
  cardTitleText,
  fonts,
  modalTitleText,
  profileScreenSectionTitle,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import {
  GROUP_BORDER,
  GROUP_SURFACE,
} from "@/src/components/friends/groupsListStyles";
import PlanDateCalendar from "@/src/components/PlanDateCalendar";
import PlanGoingPeopleSheet, {
  type PlanGoingPerson,
} from "@/src/components/plans/PlanGoingPeopleSheet";
import PlanInviteFriendsSheet, {
  type PlanInviteFriend,
} from "@/src/components/plans/PlanInviteFriendsSheet";
import PlanTimePicker from "@/src/components/PlanTimePicker";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import { resolvePlanAttribution } from "@/src/lib/planAttribution";
import {
  canEditOpenPlan,
  collectPlanInterestedFriendIds,
  filterOutPastOpenPlans,
  formatPlanTimeForStorage,
  parseOpenPlanDateTime,
  sortOpenPlansByDateTime,
} from "@/src/lib/planEvents";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  InteractionManager,
  Keyboard,
  type KeyboardEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AlertModal from "./alert-modal";
import ConfirmModal from "./confirm-modal";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  joinedFromId?: string;
  joinedFromIds?: string[];
  joinedFromName?: string;
  joinedFromNames?: string[];
  joinedFromFriendUid?: string;
  planHostUid?: string;
  attendeeDisplayNames?: Record<string, string>;
  planInvitedIds?: string[];
};

type Props = {
  ACCENT: string;
  showEventModal: boolean;
  setShowEventModal: (val: boolean) => void;
  newEvent: { title: string; date: string; time: string; location: string };
  setNewEvent: React.Dispatch<any>;
  saveEvent: (event?: any) => void | Promise<boolean>;
  updateEvent: (
    id: string,
    fields: { title: string; date: string; time: string; location: string },
    options?: { inviteFriendIds?: string[]; uninviteFriendIds?: string[] }
  ) => void | Promise<boolean>;
  deleteEvent: (id: string) => void;
  events: EventItem[];
  viewerUid?: string;
  hostDisplayNameByUid?: Record<string, string>;
  highlightEventId?: string | null;
  friends?: PlanInviteFriend[];
  onPlanInvited?: (eventId: string, friendIds: string[]) => void;
  onPlanUninvited?: (eventId: string, friendId: string) => void;
};

const getInitialDate = () => {
  const d = new Date();
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
};

const EMPTY_PLAN_INVITED_IDS: string[] = [];

export default function OpenPlans({
  ACCENT,
  showEventModal,
  setShowEventModal,
  newEvent,
  setNewEvent,
  saveEvent,
  updateEvent,
  deleteEvent,
  events,
  viewerUid = "",
  hostDisplayNameByUid = {},
  highlightEventId = null,
  friends = [],
  onPlanInvited,
  onPlanUninvited,
}: Props) {
  const insets = useSafeAreaInsets();
  const modalMaxHeight = useMemo(() => {
    const windowH = Dimensions.get("window").height;
    return windowH - insets.top - insets.bottom - 24;
  }, [insets.top, insets.bottom]);

  const friendById = useMemo(() => {
    const map = new Map<string, PlanInviteFriend>();
    for (const friend of friends) {
      if (friend.id) map.set(friend.id, friend);
    }
    return map;
  }, [friends]);

  const planAttributionLines = (event: EventItem) => {
    const { primary, secondary, goingPeople } = resolvePlanAttribution(
      event,
      viewerUid,
      hostDisplayNameByUid,
      viewerUid
    );
    const peopleWithAvatars = goingPeople.map((person) => ({
      ...person,
      imageUrl: person.userId ? friendById.get(person.userId)?.imageurl || null : null,
    }));
    return { primary, secondary, goingPeople: peopleWithAvatars };
  };
  const [goingPeopleSheet, setGoingPeopleSheet] = useState<{
    planTitle: string;
    people: PlanGoingPerson[];
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<EventItem | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [draftPlanId, setDraftPlanId] = useState<string | null>(null);
  const [createInviteFriendIds, setCreateInviteFriendIds] = useState<string[]>([]);
  const [editInviteFriendIds, setEditInviteFriendIds] = useState<string[]>([]);
  const [editUninviteFriendIds, setEditUninviteFriendIds] = useState<string[]>([]);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const isEditing = !!editingEvent;
  const activePlanId = isEditing ? editingEvent?.id : draftPlanId;
  const canInviteToPlan =
    !!activePlanId &&
    friends.length > 0 &&
    (isEditing
      ? canEditOpenPlan(editingEvent!, viewerUid)
      : true);
  const savedPlanInvitedIds = useMemo((): string[] => {
    if (!isEditing) return EMPTY_PLAN_INVITED_IDS;
    const raw = !editingEvent?.id
      ? editingEvent?.planInvitedIds
      : events.find(
          (e) => String(e.id || "").trim() === String(editingEvent.id || "").trim()
        )?.planInvitedIds ?? editingEvent.planInvitedIds;
    if (!Array.isArray(raw) || raw.length === 0) return EMPTY_PLAN_INVITED_IDS;
    return raw.map((id) => String(id || "").trim()).filter(Boolean);
  }, [events, editingEvent, isEditing]);
  const displayedSavedInvitedIds = useMemo((): string[] => {
    if (!isEditing || savedPlanInvitedIds.length === 0) return savedPlanInvitedIds;
    if (editUninviteFriendIds.length === 0) return savedPlanInvitedIds;
    const revoke = new Set(editUninviteFriendIds);
    return savedPlanInvitedIds.filter((id) => !revoke.has(id));
  }, [isEditing, savedPlanInvitedIds, editUninviteFriendIds]);
  const pendingInviteFriendIds = isEditing ? editInviteFriendIds : createInviteFriendIds;
  const planInterestedIds = useMemo((): string[] => {
    const event = editingEvent?.id
      ? events.find((e) => e.id === editingEvent.id) ?? editingEvent
      : editingEvent;
    if (!event) return EMPTY_PLAN_INVITED_IDS;
    const ids = collectPlanInterestedFriendIds(event, viewerUid);
    return ids.length > 0 ? ids : EMPTY_PLAN_INVITED_IDS;
  }, [events, editingEvent, viewerUid]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const planScrollRef = useRef<ScrollView>(null);
  const locationInputRef = useRef<TextInput>(null);
  const inviteAlertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minimumSelectableDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    if (!showEventModal) return;

    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardInset(0);

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showEventModal]);

  const visibleEvents = useMemo(() => filterOutPastOpenPlans(events), [events]);

  const openAddModal = () => {
    setEditingEvent(null);
    setDraftPlanId(String(Date.now()));
    setCreateInviteFriendIds([]);
    setEditInviteFriendIds([]);
    setEditUninviteFriendIds([]);
    setSelectedDate(getInitialDate());
    setActivePicker(null);
    setInviteSheetVisible(false);
    setNewEvent({ title: "", date: "", time: "", location: "" });
    setKeyboardInset(0);
    setShowEventModal(true);
  };

  const openEditModal = (event: EventItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (inviteAlertTimerRef.current) {
      clearTimeout(inviteAlertTimerRef.current);
      inviteAlertTimerRef.current = null;
    }
    setAlertVisible(false);
    setDraftPlanId(null);
    setCreateInviteFriendIds([]);
    setEditInviteFriendIds([]);
    setEditUninviteFriendIds([]);
    setEditingEvent(event);
    setSelectedDate(parseOpenPlanDateTime(event.date, event.time));
    setActivePicker(null);
    setInviteSheetVisible(false);
    setNewEvent({
      title: event.title,
      date: event.date,
      time: event.time || "",
      location: event.location || "",
    });
    setKeyboardInset(0);
    setShowEventModal(true);
  };

  const resetPlanEditorState = useCallback(() => {
    if (inviteAlertTimerRef.current) {
      clearTimeout(inviteAlertTimerRef.current);
      inviteAlertTimerRef.current = null;
    }
    Keyboard.dismiss();
    setActivePicker(null);
    setEditingEvent(null);
    setDraftPlanId(null);
    setCreateInviteFriendIds([]);
    setEditInviteFriendIds([]);
    setEditUninviteFriendIds([]);
    setInviteSheetVisible(false);
    setKeyboardInset(0);
    setAlertVisible(false);
    setShowEventModal(false);
  }, [setShowEventModal]);

  useEffect(() => {
    if (showEventModal) return;
    setInviteSheetVisible(false);
    setActivePicker(null);
    setEditingEvent(null);
    setDraftPlanId(null);
    setCreateInviteFriendIds([]);
    setEditInviteFriendIds([]);
    setEditUninviteFriendIds([]);
    setKeyboardInset(0);
  }, [showEventModal]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        resetPlanEditorState();
      };
    }, [resetPlanEditorState])
  );

  useEffect(() => {
    return () => {
      if (inviteAlertTimerRef.current) {
        clearTimeout(inviteAlertTimerRef.current);
        inviteAlertTimerRef.current = null;
      }
    };
  }, []);

  const closeModal = () => {
    if (inviteSheetVisible) {
      setInviteSheetVisible(false);
      return;
    }
    resetPlanEditorState();
  };

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const scheduleInviteAlert = useCallback((title: string, message: string) => {
    if (inviteAlertTimerRef.current) {
      clearTimeout(inviteAlertTimerRef.current);
    }
    InteractionManager.runAfterInteractions(() => {
      inviteAlertTimerRef.current = setTimeout(() => {
        inviteAlertTimerRef.current = null;
        showAlert(title, message);
      }, 400);
    });
  }, []);

  const handlePlanInvited = useCallback(
    (friendIds: string[]) => {
      const eventId = activePlanId;
      if (!eventId || friendIds.length === 0) return;
      const addPending = (prev: string[]) => {
        const next = new Set(prev);
        friendIds.forEach((id) => {
          const uid = String(id || "").trim();
          if (uid) next.add(uid);
        });
        return [...next];
      };
      if (isEditing) {
        setEditInviteFriendIds(addPending);
        setEditUninviteFriendIds((prev) =>
          prev.filter((id) => !friendIds.map((f) => String(f || "").trim()).includes(id))
        );
      } else {
        setCreateInviteFriendIds(addPending);
      }
      setInviteSheetVisible(false);
    },
    [activePlanId, isEditing]
  );

  const handlePlanUninvited = useCallback(
    (friendId: string) => {
      const eventId = activePlanId;
      const uid = String(friendId || "").trim();
      if (!eventId || !uid) return;
      if (isEditing) {
        if (editInviteFriendIds.includes(uid)) {
          setEditInviteFriendIds((prev) => prev.filter((id) => id !== uid));
          return;
        }
        if (savedPlanInvitedIds.includes(uid)) {
          setEditUninviteFriendIds((prev) =>
            prev.includes(uid) ? prev : [...prev, uid]
          );
        }
        return;
      }
      setCreateInviteFriendIds((prev) => prev.filter((id) => id !== uid));
    },
    [activePlanId, isEditing, editInviteFriendIds, savedPlanInvitedIds]
  );

  const handleInviteError = (message: string) => {
    scheduleInviteAlert("Could not invite", message);
  };

  const handleBackdropPress = () => {
    if (inviteSheetVisible) {
      setInviteSheetVisible(false);
      return;
    }
    if (keyboardInset > 0) {
      Keyboard.dismiss();
      return;
    }
    if (activePicker) {
      setActivePicker(null);
      return;
    }
    closeModal();
  };

  const openInviteSheet = () => {
    Keyboard.dismiss();
    setActivePicker(null);
    setKeyboardInset(0);
    setInviteSheetVisible(true);
  };

  const dismissPickers = () => setActivePicker(null);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const collapseActivePicker = () => {
    Keyboard.dismiss();
    if (activePicker) setActivePicker(null);
  };

  const togglePicker = (picker: "date" | "time") => {
    Keyboard.dismiss();
    setActivePicker((p) => (p === picker ? null : picker));
  };

  const handleCalendarSelect = (d: Date) => {
    setDate(d);
    setActivePicker(null);
  };

  const handleTimeChange = useCallback((d: Date) => {
    setSelectedDate(d);
  }, []);

  const isPlanDirty = useMemo(() => {
    if (!isEditing || !editingEvent) return true;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const localDate = `${year}-${month}-${day}`;
    const storedTime = editingEvent.time
      ? formatPlanTimeForStorage(
          parseOpenPlanDateTime(editingEvent.date, editingEvent.time)
        )
      : "";
    return (
      newEvent.title.trim() !== editingEvent.title.trim() ||
      localDate !== editingEvent.date ||
      formatPlanTimeForStorage(selectedDate) !== storedTime ||
      (newEvent.location || "").trim() !== (editingEvent.location || "").trim() ||
      editInviteFriendIds.length > 0 ||
      editUninviteFriendIds.length > 0
    );
  }, [isEditing, editingEvent, newEvent, selectedDate, editInviteFriendIds, editUninviteFriendIds]);

  const canPost =
    newEvent.title.trim().length > 0 && (!isEditing || isPlanDirty);

  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d); 
  };

  const setDate = (base: Date) => {
    const d = new Date(base);
    d.setHours(selectedDate.getHours());
    d.setMinutes(selectedDate.getMinutes());
    setSelectedDate(d);
  };

  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const todayRef = new Date();
  const tomorrowRef = new Date(Date.now() + 86400000);
  const isToday = isSameCalendarDay(selectedDate, todayRef);
  const isTomorrow = isSameCalendarDay(selectedDate, tomorrowRef);
  const isCustomDate = !isToday && !isTomorrow;

  const formatPlanDateLabel = (d: Date) => {
    if (isSameCalendarDay(d, todayRef)) return "Today";
    if (isSameCalendarDay(d, tomorrowRef)) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleSave = async () => {
    if (!canPost) return;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const localDate = `${year}-${month}-${day}`;
    const payload = {
      ...newEvent,
      date: localDate,
      time: formatPlanTimeForStorage(selectedDate),
    };

    let ok = false;
    if (isEditing && editingEvent?.id) {
      ok =
        (await updateEvent(editingEvent.id, payload, {
          inviteFriendIds: editInviteFriendIds,
          uninviteFriendIds: editUninviteFriendIds,
        })) !== false;
    } else {
      ok =
        (await saveEvent({
          ...payload,
          id: draftPlanId || undefined,
          inviteFriendIds: createInviteFriendIds,
        })) !== false;
    }

    if (ok) resetPlanEditorState();
  };

  const handleDelete = (event: EventItem) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDeleteEvent(event);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Your plans</Text>

      <View style={styles.plansBox}>
      {!visibleEvents.length && (
        <Text style={styles.empty}>Nothing planned… yet 👀</Text>
      )}

      {sortOpenPlansByDateTime(visibleEvents).map((p, index, arr) => {
          const isLast = index === arr.length - 1;
          const d = parseDate(p.date);
          const isOwnPlan = canEditOpenPlan(p, viewerUid);
          const { primary: hostLine, secondary: othersLine, goingPeople } =
            planAttributionLines(p);
          const isHighlighted =
            !!highlightEventId && String(p.id) === String(highlightEventId);

          return (
            <View
              key={p.id}
              style={[
                styles.card,
                isHighlighted && styles.cardHighlighted,
                isLast && { marginBottom: 0 },
              ]}
              accessibilityLabel={
                isOwnPlan
                  ? `Your plan, ${p.title}`
                  : `${hostLine || "Joined plan"}, ${p.title}`
              }
            >
              <View style={styles.cardMain}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateWeekday}>
                    {d
                      .toLocaleDateString("en-US", { weekday: "short" })
                      .toUpperCase()}
                  </Text>
                  <Text style={styles.dateNumber}>{d.getDate()}</Text>
                  <Text style={styles.dateMonth}>
                    {d
                      .toLocaleDateString("en-US", { month: "short" })
                      .toUpperCase()}
                  </Text>
                </View>

                <View style={styles.planBody}>
                  <View style={styles.planHeaderRow}>
                    <Text style={styles.title} numberOfLines={2}>
                      {p.title}
                    </Text>
                    <View style={styles.cardActions}>
                      {isOwnPlan ? (
                        <>
                          <Pressable
                            onPress={() => openEditModal(p)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${p.title}`}
                          >
                            <Text style={styles.actionEditText}>Edit</Text>
                          </Pressable>
                          <Text style={styles.actionSep}>·</Text>
                          <Pressable
                            onPress={() => handleDelete(p)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${p.title}`}
                          >
                            <Text style={styles.actionDeleteText}>Delete</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          onPress={() => handleDelete(p)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${p.title} from your plans`}
                        >
                          <Text style={styles.actionRemoveText}>Remove</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                  {(p.time || p.location) ? (
                    <Text style={styles.meta} numberOfLines={1}>
                      {[p.time, p.location].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}
                  {!isOwnPlan && hostLine ? (
                    <Text style={styles.hostLine} numberOfLines={1}>
                      {hostLine}
                    </Text>
                  ) : null}
                  {othersLine && goingPeople.length > 0 ? (
                    <Pressable
                      onPress={() =>
                        setGoingPeopleSheet({
                          planTitle: p.title,
                          people: goingPeople,
                        })
                      }
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      accessibilityRole="button"
                      accessibilityLabel="See everyone going to this plan"
                      style={styles.goingPressable}
                    >
                      <Text style={styles.goingText}>
                        {othersLine}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.addBtnRow}>
        <SynqPlusAddButton
          onPress={openAddModal}
          accessibilityLabel="Add plan"
          style={styles.addBtnSpacing}
        />
      </View>

      {showEventModal ? (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View
          style={[
            styles.popupOverlay,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Close plan editor"
          />
          <View
            style={[
              styles.popupAvoid,
              { maxHeight: modalMaxHeight },
              keyboardInset > 0 ? { marginBottom: keyboardInset } : null,
            ]}
            pointerEvents={inviteSheetVisible ? "none" : "box-none"}
          >
            <View style={[styles.popupCard, { maxHeight: modalMaxHeight }]}>
              <TouchableWithoutFeedback
                onPress={dismissKeyboard}
                accessible={false}
              >
                <View>
                  <View style={styles.popupTitleRow}>
                    <Text style={styles.popupTitle}>
                      {isEditing ? "Edit plan" : "Add a plan"}
                    </Text>
                    <CloseButton onPress={closeModal} accessibilityLabel="Close" />
                  </View>
                </View>
              </TouchableWithoutFeedback>

              <ScrollView
                ref={planScrollRef}
                style={styles.popupScroll}
                contentContainerStyle={styles.popupScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
              >
              <TouchableWithoutFeedback
                onPress={dismissKeyboard}
                accessible={false}
              >
              <View>
              <TextInput
                placeholder="What's the plan?"
                placeholderTextColor={PLACEHOLDER_DARK}
                style={styles.planInput}
                value={newEvent.title}
                onFocus={dismissPickers}
                onChangeText={(t) =>
                  setNewEvent((p: any) => ({ ...p, title: t }))
                }
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <View style={styles.scheduleBlock}>
                <TouchableWithoutFeedback onPress={collapseActivePicker}>
                  <View>
                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity
                        style={[
                          styles.dateTimeField,
                          activePicker === "date" && styles.dateTimeFieldActive,
                        ]}
                        onPress={() => togglePicker("date")}
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={activePicker === "date" ? ACCENT : TEXT_MUTED_LIGHT}
                        />
                        <View style={styles.dateTimeTextWrap}>
                          <Text style={styles.dateTimeValue}>
                            {formatPlanDateLabel(selectedDate)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dateTimeField,
                          activePicker === "time" && styles.dateTimeFieldActive,
                        ]}
                        onPress={() => togglePicker("time")}
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={activePicker === "time" ? ACCENT : TEXT_MUTED_LIGHT}
                        />
                        <View style={styles.dateTimeTextWrap}>
                          <Text style={styles.dateTimeValue}>
                            {formatPlanTimeForStorage(selectedDate)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </View>

              {activePicker === "date" ? (
                <View style={styles.calendarWrap}>
                  <PlanDateCalendar
                    value={selectedDate}
                    minimumDate={minimumSelectableDate}
                    accentColor={ACCENT}
                    onChange={handleCalendarSelect}
                  />
                </View>
              ) : null}

              {activePicker === "time" ? (
                <PlanTimePicker
                  value={selectedDate}
                  accentColor={ACCENT}
                  onChange={handleTimeChange}
                />
              ) : null}

              <View style={styles.locationFieldWrap}>
                <TextInput
                  ref={locationInputRef}
                  placeholder="Add location"
                  placeholderTextColor={PLACEHOLDER_DARK}
                  style={styles.planInputSecondary}
                  value={newEvent.location}
                  onFocus={dismissPickers}
                  onChangeText={(t) =>
                    setNewEvent((p: any) => ({ ...p, location: t }))
                  }
                  returnKeyType="done"
                />
              </View>

              {canInviteToPlan ? (
                <TouchableOpacity
                  style={styles.inviteFriendsBtn}
                  onPress={openInviteSheet}
                  accessibilityRole="button"
                  accessibilityLabel="Invite friends to this plan"
                >
                  <Ionicons name="person-add-outline" size={18} color={ACCENT} />
                  <Text style={styles.inviteFriendsBtnText}>
                    {pendingInviteFriendIds.length > 0
                      ? `Invite friends (${pendingInviteFriendIds.length})`
                      : "Invite friends"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.popupPostBtn, !canPost && styles.popupPostBtnDisabled]}
                disabled={!canPost}
                onPress={() => void handleSave()}
              >
                <Text style={styles.popupPostBtnText}>
                  {isEditing ? "Save" : "Post"}
                </Text>
              </TouchableOpacity>
              </View>
              </TouchableWithoutFeedback>
              </ScrollView>
            </View>
          </View>

          {inviteSheetVisible ? (
            <PlanInviteFriendsSheet
              embedded
              visible
              friends={friends}
              eventId={activePlanId || ""}
              planTitle={editingEvent?.title || newEvent.title}
              alreadyInvitedIds={displayedSavedInvitedIds}
              pendingInviteIds={pendingInviteFriendIds}
              alreadyInterestedIds={planInterestedIds}
              deferInviteSend
              onClose={() => setInviteSheetVisible(false)}
              onInvited={handlePlanInvited}
              onUninvited={handlePlanUninvited}
              onError={handleInviteError}
            />
          ) : null}
        </View>
      </Modal>
      ) : null}

      {alertVisible ? (
        <AlertModal
          visible
          title={alertTitle}
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      ) : null}

      <PlanGoingPeopleSheet
        visible={!!goingPeopleSheet}
        planTitle={goingPeopleSheet?.planTitle}
        people={goingPeopleSheet?.people ?? []}
        onClose={() => setGoingPeopleSheet(null)}
        onPressPerson={(person) => {
          if (!person.userId || person.userId === viewerUid) return;
          setGoingPeopleSheet(null);
          router.push({
            pathname: "/friend-profile",
            params: { friendId: person.userId },
          });
        }}
      />

      {pendingDeleteEvent ? (
      <ConfirmModal
        visible
        title={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? "Remove this plan?"
            : "Delete plan"
        }
        message={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? ""
            : "This deletes the plan for you and anyone who joined."
        }
        confirmText={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? "Remove"
            : "Delete"
        }
        destructive
        onCancel={() => setPendingDeleteEvent(null)}
        onConfirm={() => {
          if (pendingDeleteEvent?.id) deleteEvent(pendingDeleteEvent.id);
          setPendingDeleteEvent(null);
        }}
      />
      ) : null}
    </View>
  );
}

const DateBtn = ({
  label,
  onPress,
  selected,
  accentColor,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  accentColor: string;
}) => (
  <TouchableOpacity
    style={[
      styles.dateBtn,
      selected && {
        borderColor: accentColor,
        backgroundColor: `${accentColor}22`,
      },
    ]}
    onPress={onPress}
  >
    <Text
      style={{
        color: selected ? accentColor : "white",
        fontSize: TYPE_LEAD,
        fontFamily: fonts.medium,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { width: "100%", alignSelf: "stretch" },
  sectionTitle: profileScreenSectionTitle,
  plansBox: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: "flex-start",
    width: "100%",
  },
  empty: {
    color: TEXT_MUTED_DARK,
    marginBottom: 0,
    fontSize: TYPE_CAPTION,
    lineHeight: 18,
    textAlign: "left",
    alignSelf: "stretch",
  },
  card: {
    alignSelf: "stretch",
    width: "100%",
    maxWidth: 340,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    backgroundColor: GROUP_SURFACE,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHighlighted: {
    borderColor: ACCENT_BORDER,
    borderWidth: 1,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateBlock: {
    width: 40,
    alignItems: "center",
    marginRight: 10,
  },
  dateWeekday: {
    color: MUTED3,
    fontSize: TYPE_NANO,
    fontFamily: fonts.medium,
    letterSpacing: 0.5,
  },
  dateNumber: {
    color: TEXT,
    fontSize: TYPE_SECTION,
    fontFamily: fonts.heavy,
    lineHeight: 22,
    letterSpacing: -0.5,
    marginTop: 1,
  },
  dateMonth: {
    color: MUTED3,
    fontSize: TYPE_NANO,
    fontFamily: fonts.medium,
    letterSpacing: 0.4,
    marginTop: 1,
  },
  planBody: {
    flex: 1,
    minWidth: 0,
  },
  planHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    paddingTop: 1,
  },
  actionSep: {
    color: MUTED3,
    fontSize: TYPE_MICRO,
    marginHorizontal: 4,
  },
  actionEditText: {
    color: MUTED2,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
  },
  actionDeleteText: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
  },
  actionRemoveText: {
    color: MUTED3,
    fontSize: TYPE_FINE,
    fontFamily: fonts.medium,
  },
  title: {
    flex: 1,
    minWidth: 0,
    ...cardTitleText,
  },
  meta: {
    ...cardMetaText,
    marginTop: 2,
    lineHeight: 16,
  },
  hostLine: {
    color: MUTED3,
    marginTop: 3,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 0.1,
  },
  goingPressable: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  goingText: {
    color: ACCENT,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.medium,
    letterSpacing: 0.05,
    lineHeight: 15,
  },
  addBtnRow: {
    width: "100%",
    alignItems: "flex-start",
  },
  addBtnSpacing: { marginTop: 16, marginBottom: 8 },
  popupOverlay: {
    flex: 1,
    backgroundColor: OVERLAY_HEAVY,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popupAvoid: {
    width: "100%",
    maxWidth: 400,
  },
  popupCard: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  popupScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  popupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  popupTitle: {
    ...modalTitleText,
    flex: 1,
    letterSpacing: -0.2,
  },
  popupScrollContent: {
    paddingBottom: 4,
  },
  popupPostBtn: {
    marginTop: 14,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: 50,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  popupPostBtnDisabled: {
    opacity: 0.4,
  },
  popupPostBtnText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
  },
  calendarWrap: {
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  planInput: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    padding: 14,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    marginBottom: 10,
  },
  locationFieldWrap: {
    marginTop: 10,
  },
  inviteFriendsBtn: {
    marginTop: 12,
    marginBottom: 4,
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: BUTTON_RADIUS,
    borderWidth: 1,
    borderColor: ACCENT_BORDER,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  inviteFriendsBtnText: {
    color: ACCENT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.heavy,
  },
  planInputSecondary: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    padding: 12,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.medium,
    marginBottom: 0,
  },
  scheduleBlock: {
    backgroundColor: SURFACE_DEEP,
    borderWidth: 1,
    borderColor: GROUP_BORDER,
    borderRadius: BUTTON_RADIUS,
    padding: 10,
    marginBottom: 10,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  dateTimeField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE_DEEPER,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateTimeFieldActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT_FILL_SUBTLE,
  },
  dateTimeTextWrap: { flex: 1 },
  dateTimeValue: {
    color: TEXT,
    fontSize: TYPE_BUTTON,
    fontFamily: fonts.heavy,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: SURFACE_DEEPER,
  },
  month: {
    color: TEXT_MUTED_LIGHT,
    fontSize: TYPE_MICRO,
    fontFamily: fonts.heavy,
    letterSpacing: 0.4,
    width: "100%",
    textAlign: "center",
  },
});