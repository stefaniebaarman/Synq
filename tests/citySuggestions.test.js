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
  pickSuggestionBatch,
  suggestionBatchKey,
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
    expect(suggestions).toHaveLength(4);
  });

  test("getCachedCitySuggestions uses Outdoors for Active when no Active list exists", () => {
    const cityData = {
      "washington-dc": {
        cityId: "washington-dc",
        categories: {
          Outdoors: [
            { name: "Rock Creek", address: "1 St, Washington, DC", imageUrl: "https://a.test/r.jpg" },
            { name: "Meridian Hill", address: "2 St, Washington, DC", imageUrl: "https://a.test/m.jpg" },
            { name: "National Mall", address: "3 St, Washington, DC", imageUrl: "https://a.test/n.jpg" },
          ],
        },
      },
    };
    const suggestions = getCachedCitySuggestions(
      "Washington, DC",
      "Active",
      cityData,
      registry
    );
    expect(suggestions?.map((row) => row.name).sort()).toEqual([
      "Meridian Hill",
      "National Mall",
      "Rock Creek",
    ]);
  });

  test("getCachedCitySuggestions uses Drinks for Night out when no nightlife list exists", () => {
    const cityData = {
      "washington-dc": {
        cityId: "washington-dc",
        categories: {
          Drinks: [
            { name: "Flash", address: "1 St, Washington, DC", imageUrl: "https://a.test/f.jpg" },
            { name: "ESL", address: "2 St, Washington, DC", imageUrl: "https://a.test/e.jpg" },
            { name: "DC9", address: "3 St, Washington, DC", imageUrl: "https://a.test/d.jpg" },
          ],
        },
      },
    };
    const suggestions = getCachedCitySuggestions(
      "Washington, DC",
      "Night out",
      cityData,
      registry
    );
    expect(suggestions?.map((row) => row.name).sort()).toEqual(["DC9", "ESL", "Flash"]);
  });

  test("getCachedCitySuggestions returns a Shopping list for DC when provided", () => {
    const cityData = {
      "washington-dc": {
        cityId: "washington-dc",
        categories: {
          Shopping: [
            { name: "CityCenterDC", address: "1 St, Washington, DC", imageUrl: "https://a.test/c.jpg" },
            { name: "Union Market", address: "2 St, Washington, DC", imageUrl: "https://a.test/u.jpg" },
            { name: "Eastern Market", address: "3 St, Washington, DC", imageUrl: "https://a.test/e.jpg" },
          ],
        },
      },
    };
    const suggestions = getCachedCitySuggestions(
      "Washington, DC",
      "Shopping",
      cityData,
      registry
    );
    expect(suggestions).toHaveLength(3);
  });

  test("getCachedCitySuggestions prefers up to 5 venues when available", () => {
    const richDinner = {
      cityId: "washington-dc",
      categories: {
        Dinner: [
          { name: "A", address: "1 St, Washington, DC", imageUrl: "https://a.test/1.jpg" },
          { name: "B", address: "2 St, Washington, DC", imageUrl: "https://a.test/2.jpg" },
          { name: "C", address: "3 St, Washington, DC", imageUrl: "https://a.test/3.jpg" },
          { name: "D", address: "4 St, Washington, DC", imageUrl: "https://a.test/4.jpg" },
          { name: "E", address: "5 St, Washington, DC", imageUrl: "https://a.test/5.jpg" },
          { name: "F", address: "6 St, Washington, DC", imageUrl: "https://a.test/6.jpg" },
        ],
      },
    };
    const suggestions = getCachedCitySuggestions(
      "Washington, DC",
      "Dinner",
      { "washington-dc": richDinner },
      registry
    );
    expect(suggestions).toHaveLength(5);
  });

  test("getCachedCitySuggestions prefers unseen venues when avoiding a batch", () => {
    const richDinner = {
      cityId: "washington-dc",
      categories: {
        Dinner: [
          { name: "A", address: "1 St, Washington, DC", imageUrl: "https://a.test/1.jpg" },
          { name: "B", address: "2 St, Washington, DC", imageUrl: "https://a.test/2.jpg" },
          { name: "C", address: "3 St, Washington, DC", imageUrl: "https://a.test/3.jpg" },
          { name: "D", address: "4 St, Washington, DC", imageUrl: "https://a.test/4.jpg" },
          { name: "E", address: "5 St, Washington, DC", imageUrl: "https://a.test/5.jpg" },
          { name: "F", address: "6 St, Washington, DC", imageUrl: "https://a.test/6.jpg" },
          { name: "G", address: "7 St, Washington, DC", imageUrl: "https://a.test/7.jpg" },
          { name: "H", address: "8 St, Washington, DC", imageUrl: "https://a.test/8.jpg" },
          { name: "I", address: "9 St, Washington, DC", imageUrl: "https://a.test/9.jpg" },
        ],
      },
    };
    const first = getCachedCitySuggestions(
      "Washington, DC",
      "Dinner",
      { "washington-dc": richDinner },
      registry
    );
    expect(first).toHaveLength(5);
    const firstKey = suggestionBatchKey(first.map((row) => row.name));
    const second = getCachedCitySuggestions(
      "Washington, DC",
      "Dinner",
      { "washington-dc": richDinner },
      registry,
      {
        avoidNames: first.map((row) => row.name),
        recentBatchKeys: [firstKey],
      }
    );
    expect(second).toHaveLength(5);
    expect(suggestionBatchKey(second.map((row) => row.name))).not.toBe(firstKey);
    const firstNames = new Set(first.map((row) => row.name));
    const overlap = second.filter((row) => firstNames.has(row.name)).length;
    // With 9 venues / 5 shown, at most 1 must be reused to fill a new batch of 5.
    expect(overlap).toBeLessThanOrEqual(1);
  });

  test("pickSuggestionBatch avoids recently shown batch keys", () => {
    const venues = [
      { name: "A", address: "1", imageUrl: "" },
      { name: "B", address: "2", imageUrl: "" },
      { name: "C", address: "3", imageUrl: "" },
      { name: "D", address: "4", imageUrl: "" },
      { name: "E", address: "5", imageUrl: "" },
      { name: "F", address: "6", imageUrl: "" },
      { name: "G", address: "7", imageUrl: "" },
      { name: "H", address: "8", imageUrl: "" },
      { name: "I", address: "9", imageUrl: "" },
    ];
    const keys = new Set();
    let avoid = [];
    for (let i = 0; i < 6; i++) {
      const batch = pickSuggestionBatch(venues, 5, {
        avoidNames: avoid,
        recentBatchKeys: [...keys],
      });
      const key = suggestionBatchKey(batch.map((row) => row.name));
      expect(keys.has(key)).toBe(false);
      keys.add(key);
      avoid = batch.map((row) => row.name);
    }
    expect(keys.size).toBe(6);
  });

  test("pickRandomVenues excludes names case-insensitively across sessions", () => {
    const venues = [
      { name: "Alpha", address: "1 St", imageUrl: "" },
      { name: "Beta", address: "2 St", imageUrl: "" },
      { name: "Gamma", address: "3 St", imageUrl: "" },
      { name: "Delta", address: "4 St", imageUrl: "" },
      { name: "Epsilon", address: "5 St", imageUrl: "" },
      { name: "Zeta", address: "6 St", imageUrl: "" },
    ];
    const first = pickRandomVenues(venues, 3, []);
    const second = pickRandomVenues(
      venues,
      3,
      first.map((row) => row.name.toUpperCase())
    );
    expect(second).toHaveLength(3);
    const seen = new Set(first.map((row) => row.name.toLowerCase()));
    expect(
      second.every((row) => !seen.has(row.name.toLowerCase()))
    ).toBe(true);
  });
});
