import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type ProfilePhotoPickResult =
  | { ok: true; uri: string }
  | { ok: false; reason: "cancelled" | "denied" };

function hasPhotoLibraryAccess(
  permission: ImagePicker.MediaLibraryPermissionResponse
): boolean {
  if (!permission.granted) return false;
  if (Platform.OS === "ios" && permission.accessPrivileges === "none") {
    return false;
  }
  return true;
}

/** Read current photo-library permission without opening the picker. */
export async function getPhotoLibraryPermission() {
  return ImagePicker.getMediaLibraryPermissionsAsync();
}

export function photoLibraryAccessGranted(
  permission: ImagePicker.MediaLibraryPermissionResponse
): boolean {
  return hasPhotoLibraryAccess(permission);
}

/**
 * Request photo-library access. Call only after the user has chosen to add a photo.
 * Never opens the image picker.
 */
export async function requestPhotoLibraryAccess(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (hasPhotoLibraryAccess(current)) return true;

  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return hasPhotoLibraryAccess(requested);
}

/**
 * Opens the photo library picker only after permission is granted.
 * Permission must be requested separately (see requestPhotoLibraryAccess).
 */
export async function launchProfilePhotoPicker(): Promise<ProfilePhotoPickResult> {
  const permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (!hasPhotoLibraryAccess(permission)) {
    return { ok: false, reason: "denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]?.uri) {
    return { ok: false, reason: "cancelled" };
  }

  return { ok: true, uri: result.assets[0].uri };
}
