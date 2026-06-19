const {
  matchesArlingtonVa,
  matchesAustinTx,
  matchesBostonMa,
  matchesChicagoIl,
  matchesDeweyBeachDe,
  matchesNewYorkCity,
  matchesPotomacMd,
  matchesSanDiegoCa,
  matchesSeattleWa,
  matchesWashingtonDcMetro,
  parseLocationLabels,
  pickRandomVenues,
  allParticipantsHaveCachedCitySuggestions,
  getCachedCitySuggestions,
  resolveCityId,
} = require("../src/lib/citySuggestionsCore");

const washingtonDc = {
  cityId: "washington-dc",
  categories: {
    Dinner: [
      { name: "A", address: "1 St, Washington, DC", imageUrl: "https://a.test/1.jpg" },
      { name: "B", address: "2 St, Washington, DC", imageUrl: "https://a.test/2.jpg" },
      { name: "C", address: "3 St, Washington, DC", imageUrl: "https://a.test/3.jpg" },
      { name: "D", address: "4 St, Washington, DC", imageUrl: "https://a.test/4.jpg" },
    ],
    "Coffee Spots": [],
  },
};

const arlingtonVa = {
  cityId: "arlington-va",
  categories: {
    Dinner: [
      { name: "X", address: "1 St, Arlington, VA", imageUrl: "https://a.test/x.jpg" },
      { name: "Y", address: "2 St, Arlington, VA", imageUrl: "https://a.test/y.jpg" },
      { name: "Z", address: "3 St, Arlington, VA", imageUrl: "https://a.test/z.jpg" },
    ],
  },
};

const newYorkNy = {
  cityId: "new-york-ny",
  categories: {
    Dinner: [
      { name: "P", address: "1 St, New York, NY", imageUrl: "https://a.test/p.jpg" },
      { name: "Q", address: "2 St, New York, NY", imageUrl: "https://a.test/q.jpg" },
      { name: "R", address: "3 St, New York, NY", imageUrl: "https://a.test/r.jpg" },
    ],
  },
};

const registry = [
  { cityId: "arlington-va", match: matchesArlingtonVa },
  { cityId: "austin-tx", match: matchesAustinTx },
  { cityId: "boston-ma", match: matchesBostonMa },
  { cityId: "chicago-il", match: matchesChicagoIl },
  { cityId: "dewey-beach-de", match: matchesDeweyBeachDe },
  { cityId: "new-york-ny", match: matchesNewYorkCity },
  { cityId: "potomac-md", match: matchesPotomacMd },
  { cityId: "san-diego-ca", match: matchesSanDiegoCa },
  { cityId: "seattle-wa", match: matchesSeattleWa },
  { cityId: "washington-dc", match: matchesWashingtonDcMetro },
];

