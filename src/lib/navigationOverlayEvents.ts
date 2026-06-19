import { DeviceEventEmitter } from "react-native";

/** Dismiss tab-level overlays before routing from an external friend-profile link. */
export const DISMISS_NAVIGATION_OVERLAYS = "dismissNavigationOverlays";

const dismissHandlers = new Set<() => void>();

export function registerDismissNavigationOverlaysHandler(
  handler: () => void
): () => void {
  dismissHandlers.add(handler);
  return () => {
    dismissHandlers.delete(handler);
  };
}

/** Close tab modals/overlays; runs registered handlers synchronously, then emits the legacy event. */
export function requestDismissNavigationOverlays() {
  for (const handler of dismissHandlers) {
    try {
      handler();
    } catch {}
  }
  DeviceEventEmitter.emit(DISMISS_NAVIGATION_OVERLAYS);
}
