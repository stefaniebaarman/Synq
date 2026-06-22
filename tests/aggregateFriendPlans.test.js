const { aggregateFriendPlans } = require("../src/lib/aggregateFriendPlans.js");

describe("aggregateFriendPlans", () => {
  test("merges and sorts upcoming plans from all friends", () => {
    const friends = [
      {
        id: "a",
        displayName: "Alex",
        events: [
          { id: "1", title: "Dinner", date: "2099-06-20", time: "7:00 PM" },
        ],
      },
      {
        id: "b",
        displayName: "Blake",
        events: [
          { id: "2", title: "Coffee", date: "2099-06-18", time: "10:00 AM" },
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(2);
    expect(plans[0].event.title).toBe("Coffee");
    expect(plans[1].event.title).toBe("Dinner");
  });

  test("dedupes the same plan across friend profiles using the host friend", () => {
    const friends = [
      {
        id: "host",
        displayName: "Host",
        events: [
          {
            id: "host-row",
            title: "Party",
            date: "2099-07-01",
            planHostUid: "host",
          },
        ],
      },
      {
        id: "guest",
        displayName: "Guest",
        events: [
          {
            id: "guest-row",
            title: "Party",
            date: "2099-07-01",
            planHostUid: "host",
            joinedFromFriendUid: "host",
          },
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(1);
    expect(plans[0].sourceFriendId).toBe("host");
    expect(plans[0].sourceFriendName).toBe("Host");
  });

  test("excludes plans hosted by someone who is not your friend", () => {
    const friends = [
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "joined-row",
            title: "Jane's Birth",
            date: "2099-07-01",
            time: "9:00 PM",
            planHostUid: "shawn",
            joinedFromFriendUid: "shawn",
            joinedFromIds: ["shawn", "elliott"],
            joinedFromNames: ["Elliott"],
            attendeeDisplayNames: {
              shawn: "Shawn",
              elliott: "Elliott",
            },
          },
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(0);
  });

  test("includes plans a friend hosts with others going", () => {
    const friends = [
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "host-row",
            title: "House party",
            date: "2099-07-01",
            planHostUid: "elliott",
            joinedFromIds: ["elliott", "priscilla"],
            joinedFromNames: ["Priscilla"],
            attendeeDisplayNames: {
              elliott: "Elliott",
              priscilla: "Priscilla",
            },
          },
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(1);
    expect(plans[0].sourceFriendId).toBe("elliott");
    expect(plans[0].sourceFriendName).toBe("Elliott");
    expect(plans[0].event.title).toBe("House party");
  });

  test("shows a friend-hosted plan from the host friend profile only", () => {
    const friends = [
      {
        id: "shawn",
        displayName: "Shawn",
        events: [
          {
            id: "host-row",
            title: "Jane's Birth",
            date: "2099-07-01",
            planHostUid: "shawn",
            joinedFromFriendUid: "shawn",
            joinedFromIds: ["shawn", "elliott"],
            joinedFromNames: ["Elliott"],
            attendeeDisplayNames: {
              shawn: "Shawn",
              elliott: "Elliott",
            },
          },
        ],
      },
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "joined-row",
            title: "Jane's Birth",
            date: "2099-07-01",
            planHostUid: "shawn",
            joinedFromFriendUid: "shawn",
            joinedFromIds: ["shawn", "elliott"],
            joinedFromNames: ["Elliott"],
            attendeeDisplayNames: {
              shawn: "Shawn",
              elliott: "Elliott",
            },
          },
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(1);
    expect(plans[0].sourceFriendId).toBe("shawn");
    expect(plans[0].sourceFriendName).toBe("Shawn");
  });

  test("excludes wrongly stored join rows when the real host is not a friend", () => {
    const friends = [
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "joined-row",
            title: "Jane's Birth",
            date: "2099-07-01",
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
        ],
      },
    ];

    const plans = aggregateFriendPlans(friends);
    expect(plans).toHaveLength(0);
  });

  test("excludes solo-shaped joiner rows when the viewer is on the same plan with another host", () => {
    const friends = [
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "solo-shaped",
            title: "Janes Birth",
            date: "2099-07-01",
            time: "9:00 PM",
            planHostUid: "elliott",
          },
        ],
      },
    ];

    const viewerEvents = [
      {
        id: "viewer-row",
        title: "Jane's Birth",
        date: "2099-07-01",
        time: "9:00 PM",
        planHostUid: "shawn",
        joinedFromFriendUid: "shawn",
        joinedFromIds: ["shawn", "elliott", "viewer"],
        joinedFromNames: ["Elliott"],
        attendeeDisplayNames: {
          shawn: "Shawn",
          elliott: "Elliott",
        },
      },
    ];

    const plans = aggregateFriendPlans(friends, {
      viewerId: "viewer",
      viewerEvents,
    });
    expect(plans).toHaveLength(0);
  });

  test("keeps a friend-hosted plan in upcoming after the viewer joins through that friend", () => {
    const friends = [
      {
        id: "elliott",
        displayName: "Elliott",
        events: [
          {
            id: "host-row",
            title: "House party",
            date: "2099-07-01",
            planHostUid: "elliott",
          },
        ],
      },
    ];

    const viewerEvents = [
      {
        id: "viewer-row",
        title: "House party",
        date: "2099-07-01",
        planHostUid: "viewer",
        joinedFromFriendUid: "elliott",
        joinedFromIds: ["elliott", "viewer"],
      },
    ];

    const plans = aggregateFriendPlans(friends, {
      viewerId: "viewer",
      viewerEvents,
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].sourceFriendId).toBe("elliott");
  });

  test("skips blocked friends", () => {
    const friends = [
      {
        id: "blocked",
        displayName: "Blocked",
        events: [{ id: "1", title: "Hidden", date: "2099-08-01" }],
      },
      {
        id: "ok",
        displayName: "OK",
        events: [{ id: "2", title: "Visible", date: "2099-08-02" }],
      },
    ];

    const plans = aggregateFriendPlans(friends, {
      blockedIds: new Set(["blocked"]),
    });
    expect(plans).toHaveLength(1);
    expect(plans[0].event.title).toBe("Visible");
  });
});
