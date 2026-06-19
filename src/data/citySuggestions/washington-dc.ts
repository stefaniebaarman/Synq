export type CachedVenue = {
  name: string;
  address: string;
  imageUrl: string;
};

export type CityCategory =
  | "Drinks"
  | "Dinner"
  | "Coffee Spots"
  | "Outdoors"
  | "Surprise Me";

export type CitySuggestionData = {
  cityId: string;
  displayName: string;
  categories: Record<CityCategory, CachedVenue[]>;
};

/** Curated Washington, DC venues — free static Unsplash images. */
export const washingtonDcSuggestions: CitySuggestionData = {
  cityId: "washington-dc",
  displayName: "Washington, DC",
  categories: {
    Drinks: [
      {
        name: "Flash",
        address: "645 Florida Ave NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400&h=400&fit=crop",
      },
      {
        name: "Nellie's Sports Bar",
        address: "900 U St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=400&fit=crop",
      },
      {
        name: "Songbyrd Music House",
        address: "2477 18th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
      },
      {
        name: "Ivy & Coney",
        address: "1537 7th St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop",
      },
      {
        name: "Eighteenth Street Lounge",
        address: "1212 18th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=400&h=400&fit=crop",
      },
      {
        name: "Hawthorne",
        address: "804 V St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
      },
      {
        name: "Waxwing",
        address: "775 T St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=400&fit=crop",
      },
      {
        name: "Johnny's Underground",
        address: "5225 Wisconsin Ave NW, Washington, DC 20015",
        imageUrl:
          "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=400&h=400&fit=crop",
      },
      {
        name: "Ivy City Smokehouse",
        address: "1359 Okie St NE, Washington, DC 20002",
        imageUrl:
          "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=400&h=400&fit=crop",
      },
    ],
    Dinner: [
      {
        name: "Le Diplomate",
        address: "1601 14th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop",
      },
      {
        name: "Rose's Luxury",
        address: "717 8th St SE, Washington, DC 20003",
        imageUrl:
          "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=400&fit=crop",
      },
      {
        name: "Founding Farmers DC",
        address: "1924 Pennsylvania Ave NW, Washington, DC 20006",
        imageUrl:
          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop",
      },
      {
        name: "Old Ebbitt Grill",
        address: "675 15th St NW, Washington, DC 20005",
        imageUrl:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=400&fit=crop",
      },
      {
        name: "Ambar",
        address: "523 8th St SE, Washington, DC 20003",
        imageUrl:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop",
      },
      {
        name: "Busboys and Poets",
        address: "2021 14th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=400&fit=crop",
      },
      {
        name: "Jaleo",
        address: "480 7th St NW, Washington, DC 20004",
        imageUrl:
          "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop",
      },
      {
        name: "Mi Vida",
        address: "98 District Square SW, Washington, DC 20024",
        imageUrl:
          "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=400&fit=crop",
      },
      {
        name: "L'Ardente",
        address: "2000 Massachusetts Ave NW, Washington, DC 20036",
        imageUrl:
          "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&h=400&fit=crop",
      },
    ],
    "Coffee Spots": [
      {
        name: "Tryst",
        address: "2459 18th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
      },
      {
        name: "Compass Coffee",
        address: "1535 7th St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop",
      },
      {
        name: "Politics and Prose",
        address: "5015 Connecticut Ave NW, Washington, DC 20008",
        imageUrl:
          "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop",
      },
      {
        name: "The Coupe",
        address: "3417 11th St NW, Washington, DC 20010",
        imageUrl:
          "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=400&fit=crop",
      },
      {
        name: "Kramerbooks & Afterwords",
        address: "1517 Connecticut Ave NW, Washington, DC 20036",
        imageUrl:
          "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=400&fit=crop",
      },
      {
        name: "Filter Coffeehouse",
        address: "1726 20th St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=400&h=400&fit=crop",
      },
      {
        name: "Slipstream",
        address: "1333 14th St NW, Washington, DC 20005",
        imageUrl:
          "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
      },
      {
        name: "Dolcezza Gelato",
        address: "1704 Connecticut Ave NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop",
      },
      {
        name: "Calico",
        address: "50 Blagden Alley NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1459257868276-5e65389e2722?w=400&h=400&fit=crop",
      },
    ],
    Outdoors: [
      {
        name: "Rock Creek Park",
        address: "Rock Creek Park, Washington, DC",
        imageUrl:
          "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=400&fit=crop",
      },
      {
        name: "Yards Park",
        address: "355 Water St SE, Washington, DC 20003",
        imageUrl:
          "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
      },
      {
        name: "Meridian Hill Park",
        address: "16th St NW & W St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=400&fit=crop",
      },
      {
        name: "Theodore Roosevelt Island",
        address: "George Washington Memorial Pkwy, Arlington, VA 22202",
        imageUrl:
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop",
      },
      {
        name: "Tidal Basin",
        address: "West Basin Dr SW, Washington, DC 20242",
        imageUrl:
          "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&h=400&fit=crop",
      },
      {
        name: "Kenilworth Aquatic Gardens",
        address: "1550 Anacostia Ave NE, Washington, DC 20019",
        imageUrl:
          "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&h=400&fit=crop",
      },
      {
        name: "U.S. National Arboretum",
        address: "3501 New York Ave NE, Washington, DC 20002",
        imageUrl:
          "https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=400&fit=crop",
      },
      {
        name: "Georgetown Waterfront Park",
        address: "Georgetown Waterfront Park, Washington, DC 20007",
        imageUrl:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&h=400&fit=crop",
      },
      {
        name: "National Mall",
        address: "National Mall, Washington, DC 20024",
        imageUrl:
          "https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=400&h=400&fit=crop",
      },
    ],
    "Surprise Me": [
      {
        name: "Eastern Market",
        address: "225 7th St SE, Washington, DC 20003",
        imageUrl:
          "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&h=400&fit=crop",
      },
      {
        name: "Union Market",
        address: "1280 4th St NE, Washington, DC 20002",
        imageUrl:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop",
      },
      {
        name: "National Portrait Gallery",
        address: "8th St NW & G St NW, Washington, DC 20001",
        imageUrl:
          "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=400&fit=crop",
      },
      {
        name: "Planet Word Museum",
        address: "925 13th St NW, Washington, DC 20005",
        imageUrl:
          "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
      },
      {
        name: "International Spy Museum",
        address: "700 L'Enfant Plaza SW, Washington, DC 20024",
        imageUrl:
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
      },
      {
        name: "The Wharf",
        address: "760 Maine Ave SW, Washington, DC 20024",
        imageUrl:
          "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
      },
      {
        name: "National Gallery of Art",
        address: "Constitution Ave NW, Washington, DC 20565",
        imageUrl:
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop",
      },
      {
        name: "U Street Corridor",
        address: "U St NW, Washington, DC 20009",
        imageUrl:
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
      },
      {
        name: "Smithsonian National Zoo",
        address: "3001 Connecticut Ave NW, Washington, DC 20008",
        imageUrl:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=400&fit=crop",
      },
    ],
  },
};
