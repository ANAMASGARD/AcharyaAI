const { withGradleProperties, withProjectBuildGradle, withSettingsGradle } = require('expo/config-plugins');

// Clerk and its transitive Kotlin libraries need newer metadata support than SDK 57 defaults.
module.exports = function withAndroidBuildCompatibility(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((entry) => entry.key !== 'android.kotlinVersion');
    mod.modResults.push({ type: 'property', key: 'android.kotlinVersion', value: '2.3.20' });
    return mod;
  });
  // Expo's catalog property alone does not override RN's unversioned root compiler plugin.
  config = withProjectBuildGradle(config, (mod) => {
    const original = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const pinned = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.20')";
    if (!mod.modResults.contents.includes(original) && !mod.modResults.contents.includes(pinned)) {
      throw new Error('Android build setup could not locate the root Kotlin compiler plugin. Review the native template.');
    }
    mod.modResults.contents = mod.modResults.contents.replace(original, pinned);
    return mod;
  });
  config = withSettingsGradle(config, (mod) => {
    const marker = '// Acharya R8 Kotlin metadata support';
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents = mod.modResults.contents.replace('pluginManagement {', `pluginManagement {
  ${marker}
  buildscript {
    repositories {
      maven { url = uri('https://storage.googleapis.com/r8-releases/raw'); content { includeModule('com.android.tools', 'r8') } }
      google()
      mavenCentral()
    }
    dependencies { classpath('com.android.tools:r8:9.1.29') }
  }`);
    }
    return mod;
  });
  return config;
};
