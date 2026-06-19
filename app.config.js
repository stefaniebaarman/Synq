const DEFAULT_SHARE_BASE = "https://new-synq-main.web.app";
const PRODUCTION_SHARE_BASE = "https://join.synq.app";

function shareBaseFromEnv() {
  const raw =
    typeof process.env.EXPO_PUBLIC_SYNQ_SHARE_BASE === "string" &&
    process.env.EXPO_PUBLIC_SYNQ_SHARE_BASE.trim()
      ? process.env.EXPO_PUBLIC_SYNQ_SHARE_BASE.trim()
      : DEFAULT_SHARE_BASE;
  return raw.replace(/\/$/, "");
}

function shareHostFromEnv() {
  try {
    return new URL(shareBaseFromEnv()).hostname;
  } catch {
    return "new-synq-main.web.app";
  }
}

/** @param {{ config: import("@expo/config").ExpoConfig }} param0 */
module.exports = ({ config }) => {
  const shareHost = shareHostFromEnv();

  return {
    ...config,
    platforms: ["ios", "android"],
    ios: {
      ...config.ios,
      associatedDomains: [`applinks:${shareHost}`],
    },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: shareHost,
              pathPrefix: "/u",
            },
            {
              scheme: "https",
              host: shareHost,
              pathPrefix: "/open",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...config.extra,
      synqShareHost: shareHost,
      synqShareWebBase: `https://${shareHost}`,
    },
  };
};

module.exports.DEFAULT_SHARE_BASE = DEFAULT_SHARE_BASE;
module.exports.PRODUCTION_SHARE_BASE = PRODUCTION_SHARE_BASE;
