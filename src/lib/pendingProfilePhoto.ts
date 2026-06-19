let pendingSourceUri: string | null = null;
let pendingCroppedUri: string | null = null;

/** Local image URI selected from the library, headed for the crop screen. */
export function setPendingProfilePhotoSource(uri: string) {
  pendingSourceUri = uri;
}

export function consumePendingProfilePhotoSource(): string | null {
  const uri = pendingSourceUri;
  pendingSourceUri = null;
  return uri;
}

/** Cropped image URI returned from the crop screen (e.g. onboarding). */
export function setPendingProfilePhoto(uri: string) {
  pendingCroppedUri = uri;
}

export function consumePendingProfilePhoto(): string | null {
  const uri = pendingCroppedUri;
  pendingCroppedUri = null;
  return uri;
}
