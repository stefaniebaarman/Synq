const { matchesPlanEvent } = require("../functions/openPlanSync.js");

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
