const {
  resolveEffectiveHostUid,
  resolvePlanAttribution,
  resolvePlanHostUidForJoin,
  mergeEventsForGoingAttribution,
} = require("../src/lib/planAttribution.js");

describe("planAttribution", () => {
  test("resolvePlanHostUidForJoin uses joinedFromFriendUid over profile friend", () => {
    expect(
      resolvePlanHostUidForJoin(
        {
          joinedFromFriendUid: "shawn",
          joinedFromIds: ["shawn", "elliott"],
        },
        "elliott"
      )
    ).toBe("shawn");
  });

  test("resolvePlanHostUidForJoin keeps host when rejoining from host profile with another attendee", () => {
    expect(
      resolvePlanHostUidForJoin(
        {
          planHostUid: "stefanie",
          joinedFromIds: ["stefanie", "william"],
        },
        "stefanie"
      )
    ).toBe("stefanie");
  });

  test("resolveEffectiveHostUid fixes host stored as profile anchor", () => {
    expect(
      resolveEffectiveHostUid(
        {
          planHostUid: "elliott",
          joinedFromFriendUid: "elliott",
          joinedFromId: "elliott",
        },
        "viewer",
        ["shawn", "elliott", "viewer"],
        "viewer"
      )
    ).toBe("shawn");
  });

  test("Blake and Sloane both keep Stefanie as host when both joined her plan", () => {
    const event = {
      planHostUid: "stefanie",
      joinedFromFriendUid: "stefanie",
      joinedFromId: "stefanie",
      joinedFromIds: ["stefanie", "sloane", "blake"],
      attendeeDisplayNames: {
        stefanie: "Stefanie Baarman",
        sloane: "Sloane Whitaker",
        blake: "Blake Reilly",
      },
    };
    const ids = ["stefanie", "sloane", "blake"];
    const names = {
      stefanie: "Stefanie Baarman",
      sloane: "Sloane Whitaker",
      blake: "Blake Reilly",
    };

    expect(resolveEffectiveHostUid(event, "blake", ids, "blake")).toBe("stefanie");
    expect(resolveEffectiveHostUid(event, "sloane", ids, "sloane")).toBe("stefanie");
    expect(resolveEffectiveHostUid(event, "blake", ids, "sloane")).toBe("stefanie");
    expect(resolveEffectiveHostUid(event, "sloane", ids, "blake")).toBe("stefanie");

    expect(resolvePlanAttribution(event, "blake", names, "blake").primary).toBe(
      "Stefanie's plan"
    );
    expect(resolvePlanAttribution(event, "sloane", names, "sloane").primary).toBe(
      "Stefanie's plan"
    );
  });

  test("keeps Shawn as host on Elliott profile when Elliott is attending", () => {
    expect(
      resolveEffectiveHostUid(
        {
          planHostUid: "shawn",
          joinedFromFriendUid: "shawn",
          joinedFromId: "shawn",
        },
        "viewer",
        ["shawn", "elliott"],
        "elliott"
      )
    ).toBe("shawn");
  });

  test("shows Shawns plan and Elliott going for third-party join", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        joinedFromFriendUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["shawn", "elliott", "viewer"],
        joinedFromNames: ["Shawn", "Elliott", "Me"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
          viewer: "Me",
        },
      },
      "viewer",
      { elliott: "Elliott" },
      "viewer"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("You and Elliott are going");
    expect(result.goingPeople.map((p) => p.displayName)).toEqual([
      "Shawn",
      "Elliott",
      "Me",
    ]);
    expect(result.goingPeople[0].isHost).toBe(true);
    expect(result.goingPeople[1].isHost).toBeFalsy();
  });

  test("shows Shawns plan on Elliott friend profile", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "shawn",
        joinedFromFriendUid: "shawn",
        joinedFromIds: ["shawn", "elliott"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
        },
      },
      "viewer",
      { shawn: "Shawn", elliott: "Elliott" },
      "elliott"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("Elliott is going");
  });

  test("host sees joiner going on own profile after friend joins", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "stefanie",
        joinedFromFriendUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["stefanie", "elliott"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          stefanie: "Stefanie",
          elliott: "Elliott",
        },
      },
      "stefanie",
      { elliott: "Elliott" },
      "stefanie"
    );

    expect(result.primary).toBeNull();
    expect(result.secondary).toBe("Elliott is going");
  });

  test("shows Shawns plan on Elliott profile after third party joins via Elliott", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        joinedFromFriendUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["shawn", "elliott", "viewer"],
        joinedFromNames: ["Shawn", "Me"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
          viewer: "Me",
        },
      },
      "viewer",
      { elliott: "Elliott" },
      "elliott"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("You and Elliott are going");
  });

  test("shows you and the host when viewer joined a solo friend plan", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        joinedFromFriendUid: "elliott",
        joinedFromIds: ["elliott", "viewer"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          elliott: "Elliott",
          viewer: "Me",
        },
      },
      "viewer",
      { elliott: "Elliott" },
      "viewer"
    );

    expect(result.primary).toBe("Elliott's plan");
    expect(result.secondary).toBeNull();
  });

  test("shows Shawns plan on Elliott profile without planHostUid", () => {
    const result = resolvePlanAttribution(
      {
        joinedFromFriendUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["shawn", "elliott", "viewer"],
        joinedFromNames: ["Shawn", "Me"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
          viewer: "Me",
        },
      },
      "viewer",
      { elliott: "Elliott" },
      "elliott"
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("You and Elliott are going");
  });

  test("shows Elliott's plan on Elliott profile when Priscilla joined", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        joinedFromId: "elliott",
        joinedFromIds: ["elliott", "priscilla"],
        joinedFromNames: ["Priscilla"],
        attendeeDisplayNames: {
          elliott: "Elliott",
          priscilla: "Priscilla",
        },
      },
      "viewer",
      { elliott: "Elliott", priscilla: "Priscilla" },
      "elliott"
    );

    expect(result.primary).toBe("Elliott's plan");
    expect(result.secondary).toBe("Priscilla is going");
  });

  test("shows Priscilla's plan on Priscilla profile when Elliott joined", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "priscilla",
        joinedFromId: "priscilla",
        joinedFromIds: ["priscilla", "elliott"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          elliott: "Elliott",
          priscilla: "Priscilla",
        },
      },
      "viewer",
      { elliott: "Elliott", priscilla: "Priscilla" },
      "priscilla"
    );

    expect(result.primary).toBe("Priscilla's plan");
    expect(result.secondary).toBe("Elliott is going");
  });

  test("shows Stefanie's plan when viewing Elliott's profile", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "stefanie",
        joinedFromFriendUid: "stefanie",
        joinedFromId: "stefanie",
        joinedFromIds: ["stefanie", "elliott"],
        joinedFromNames: ["Stefanie", "Elliott"],
        attendeeDisplayNames: {
          stefanie: "Stefanie",
          elliott: "Elliott",
        },
      },
      "stefanie",
      { stefanie: "Stefanie", elliott: "Elliott" },
      "elliott"
    );

    // Host is the viewer — card shows "Your plan" pill instead of a name line.
    expect(result.primary).toBeNull();
    expect(result.secondary).toBe("Elliott is going");
  });

  test("does not steal host to the only other attendee when planHostUid is set", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "stefanie",
        joinedFromFriendUid: "stefanie",
        joinedFromId: "stefanie",
        joinedFromIds: ["stefanie", "william"],
        joinedFromNames: ["Stefanie Baarman", "William Waller"],
        attendeeDisplayNames: {
          stefanie: "Stefanie Baarman",
          william: "William Waller",
          blake: "Blake Reilly",
        },
      },
      "stefanie",
      {
        stefanie: "Stefanie Baarman",
        william: "William Waller",
        blake: "Blake Reilly",
      },
      "blake"
    );

    expect(result.primary).toBeNull();
    expect(resolveEffectiveHostUid(
      {
        planHostUid: "stefanie",
        joinedFromFriendUid: "stefanie",
        joinedFromIds: ["stefanie", "william"],
      },
      "stefanie",
      ["stefanie", "william"],
      "blake"
    )).toBe("stefanie");
  });

  test("mergeEventsForGoingAttribution prefers via when hosts disagree", () => {
    const merged = mergeEventsForGoingAttribution(
      {
        planHostUid: "william",
        joinedFromFriendUid: "stefanie",
        joinedFromIds: ["stefanie", "william", "blake"],
      },
      {
        planHostUid: "stefanie",
        joinedFromIds: ["stefanie", "william", "blake"],
      }
    );
    expect(merged.planHostUid).toBe("stefanie");
  });

  test("going sheet does not list combined joinedFromName strings as people", () => {
    const result = resolvePlanAttribution(
      mergeEventsForGoingAttribution(
        {
          planHostUid: "stefanie",
          joinedFromFriendUid: "stefanie",
          joinedFromIds: ["stefanie", "william", "blake"],
          joinedFromNames: ["Stefanie Baarman", "William Waller"],
          joinedFromName: "Stefanie Baarman, William Waller",
          attendeeDisplayNames: {
            stefanie: "Stefanie Baarman",
            william: "William Waller",
            blake: "Blake Reilly",
          },
        },
        {
          planHostUid: "stefanie",
          joinedFromIds: ["stefanie", "william", "blake"],
          joinedFromNames: ["William Waller", "Blake Reilly"],
          joinedFromName: "William Waller, Blake Reilly",
          attendeeDisplayNames: {
            stefanie: "Stefanie Baarman",
            william: "William Waller",
            blake: "Blake Reilly",
          },
        }
      ),
      "stefanie",
      {
        stefanie: "Stefanie Baarman",
        william: "William Waller",
        blake: "Blake Reilly",
      },
      "blake"
    );

    expect(result.goingPeople.map((p) => p.displayName)).toEqual([
      "Stefanie Baarman",
      "William Waller",
      "Blake Reilly",
    ]);
    expect(result.goingPeople.every((p) => p.userId)).toBe(true);
  });

  test("Blake stale host=William still attributes to Stefanie via joinedFromFriendUid", () => {
    expect(
      resolveEffectiveHostUid(
        {
          planHostUid: "william",
          joinedFromFriendUid: "stefanie",
          joinedFromIds: ["stefanie", "william", "blake"],
        },
        "stefanie",
        ["stefanie", "william", "blake"],
        "blake"
      )
    ).toBe("stefanie");
  });

  test("viewer host calendar wins over Blake copy that names William as host", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "william",
        joinedFromFriendUid: "stefanie",
        joinedFromIds: ["stefanie", "william", "blake"],
        title: "Happy Hour",
        date: "2026-07-17",
        attendeeDisplayNames: {
          stefanie: "Stefanie Baarman",
          william: "William Waller",
          blake: "Blake Reilly",
        },
      },
      "stefanie",
      {
        stefanie: "Stefanie Baarman",
        william: "William Waller",
        blake: "Blake Reilly",
      },
      "blake",
      [
        {
          planHostUid: "stefanie",
          joinedFromIds: ["stefanie", "william", "blake"],
          title: "Happy Hour",
          date: "2026-07-17",
          attendeeDisplayNames: {
            stefanie: "Stefanie Baarman",
            william: "William Waller",
            blake: "Blake Reilly",
          },
        },
      ]
    );

    expect(result.primary).toBeNull();
    expect(result.goingPeople[0]).toMatchObject({
      userId: "stefanie",
      displayName: "Stefanie Baarman",
      isHost: true,
    });
  });

  test("shows Shawns plan on Elliott profile from solo-shaped row via viewer copy", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "elliott",
        title: "Janes Birth",
        date: "2099-07-01",
        time: "9:00 PM",
      },
      "viewer",
      { shawn: "Shawn", elliott: "Elliott" },
      "elliott",
      [
        {
          planHostUid: "shawn",
          joinedFromFriendUid: "shawn",
          joinedFromIds: ["shawn", "elliott", "viewer"],
          joinedFromNames: ["Elliott"],
          title: "Jane's Birth",
          date: "2099-07-01",
          time: "9:00 PM",
          attendeeDisplayNames: {
            shawn: "Shawn",
            elliott: "Elliott",
          },
        },
      ]
    );

    expect(result.primary).toBe("Shawn's plan");
    expect(result.secondary).toBe("You and Elliott are going");
  });

  test("going sheet includes the viewer when they joined someone else's plan", () => {
    const result = resolvePlanAttribution(
      {
        planHostUid: "stefanie",
        joinedFromFriendUid: "stefanie",
        joinedFromIds: ["stefanie", "blake", "viewer"],
        attendeeDisplayNames: {
          stefanie: "Stefanie Baarman",
          blake: "Blake Reilly",
          viewer: "Alex Joiner",
        },
      },
      "viewer",
      {
        stefanie: "Stefanie Baarman",
        blake: "Blake Reilly",
        viewer: "Alex Joiner",
      },
      "blake"
    );

    expect(result.goingPeople.map((p) => p.displayName)).toEqual([
      "Stefanie Baarman",
      "Blake Reilly",
      "Alex Joiner",
    ]);
    expect(result.secondary).toBe("You and Blake are going");
  });

  test("solo friend plan with no joiners still lists the host in goingPeople", () => {
    const result = resolvePlanAttribution(
      {
        id: "solo-1",
        title: "Happy Hour",
        date: "2099-07-17",
        time: "5:00 PM",
        location: "Lulu's Wine Garden",
        planHostUid: "priscilla",
      },
      "viewer",
      { priscilla: "Priscilla Park" },
      "priscilla"
    );

    expect(result.primary).toBe("Priscilla's plan");
    expect(result.secondary).toBeNull();
    expect(result.goingPeople).toEqual([
      {
        userId: "priscilla",
        displayName: "Priscilla Park",
        imageUrl: null,
        isHost: true,
      },
    ]);
  });

  test("viewer host solo plan still lists themselves as host in goingPeople", () => {
    const result = resolvePlanAttribution(
      {
        id: "mine-1",
        title: "Coffee",
        date: "2099-07-18",
        planHostUid: "viewer",
      },
      "viewer",
      { viewer: "Blake Reilly" },
      "viewer"
    );

    expect(result.primary).toBeNull();
    expect(result.secondary).toBeNull();
    expect(result.goingPeople).toEqual([
      {
        userId: "viewer",
        displayName: "Blake Reilly",
        imageUrl: null,
        isHost: true,
      },
    ]);
  });
});
