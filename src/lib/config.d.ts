export const ENV_VARS: {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: string;
  GOOGLE_MAPS_API_KEY: string;
};

export const SYNQ_SHARE_WEB_BASE: string;
export const SYNQ_OPEN_WEB_BASE: string;
export const SYNQ_SHARE_HOST: string;
export const IOS_BUNDLE_ID: string;
export const ANDROID_PACKAGE: string;

export function synqShareHostFromBase(base?: string): string;
