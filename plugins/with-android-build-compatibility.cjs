const { withGradleProperties } = require('expo/config-plugins');

// LiteRT-LM uses Kotlin 2.4 metadata, which Kotlin 2.3 can read.
// SDK 58's root template honors this property without rewriting its classpath.
module.exports = function withAndroidBuildCompatibility(config) {
  return withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((entry) => entry.key !== 'android.kotlinVersion');
    mod.modResults.push({ type: 'property', key: 'android.kotlinVersion', value: '2.3.20' });
    return mod;
  });
};
