/** Dark Google Maps style aligned with Synq’s near-black UI. */
export const DROP_IN_MAP_DARK_STYLE: Array<{
  elementType?: string;
  featureType?: string;
  stylers: Array<Record<string, string>>;
}> = [
  { elementType: "geometry", stylers: [{ color: "#0e1012" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1012" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#1c1c1e" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b0b0b0" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#121814" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#1a1c1e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#121314" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#222428" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#151618" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#151618" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#090a0b" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

export function formatDropInFreshness(startedAtMs: number | null | undefined): string {
  if (startedAtMs == null || !Number.isFinite(startedAtMs) || startedAtMs <= 0) {
    return "Live now";
  }
  const elapsedMs = Math.max(0, Date.now() - startedAtMs);
  const mins = Math.floor(elapsedMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hr ago";
  return `${hours} hr ago`;
}
