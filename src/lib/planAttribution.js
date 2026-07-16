const MAX_VISIBLE_GOING_NAMES = 3;

function firstNameFromDisplay(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Truncated "X, Y and N more are going" line for plan cards. */
function formatTruncatedGoingLine(names) {
  const firsts = Array.from(
    new Set(names.map(firstNameFromDisplay).filter(Boolean))
  );
  if (firsts.length === 0) return null;
  if (firsts.length === 1) return `${firsts[0]} is going`;
  if (firsts.length === 2) return `${firsts[0]} and ${firsts[1]} are going`;
  if (firsts.length === 3) {
    return `${firsts[0]}, ${firsts[1]} and ${firsts[2]} are going`;
  }
  const visible = firsts.slice(0, MAX_VISIBLE_GOING_NAMES);
  const remaining = firsts.length - MAX_VISIBLE_GOING_NAMES;
  return `${visible.join(", ")} and ${remaining} more are going`;
}

/** "You and X are going" when the viewer joined someone else's plan. */
function formatYouAndGoingLine(names) {
  const firsts = Array.from(
    new Set(names.map(firstNameFromDisplay).filter(Boolean))
  );
  if (firsts.length === 0) return "You are going";
  if (firsts.length === 1) return `You and ${firsts[0]} are going`;
  if (firsts.length === 2) return `You, ${firsts[0]} and ${firsts[1]} are going`;
  if (firsts.length === 3) {
    return `You, ${firsts[0]}, ${firsts[1]} and ${firsts[2]} are going`;
  }
  const visible = firsts.slice(0, MAX_VISIBLE_GOING_NAMES);
  const remaining = firsts.length - MAX_VISIBLE_GOING_NAMES;
  return `You, ${visible.join(", ")} and ${remaining} more are going`;
}

function collectJoinedIds(event) {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(event?.joinedFromIds) ? event.joinedFromIds : []),
        event?.joinedFromId,
      ]
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizePlanTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[`''']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function planLooseMatch(a, b) {
  const dateA = String(a?.date || "").trim();
  const dateB = String(b?.date || "").trim();
  if (!dateA || dateA !== dateB) return false;
  const titleA = normalizePlanTitle(a?.title);
  const titleB = normalizePlanTitle(b?.title);
  if (!titleA || !titleB) return false;
  return titleA === titleB;
}

function hasJoinMetadata(event, joinedIds = collectJoinedIds(event)) {
  return (
    joinedIds.length > 1 ||
    !!event?.joinedFromId ||
    !!event?.joinedFromName ||
    (Array.isArray(event?.joinedFromNames) && event.joinedFromNames.length > 0) ||
    !!event?.joinedFromFriendUid
  );
}

function findMatchingViewerEvent(event, viewerEvents) {
  if (!Array.isArray(viewerEvents)) return null;
  for (const row of viewerEvents) {
    if (planLooseMatch(row, event)) return row;
  }
  return null;
}

/**
 * Friend profiles can store a solo-shaped row for a plan the friend joined.
 * When the viewer is on the same plan, use their copy for attribution.
 */
function enrichEventForFriendProfileAttribution(
  event,
  viewerUid,
  profileSubjectUid,
  viewerEvents
) {
  const viewer = String(viewerUid || "").trim();
  const profileSubject = String(profileSubjectUid || "").trim();
  if (!profileSubject || profileSubject === viewer || !Array.isArray(viewerEvents)) {
    return event;
  }

  const viewerRow = findMatchingViewerEvent(event, viewerEvents);
  if (!viewerRow || !hasJoinMetadata(viewerRow)) return event;

  const profileJoinedIds = collectJoinedIds(event);
  const profileHost = resolveEffectiveHostUid(
    event,
    viewer,
    profileJoinedIds,
    profileSubject
  );
  const viewerHost = resolveEffectiveHostUid(
    viewerRow,
    viewer,
    collectJoinedIds(viewerRow),
    profileSubject
  );

  if (!viewerHost || viewerHost === profileSubject) return event;

  if (!hasJoinMetadata(event, profileJoinedIds)) {
    return viewerRow;
  }

  if (profileHost === profileSubject) {
    return viewerRow;
  }

  return event;
}

function displayNameForUid(uid, event, hostDisplayNameByUid) {
  const id = String(uid || "").trim();
  if (!id) return "";
  const fromFriends = String(hostDisplayNameByUid?.[id] || "").trim();
  if (fromFriends) return fromFriends;
  const fromEvent = String(event?.attendeeDisplayNames?.[id] || "").trim();
  if (fromEvent) return fromEvent;
  return "";
}

/**
 * When a plan is joined via a friend's profile, planHostUid can be stored as that
 * friend instead of the real host. Infer the true host from other attendees.
 */
function resolveEffectiveHostUid(event, viewerUid, joinedIds, profileSubjectUid) {
  const viewer = String(viewerUid || "").trim();
  const profileSubject = String(profileSubjectUid || "").trim();
  const storedHost = String(event?.planHostUid || "").trim();
  const anchorUid = String(
    event?.joinedFromFriendUid || event?.joinedFromId || ""
  ).trim();
  const joinedThrough = String(event?.joinedFromFriendUid || "").trim();

  // Viewing your own profile: keep yourself as host when planHostUid says so,
  // or when you created the plan before planHostUid existed.
  if (
    profileSubject &&
    profileSubject === viewer &&
    joinedIds.includes(profileSubject)
  ) {
    if (storedHost && storedHost === profileSubject) return storedHost;
    if (!storedHost) return profileSubject;
  }

  // Friend profile with multiple attendees but no host metadata: profile owner joined.
  if (
    profileSubject &&
    profileSubject !== viewer &&
    !storedHost &&
    !joinedThrough &&
    joinedIds.includes(profileSubject) &&
    joinedIds.length > 1
  ) {
    const others = joinedIds.filter((id) => id !== profileSubject);
    if (others.length === 1) return others[0];
  }

  // Friend profile: planHostUid can be wrongly stored as the profile owner instead of
  // the real host when they joined someone else's plan.
  if (
    !storedHost &&
    joinedThrough &&
    profileSubject &&
    joinedThrough === profileSubject &&
    profileSubject !== viewer
  ) {
    const hostCandidates = joinedIds.filter(
      (id) => id !== viewer && id !== profileSubject
    );
    if (hostCandidates.length === 1) return hostCandidates[0];
  }

  const othersExcludingHost = joinedIds.filter(
    (id) => id !== viewer && id !== storedHost && id !== joinedThrough
  );

  // Viewer's own calendar copy: joined through a friend who was wrongly stored as host.
  if (
    storedHost &&
    joinedThrough &&
    storedHost === joinedThrough &&
    profileSubject &&
    profileSubject === viewer &&
    !(storedHost === profileSubject) &&
    viewer &&
    joinedIds.includes(viewer) &&
    othersExcludingHost.length >= 1
  ) {
    const candidate =
      othersExcludingHost.find((id) => id !== viewer) || othersExcludingHost[0];
    if (candidate && candidate !== joinedThrough) return candidate;
  }

  if (storedHost && storedHost !== viewer) {
    if (storedHost !== anchorUid) return storedHost;

    const anchorOthers = joinedIds.filter((id) => id !== viewer && id !== anchorUid);
    if (anchorOthers.length === 0) return storedHost;
    if (
      profileSubject &&
      anchorOthers.length === 1 &&
      anchorOthers[0] === profileSubject
    ) {
      return storedHost;
    }
  }

  if (anchorUid && storedHost === anchorUid) {
    const anchorOthers = joinedIds.filter((id) => id !== viewer && id !== anchorUid);
    if (anchorOthers.length === 1) {
      if (profileSubject && anchorOthers[0] === profileSubject) return storedHost;
      // Profile owner created this plan; only treat anchor as wrong when they joined
      // via their own profile copy (joinedFromFriendUid points at themselves).
      if (
        profileSubject &&
        storedHost === profileSubject &&
        joinedThrough !== profileSubject
      ) {
        return storedHost;
      }
      return anchorOthers[0];
    }
    // Profile owner wrongly stored as host and join anchor; another attendee is the host.
    if (
      anchorOthers.length === 0 &&
      profileSubject &&
      storedHost === profileSubject &&
      joinedThrough === profileSubject
    ) {
      const outsiders = joinedIds.filter(
        (id) => id !== profileSubject && id !== viewer
      );
      if (outsiders.length === 1) return outsiders[0];
    }
  }

  if (
    joinedThrough &&
    joinedThrough !== viewer &&
    (!profileSubject || joinedThrough !== profileSubject) &&
    !(storedHost && profileSubject && storedHost === profileSubject)
  ) {
    return joinedThrough;
  }

  if (storedHost) return storedHost;
  if (joinedThrough) return joinedThrough;
  return anchorUid;
}

function resolveHostFirstName(event, hostUid, viewerUid, anchorUid, hostDisplayNameByUid) {
  const hostFull = displayNameForUid(hostUid, event, hostDisplayNameByUid);
  if (hostFull) return firstNameFromDisplay(hostFull);

  const rawNames = (
    Array.isArray(event?.joinedFromNames) && event.joinedFromNames.length > 0
      ? event.joinedFromNames
      : [event?.joinedFromName].filter(Boolean)
  ).map((n) => String(n || "").trim());

  const viewerFn = firstNameFromDisplay(
    displayNameForUid(viewerUid, event, hostDisplayNameByUid)
  );
  const anchorFn = firstNameFromDisplay(
    displayNameForUid(anchorUid, event, hostDisplayNameByUid)
  );

  for (const name of rawNames) {
    const fn = firstNameFromDisplay(name);
    if (!fn) continue;
    if (viewerFn && fn === viewerFn) continue;
    if (anchorFn && fn === anchorFn) continue;
    return fn;
  }

  return "Friend";
}

/**
 * Resolve host label and who's going for an open-plan card.
 * profileSubjectUid: whose plans are shown (friend profile) or viewer on Me tab.
 */
function resolvePlanAttribution(
  event,
  viewerUid,
  hostDisplayNameByUid = {},
  profileSubjectUid,
  viewerEvents
) {
  const profileSubject = String(profileSubjectUid || viewerUid || "").trim();
  const effectiveEvent = enrichEventForFriendProfileAttribution(
    event,
    viewerUid,
    profileSubject,
    viewerEvents
  );

  const joinedIds = collectJoinedIds(effectiveEvent);
  const hasMeta = hasJoinMetadata(effectiveEvent, joinedIds);
  const anchorUid = String(
    effectiveEvent?.joinedFromFriendUid || effectiveEvent?.joinedFromId || ""
  ).trim();
  let hostUid = resolveEffectiveHostUid(
    effectiveEvent,
    viewerUid,
    joinedIds,
    profileSubject
  );
  // Solo hosted plans often have no join metadata — still treat the stored host
  // (or profile owner) as the host so the going sheet is never empty.
  if (!hostUid && !hasMeta) {
    hostUid =
      String(effectiveEvent?.planHostUid || "").trim() || profileSubject || "";
  }
  const hostIsViewer = !!(hostUid && viewerUid && hostUid === viewerUid);
  const viewerKey = String(viewerUid || "").trim();
  const hostKey = String(hostUid || "").trim();

  if (!hasMeta && !hostKey) {
    return { primary: null, secondary: null, goingPeople: [] };
  }

  const personFromUid = (id) => {
    const displayName =
      displayNameForUid(id, effectiveEvent, hostDisplayNameByUid) || "Someone";
    return {
      userId: id,
      displayName,
      imageUrl: null,
    };
  };

  // Sheet lists everyone going except the viewer-as-attendee; host is always first.
  const goingPeople = [];
  if (hostKey) {
    goingPeople.push({ ...personFromUid(hostKey), isHost: true });
  }
  for (const id of joinedIds) {
    if (id === viewerKey || id === hostKey) continue;
    goingPeople.push(personFromUid(id));
  }

  const hostFn =
    hostUid && !hostIsViewer
      ? resolveHostFirstName(
          effectiveEvent,
          hostUid,
          viewerUid,
          anchorUid,
          hostDisplayNameByUid
        )
      : null;

  // Legacy / incomplete rows: names without matching uids still belong on the list.
  const coveredNames = new Set(
    goingPeople.map((p) => String(p.displayName || "").trim().toLowerCase()).filter(Boolean)
  );
  const viewerName = String(
    displayNameForUid(viewerKey, effectiveEvent, hostDisplayNameByUid) || ""
  )
    .trim()
    .toLowerCase();
  const hostName = String(
    displayNameForUid(hostKey, effectiveEvent, hostDisplayNameByUid) || ""
  )
    .trim()
    .toLowerCase();
  const rawNames = (
    Array.isArray(effectiveEvent?.joinedFromNames) && effectiveEvent.joinedFromNames.length > 0
      ? effectiveEvent.joinedFromNames
      : [effectiveEvent?.joinedFromName].filter(Boolean)
  )
    .map((n) => String(n || "").trim())
    .filter(Boolean);

  for (const name of rawNames) {
    const key = name.toLowerCase();
    if (!key || coveredNames.has(key)) continue;
    if (key === viewerName || key === hostName) continue;
    if (hostFn && firstNameFromDisplay(name).toLowerCase() === String(hostFn).toLowerCase()) {
      continue;
    }
    const someoneIdx = goingPeople.findIndex(
      (p) => !p.isHost && String(p.displayName || "").trim().toLowerCase() === "someone"
    );
    if (someoneIdx >= 0) {
      goingPeople[someoneIdx] = {
        ...goingPeople[someoneIdx],
        displayName: name,
      };
      coveredNames.add(key);
      coveredNames.delete("someone");
      continue;
    }
    goingPeople.push({
      userId: null,
      displayName: name,
      imageUrl: null,
    });
    coveredNames.add(key);
  }

  // Card subtitle still omits the host (already shown as "X's plan").
  const othersFirsts = Array.from(
    new Set(
      goingPeople
        .filter((p) => !p.isHost)
        .map((p) => firstNameFromDisplay(p.displayName))
        .filter(Boolean)
    )
  );

  const viewerAttending = !!(
    viewerUid &&
    joinedIds.includes(String(viewerUid).trim()) &&
    !hostIsViewer
  );

  const primary =
    hostIsViewer || !hostUid ? null : hostFn ? `${hostFn}'s plan` : null;
  const secondary = viewerAttending
    ? othersFirsts.length > 0
      ? formatYouAndGoingLine(othersFirsts)
      : null
    : othersFirsts.length > 0
      ? formatTruncatedGoingLine(othersFirsts)
      : null;

  return { primary, secondary, goingPeople };
}

