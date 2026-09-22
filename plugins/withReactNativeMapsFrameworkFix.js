/**
 * With use_frameworks!:static, react-native-maps can fail Xcode builds with
 * -Werror,-Wnon-modular-include-in-framework-module when its public headers
 * import React-Core headers. Allow non-modular includes for that pod.
 */
const { withPodfile } = require("@expo/config-plugins");

const MARKER = "synq-react-native-maps-non-modular-headers";

const PATCH = `
    # @generated begin ${MARKER} - expo prebuild (do not modify)
    installer.pods_project.targets.each do |target|
      if target.name.include?('react-native-maps')
        target.build_configurations.each do |bc|
          bc.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        end
      end
    end
    # @generated end ${MARKER}
`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withReactNativeMapsFrameworkFix(config) {
  return withPodfile(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      return cfg;
    }

    // Prefer inserting inside the existing post_install block.
    const postInstallMatch = contents.match(
      /post_install\s+do\s+\|installer\|[^\n]*\n/
    );
    if (postInstallMatch && postInstallMatch.index != null) {
      const insertAt =
        postInstallMatch.index + postInstallMatch[0].length;
      contents =
        contents.slice(0, insertAt) + PATCH + contents.slice(insertAt);
    } else {
      contents += `

post_install do |installer|
${PATCH}
end
`;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withReactNativeMapsFrameworkFix;
