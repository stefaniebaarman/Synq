import { Linking, Platform } from "react-native";

export const openInMaps = async (opts: {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}) => {
  const name = (opts.name || "").trim();
  const address = (opts.address || "").trim();

  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    const label = encodeURIComponent(name || address || "Destination");
    const lat = opts.lat;
    const lng = opts.lng;

    if (Platform.OS === "ios") {
      return Linking.openURL(`https://maps.apple.com/?ll=${lat},${lng}&q=${label}`);
    }

    const url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    const can = await Linking.canOpenURL(url);
    if (can) return Linking.openURL(url);

    return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  }

  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  if (!query) return;

  if (Platform.OS === "ios") {
    return Linking.openURL(`https://maps.apple.com/?q=${query}`);
  }

  const url = `geo:0,0?q=${query}`;
  const can = await Linking.canOpenURL(url);
  if (can) return Linking.openURL(url);

  return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
};
