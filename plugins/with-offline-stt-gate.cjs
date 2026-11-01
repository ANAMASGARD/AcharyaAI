const { withAppBuildGradle } = require('expo/config-plugins');

/** Synthetic recorder integration entry; isolated package, enabled only by an explicit Gradle flag. */
module.exports = function withOfflineSttGate(config) {
  return withAppBuildGradle(config, mod => {
    const marker = '// Acharya offline speech test gate';
    if (!mod.modResults.contents.includes(marker)) mod.modResults.contents += `
${marker}
if (findProperty('acharyaSttGate') == 'true') {
  android.defaultConfig.applicationId 'com.acharya.app.sttgate'
  android.defaultConfig.testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'
  android.testBuildType (findProperty('acharyaGateBuildType') ?: 'debug')
  android.sourceSets.androidTest.java.srcDirs += ["$rootDir/../native-tests/stt-android"]
  android.buildTypes.release.proguardFiles file("$rootDir/../native-tests/stt-gate-rules.pro")
  dependencies {
    androidTestImplementation project(':acharya-embeddings')
    androidTestImplementation 'androidx.test:runner:1.7.0'
    androidTestImplementation 'androidx.test.ext:junit:1.3.0'
  }
  android.sourceSets.debug.manifest.srcFile file("$rootDir/../native-tests/offline-stt-manifest.xml")
  android.sourceSets.release.manifest.srcFile file("$rootDir/../native-tests/offline-stt-manifest.xml")
  react {
    entryFile.set(file("$rootDir/../native-tests/offline-stt-entry.tsx"))
    debuggableVariants.set([])
  }
}
`;
    return mod;
  });
};
