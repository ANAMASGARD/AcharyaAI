const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Keep native libraries uncompressed for direct loading and smaller installed size.
// Device-specific APKs remove other CPUs, not features; the AAB retains every ABI.
module.exports = function withCompactAndroidRelease(config) {
  config = withGradleProperties(config, (mod) => {
    const properties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableBundleCompression': 'true',
    };
    mod.modResults = mod.modResults.filter((entry) => !(entry.key in properties));
    for (const [key, value] of Object.entries(properties)) {
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    const marker = '// Acharya compact APK packaging';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `
${marker}
android {
  splits {
    abi {
      enable (findProperty('acharya.splitApks') == 'true')
      reset()
      include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
      universalApk true
    }
  }
}
`;
    }
    return mod;
  });
};