/** Pick the real plan host when joining from a friend's profile. */
function resolvePlanHostUidForJoin(event, profileFriendUid) {
  const fk = String(profileFriendUid || "").trim();
  const stored = String(event?.planHostUid || "").trim();
  const joinedThrough = String(event?.joinedFromFriendUid || "").trim();

  if (stored && stored !== fk) return stored;
  if (joinedThrough && joinedThrough !== fk) return joinedThrough;

  const ids = collectJoinedIds(event);
  const otherIds = ids.filter((id) => id !== fk);
  if (otherIds.length === 1) return otherIds[0];

  return stored || fk;
}

/**
 * Merge two plan rows so going lists include every attendee id/name from either copy
 * (host roster is often richer than a joiner's optimistic copy).
 */
function mergeEventsForGoingAttribution(primary, secondary) {
  if (!secondary) return primary;
  if (!primary) return secondary;

  const ids = Array.from(
    new Set([...collectJoinedIds(primary), ...collectJoinedIds(secondary)])
  );
  const names = Array.from(
    new Set(
      [
        ...(Array.isArray(primary?.joinedFromNames) ? primary.joinedFromNames : []),
        ...(Array.isArray(secondary?.joinedFromNames) ? secondary.joinedFromNames : []),
        primary?.joinedFromName,
        secondary?.joinedFromName,
      ]
        .map((n) => String(n || "").trim())
        .filter(Boolean)
    )
  );

  return {
    ...primary,
    planHostUid: primary.planHostUid || secondary.planHostUid,
    joinedFromFriendUid: primary.joinedFromFriendUid || secondary.joinedFromFriendUid,
    joinedFromIds: ids,
    joinedFromId: primary.joinedFromId || secondary.joinedFromId || ids[0] || "",
    joinedFromNames: names,
    joinedFromName: names.join(", "),
    attendeeDisplayNames: {
      ...(typeof secondary.attendeeDisplayNames === "object" && secondary.attendeeDisplayNames
        ? secondary.attendeeDisplayNames
        : {}),
      ...(typeof primary.attendeeDisplayNames === "object" && primary.attendeeDisplayNames
        ? primary.attendeeDisplayNames
        : {}),
    },
  };
}

module.exports = {
  collectJoinedIds,
  resolveEffectiveHostUid,
  resolvePlanAttribution,
  resolvePlanHostUidForJoin,
  planLooseMatch,
  enrichEventForFriendProfileAttribution,
  mergeEventsForGoingAttribution,
};
