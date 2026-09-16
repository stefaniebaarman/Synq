/**
 * Android dev reload can evaluate expo-modules-core before native installs
 * globalThis.expo ([runtime not ready] → EventEmitter crash). A minimal stub
 * lets the bundle finish loading; native replaces expo once the bridge is up.
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
}

const expoGlobal = (globalThis as { expo?: { EventEmitter?: unknown } }).expo;

if (typeof expoGlobal === "undefined") {
  (globalThis as unknown as { expo: { EventEmitter: typeof PlaceholderEventEmitter } }).expo =
    { EventEmitter: PlaceholderEventEmitter };
} else if (!expoGlobal.EventEmitter) {
  expoGlobal.EventEmitter = PlaceholderEventEmitter;
}
