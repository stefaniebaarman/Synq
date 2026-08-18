/** Stock photos for explore vibe categories (Unsplash, free static URLs). */
export const VIBE_CATEGORY_IMAGE: Record<string, string> = {
    Drinks:
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&h=600&fit=crop",
    Dinner:
        "https://images.unsplash.com/photo-1547573854-74d2a71d0826?w=800&h=600&fit=crop",
    "Coffee Spots":
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop",
    Outdoors:
        "https://images.unsplash.com/photo-1440186347098-386b7459ad6b?w=800&h=600&fit=crop",
    Brunch:
        "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?w=800&h=600&fit=crop",
    "Night out":
        "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&h=600&fit=crop",
    Shopping:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop",
    "Surprise Me":
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
};

const VIBE_DISPLAY_LABEL: Record<string, string> = {
    Drinks: "Drinks",
    Dinner: "Dinner",
    "Coffee Spots": "Coffee",
    Outdoors: "Outdoors",
    Brunch: "Brunch",
    "Night out": "Night out",
    Shopping: "Shopping",
    "Surprise Me": "Surprise me",
    Active: "Outdoors",
};

export function vibeDisplayLabel(label: string): string {
    const key = String(label || "").trim();
    return VIBE_DISPLAY_LABEL[key] ?? key;
}

export function vibeCategoryImageUrl(label: string): string {
    const key = label === "Active" ? "Outdoors" : label;
    return VIBE_CATEGORY_IMAGE[key] ?? VIBE_CATEGORY_IMAGE["Surprise Me"];
}
