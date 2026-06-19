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
    "Surprise Me":
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
};

export function vibeCategoryImageUrl(label: string): string {
    return VIBE_CATEGORY_IMAGE[label] ?? VIBE_CATEGORY_IMAGE["Surprise Me"];
}