describe("citySuggestions", () => {
  test("parseLocationLabels splits metro prompts", () => {
    expect(parseLocationLabels("Washington, DC and Arlington, VA")).toEqual([
      "Washington, DC",
      "Arlington, VA",
    ]);
  });

  test("matchesWashingtonDcMetro accepts DC metro but not Arlington", () => {
    expect(matchesWashingtonDcMetro(["Washington, DC"])).toBe(true);
    expect(matchesWashingtonDcMetro(["Arlington, VA"])).toBe(false);
    expect(matchesWashingtonDcMetro(["Austin, TX"])).toBe(false);
  });

  test("matchesArlingtonVa only accepts Arlington", () => {
    expect(matchesArlingtonVa(["Arlington, VA"])).toBe(true);
    expect(matchesArlingtonVa(["Washington, DC"])).toBe(false);
  });

  test("matchesNewYorkCity accepts New York and New York City", () => {
    expect(matchesNewYorkCity(["New York, NY"])).toBe(true);
    expect(matchesNewYorkCity(["New York City, NY"])).toBe(true);
    expect(matchesNewYorkCity(["Brooklyn, NY"])).toBe(false);
  });

  test("matchesDeweyBeachDe accepts Dewey Beach", () => {
    expect(matchesDeweyBeachDe(["Dewey Beach, DE"])).toBe(true);
    expect(matchesDeweyBeachDe(["Rehoboth Beach, DE"])).toBe(false);
  });

  test("matchesBostonMa and matchesChicagoIl accept their cities", () => {
    expect(matchesBostonMa(["Boston, MA"])).toBe(true);
    expect(matchesBostonMa(["Chicago, IL"])).toBe(false);
    expect(matchesChicagoIl(["Chicago, IL"])).toBe(true);
    expect(matchesChicagoIl(["Boston, MA"])).toBe(false);
  });

  test("matchesAustinTx, matchesSanDiegoCa, and matchesSeattleWa accept their cities", () => {
    expect(matchesAustinTx(["Austin, TX"])).toBe(true);
    expect(matchesAustinTx(["Seattle, WA"])).toBe(false);
    expect(matchesSanDiegoCa(["San Diego, CA"])).toBe(true);
    expect(matchesSanDiegoCa(["Austin, TX"])).toBe(false);
    expect(matchesSeattleWa(["Seattle, WA"])).toBe(true);
    expect(matchesSeattleWa(["San Diego, CA"])).toBe(false);
    expect(matchesPotomacMd(["Potomac, MD"])).toBe(true);
    expect(matchesPotomacMd(["Bethesda, MD"])).toBe(false);
  });

  test("allParticipantsHaveCachedCitySuggestions requires every participant", () => {
    expect(
      allParticipantsHaveCachedCitySuggestions(
        ["Washington, DC", "Arlington, VA"],
        registry
      )
    ).toBe(true);
    expect(
      allParticipantsHaveCachedCitySuggestions(
        ["Washington, DC", "Paris, ÎL"],
        registry
      )
    ).toBe(false);
    expect(allParticipantsHaveCachedCitySuggestions([], registry)).toBe(false);
  });

  test("resolveCityId uses sender city only", () => {
    expect(resolveCityId("Arlington, VA", registry)).toBe("arlington-va");
    expect(resolveCityId("New York, NY", registry)).toBe("new-york-ny");
    expect(resolveCityId("New York City, NY", registry)).toBe("new-york-ny");
    expect(resolveCityId("Dewey Beach, DE", registry)).toBe("dewey-beach-de");
    expect(resolveCityId("Boston, MA", registry)).toBe("boston-ma");
    expect(resolveCityId("Chicago, IL", registry)).toBe("chicago-il");
    expect(resolveCityId("Austin, TX", registry)).toBe("austin-tx");
    expect(resolveCityId("San Diego, CA", registry)).toBe("san-diego-ca");
    expect(resolveCityId("Seattle, WA", registry)).toBe("seattle-wa");
    expect(resolveCityId("Potomac, MD", registry)).toBe("potomac-md");
    expect(resolveCityId("Washington, DC", registry)).toBe("washington-dc");
    expect(resolveCityId("Paris, ÎL", registry)).toBeNull();
  });

  test("pickRandomVenues returns up to 3 unique venues", () => {
    const venues = washingtonDc.categories.Dinner;
    const picked = pickRandomVenues(venues, 3);
    expect(picked).toHaveLength(3);
    const names = picked.map((row) => row.name);
    expect(new Set(names).size).toBe(3);
    expect(picked[0]).toMatchObject({
      address: expect.any(String),
      location: expect.any(String),
      rating: "4.5",
    });
    expect(picked[0]).not.toHaveProperty("imageUrl");
  });

  test("pickRandomVenues includes venues regardless of imageUrl", () => {
    const venues = [
      { name: "No Photo", address: "1 St", imageUrl: "" },
      { name: "Has Photo", address: "2 St", imageUrl: "https://a.test/2.jpg" },
    ];
    const picked = pickRandomVenues(venues, 3);
    expect(picked).toHaveLength(2);
    expect(picked.map((row) => row.name).sort()).toEqual(["Has Photo", "No Photo"]);
  });

  test("getCachedCitySuggestions returns null for unsupported cities", () => {
    expect(
      getCachedCitySuggestions(
        "Paris, ÎL",
        "Dinner",
        { "washington-dc": washingtonDc, "arlington-va": arlingtonVa },
        registry
      )
    ).toBeNull();
  });

  test("getCachedCitySuggestions returns Arlington list for Arlington sender", () => {
    const cityData = {
      "washington-dc": washingtonDc,
      "arlington-va": arlingtonVa,
      "new-york-ny": newYorkNy,
    };
    const suggestions = getCachedCitySuggestions(
      "Arlington, VA",
      "Dinner",
      cityData,
      registry
    );
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((row) => row.address.includes("Arlington"))).toBe(
      true
    );
  });

  test("getCachedCitySuggestions returns NYC list for both New York labels", () => {
    const cityData = {
      "washington-dc": washingtonDc,
      "arlington-va": arlingtonVa,
      "new-york-ny": newYorkNy,
    };
    const fromNewYork = getCachedCitySuggestions(
      "New York, NY",
      "Dinner",
      cityData,
      registry
    );
    const fromNewYorkCity = getCachedCitySuggestions(
      "New York City, NY",
      "Dinner",
      cityData,
      registry
    );
    expect(fromNewYork).toHaveLength(3);
    expect(fromNewYorkCity).toHaveLength(3);
  });

  test("getCachedCitySuggestions returns DC list for DC sender", () => {
    const cityData = {
      "washington-dc": washingtonDc,
      "arlington-va": arlingtonVa,
      "new-york-ny": newYorkNy,
    };
    const suggestions = getCachedCitySuggestions(
      "Washington, DC",
      "Dinner",
      cityData,
      registry
    );
    expect(suggestions).toHaveLength(3);
  });
});
