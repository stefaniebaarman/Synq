const { matchesPlanEvent, findChangedHostedPlans } = require("../functions/openPlanSync.js");

describe("openPlan matchesPlanEvent", () => {
  test("matches identical full event keys", () => {
    const a = {
      title: "Dinner",
      date: "2026-06-14",
      time: "7:00 PM",
      location: "Main St",
    };
    const b = { ...a, id: "other-id" };
    expect(matchesPlanEvent(a, b, [a, b])).toBe(true);
  });

  test("does not match identical content from different hosts", () => {
    const hostA = {
      title: "Happy Hour",
      date: "2026-07-17",
      time: "5:00 PM",
      location: "Wood & Iron",
      planHostUid: "stefanie",
    };
    const hostB = {
      ...hostA,
      planHostUid: "blake",
    };
    expect(matchesPlanEvent(hostA, hostB, [hostA, hostB])).toBe(false);
  });

  test("does not match same title and date from different hosts", () => {
    const hostA = {
      title: "Dinner",
      date: "2026-06-14",
      time: "7:00 PM",
      location: "A",
      planHostUid: "host-a",
    };
    const hostB = {
      title: "Dinner",
      date: "2026-06-14",
      time: "8:00 PM",
      location: "B",
      planHostUid: "host-b",
    };
    expect(matchesPlanEvent(hostA, hostB, [hostA, hostB])).toBe(false);
  });

  test("matches when one hosted plan shares loose key on calendar", () => {
    const hostPlan = {
      id: "1",
      title: "Run",
      date: "2026-06-15",
      time: "8:00 AM",
      planHostUid: "host-1",
    };
    const target = {
      title: "Run",
      date: "2026-06-15",
      time: "9:00 AM",
      planHostUid: "host-1",
    };
    expect(matchesPlanEvent(hostPlan, target, [hostPlan])).toBe(true);
  });

  test("does not loose-match when two host plans share title and date", () => {
    const planA = {
      id: "1",
      title: "Run",
      date: "2026-06-15",
      time: "8:00 AM",
      planHostUid: "host-1",
    };
    const planB = {
      id: "2",
      title: "Run",
      date: "2026-06-15",
      time: "6:00 PM",
      planHostUid: "host-1",
    };
    expect(matchesPlanEvent(planA, planB, [planA, planB])).toBe(false);
  });
});

describe("openPlan findChangedHostedPlans", () => {
  test("detects host title rename for same plan id", () => {
    const before = [
      {
        id: "plan-1",
        title: "Brunch",
        date: "2026-07-20",
        time: "11:00 AM",
        location: "Cafe",
        planHostUid: "host-1",
        joinedFromIds: ["host-1", "friend-1"],
      },
    ];
    const after = [
      {
        ...before[0],
        title: "Lunch",
      },
    ];
    const changes = findChangedHostedPlans("host-1", before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].before.title).toBe("Brunch");
    expect(changes[0].after.title).toBe("Lunch");
  });

  test("ignores identical content and non-hosted rows", () => {
    const hosted = {
      id: "plan-1",
      title: "Brunch",
      date: "2026-07-20",
      time: "",
      location: "",
      planHostUid: "host-1",
    };
    const joined = {
      id: "copy-9",
      title: "Other",
      date: "2026-07-21",
      time: "",
      location: "",
      planHostUid: "someone-else",
    };
    expect(findChangedHostedPlans("host-1", [hosted, joined], [hosted, joined])).toEqual([]);
  });
});
