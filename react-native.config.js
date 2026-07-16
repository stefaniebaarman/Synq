// expo-firebase-core ships obsolete Android native APIs removed in SDK 54.
// Phone auth uses JS/WebView reCAPTCHA with firebaseConfig; iOS is unchanged.
module.exports = {
  dependencies: {
    "expo-firebase-core": {
      platforms: {
        android: null,
      },
    },
  },
};
