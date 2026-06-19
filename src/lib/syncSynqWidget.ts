import Constants, { ExecutionEnvironment } from "expo-constants";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import type { DocumentData } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ignoreSnapshotPermissionDenied } from "./firestoreListeners";
import { formatSynqAudienceLabel } from "./synqBroadcast";
import { computeSynqActiveFromUserData } from "./synqSession";
import { friendGroupsCacheByUser } from "./socialCache";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Home screen widget (expo-widgets + @expo/ui) was removed for Expo SDK 54 / Expo Go.
 * Re-add the widget target and `widgets/SynqGlanceWidget.ios.tsx` when you upgrade to SDK 55+.
 * Expo Go: no native widget module (noop).
 */

export function mapUserDocToWidgetProps(
  data: DocumentData | undefined,
  audienceLabel?: string | null
): {
  statusLabel: string;
  memo: string;
  isActive: boolean;
} {
  const isAvailable = computeSynqActiveFromUserData(data);
  const rawMemo = typeof data?.memo === "string" ? data.memo.trim() : "";
  const memo =
    rawMemo.length > 120 ? `${rawMemo.slice(0, 117)}…` : rawMemo;
  const baseStatus = isAvailable ? "Synq active" : "Not Synqing";
  const statusLabel =
    isAvailable && audienceLabel ? `${baseStatus} · ${audienceLabel}` : baseStatus;
  return {
    statusLabel,
    memo,
    isActive: Boolean(isAvailable),
  };
}

type WidgetHandle = {
  updateSnapshot: (props: ReturnType<typeof mapUserDocToWidgetProps>) => void;
};

function getWidget(): WidgetHandle | null {
  if (Platform.OS !== "ios" || isExpoGo) return null;
  try {
    const mod = require("../../widgets/SynqGlanceWidget") as {
      default: WidgetHandle | null;
    };
    return mod.default;
  } catch {
    return null;
  }
}

/**
 * Subscribes to the signed-in user document and pushes updates to the home screen widget.
 * Re-applies the last snapshot when the app returns to foreground.
 */
export function startSynqGlanceWidgetSync(): () => void {
  if (Platform.OS !== "ios") return () => {};
  if (isExpoGo) return () => {};

  try {
    require("../../widgets/SynqGlanceWidget");
  } catch {
    return () => {};
  }

  let unsubDoc: (() => void) | undefined;
  let lastProps: ReturnType<typeof mapUserDocToWidgetProps> | null = null;

  const push = () => {
    const w = getWidget();
    if (!w || !lastProps) return;
    try {
      w.updateSnapshot(lastProps);
    } catch {
      /* native module not linked in dev client without widget rebuild */
    }
  };

  const unsubAuth = onAuthStateChanged(auth, (user) => {
    unsubDoc?.();
    unsubDoc = undefined;
    lastProps = null;
    if (!user) return;

    unsubDoc = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.data();
        const groups = friendGroupsCacheByUser[user.uid] ?? [];
        const audienceLabel = formatSynqAudienceLabel(data, groups);
        lastProps = mapUserDocToWidgetProps(data, audienceLabel);
        push();
      },
      ignoreSnapshotPermissionDenied
    );
  });

  const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") push();
  });

  return () => {
    unsubDoc?.();
    unsubAuth();
    sub.remove();
  };
}
