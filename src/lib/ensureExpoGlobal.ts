/**
 * Android dev reload can evaluate expo-modules-core before native installs
 * globalThis.expo ([runtime not ready] → EventEmitter crash). A minimal stub
 * lets the bundle finish loading; native replaces expo once the bridge is up.
 *
 * Also used for Expo Router static/web SSR (Node): the real web polyfill is
 * platform-shaken away, so we must stub NativeModule/SharedObject/SharedRef
 * too — otherwise modules like expo-image do `class X extends NativeModule`
 * and throw "Class extends value undefined".
 *
 * Important: installExpoGlobalPolyfill() no-ops if `globalThis.expo` already
 * exists, so this stub must include the full class set — not EventEmitter only.
 */
class PlaceholderEventEmitter {
  static readonly __synqPlaceholder = true;

  constructor(_module?: unknown) {}

  addListener() {
    return { remove() {} };
  }

  removeListener() {}

  removeAllListeners() {}

  listenerCount() {
    return 0;
  }

  emit() {}

  startObserving() {}

  stopObserving() {}
}

class PlaceholderNativeModule extends PlaceholderEventEmitter {
  static readonly __synqPlaceholder = true;
}

class PlaceholderSharedObject extends PlaceholderEventEmitter {
  static readonly __synqPlaceholder = true;

  release() {}
}

class PlaceholderSharedRef extends PlaceholderSharedObject {
  static readonly __synqPlaceholder = true;
  nativeRefType = "unknown";
}

type ExpoGlobalStub = {
  EventEmitter?: unknown;
  NativeModule?: unknown;
  SharedObject?: unknown;
  SharedRef?: unknown;
  modules?: Record<string, unknown>;
};

const expoGlobal = (globalThis as { expo?: ExpoGlobalStub }).expo;

if (typeof expoGlobal === "undefined") {
  (globalThis as unknown as { expo: ExpoGlobalStub }).expo = {
    EventEmitter: PlaceholderEventEmitter,
    NativeModule: PlaceholderNativeModule,
    SharedObject: PlaceholderSharedObject,
    SharedRef: PlaceholderSharedRef,
    modules: {},
  };
} else {
  if (!expoGlobal.EventEmitter) {
    expoGlobal.EventEmitter = PlaceholderEventEmitter;
  }
  if (!expoGlobal.NativeModule) {
    expoGlobal.NativeModule = PlaceholderNativeModule;
  }
  if (!expoGlobal.SharedObject) {
    expoGlobal.SharedObject = PlaceholderSharedObject;
  }
  if (!expoGlobal.SharedRef) {
    expoGlobal.SharedRef = PlaceholderSharedRef;
  }
  if (!expoGlobal.modules) {
    expoGlobal.modules = {};
  }
}
