import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "@firebase/auth";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";
import { ENV_VARS } from "./config.js";

const firebaseConfig = {
  apiKey: ENV_VARS.apiKey,
  authDomain: ENV_VARS.authDomain,
  projectId: ENV_VARS.projectId,
  storageBucket: ENV_VARS.storageBucket,
  messagingSenderId: ENV_VARS.messagingSenderId,
  appId: ENV_VARS.appId,
  measurementId: ENV_VARS.measurementId,
};

const app = initializeApp(firebaseConfig);

function initAuth() {
  if (Platform.OS === "web") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : "";
    if (code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = initAuth();

export const db = getFirestore(app);
export const storage = getStorage(app);

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (isExpoGo) {
  auth.settings.appVerificationDisabledForTesting = true;
}

export {
  app,
  createUserWithEmailAndPassword,
  firebaseConfig,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
};
