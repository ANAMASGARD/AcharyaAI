const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Opt-in, isolated test application. Never add test workers/endpoints to normal builds.
module.exports = function withNativeEmbeddingGate(config) {
  if (process.env.ACHARYA_NATIVE_GATE !== '1') return config;
  config.name = 'Acharya Native Gate';
  config.scheme = 'acharya-native-gate';
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((entry) => entry.key !== 'acharyaNativeGate');
    mod.modResults.push({ type: 'property', key: 'acharyaNativeGate', value: 'true' });
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    const marker = '// Acharya native feasibility gate';
    mod.modResults.contents = mod.modResults.contents.split(marker)[0];
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents += `
${marker}
android {
  defaultConfig {
    applicationId 'com.acharya.app.nativegate'
    testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'
  }
  testBuildType (findProperty('acharyaGateBuildType') ?: 'debug')
  sourceSets {
    androidTest.java.srcDirs += ["$rootDir/../native-tests/android"]
    androidTest.assets.srcDirs += ["$rootDir/../.expo/native-gate/assets"]
  }
  buildTypes.release {
    minifyEnabled true
    shrinkResources true
    proguardFiles "$rootDir/../native-tests/gate-rules.pro"
  }
}
dependencies {
  androidTestImplementation project(':acharya-embeddings')
  androidTestImplementation project(':expo-sqlite')
  implementation 'androidx.concurrent:concurrent-futures-ktx:1.3.0'
  androidTestImplementation 'androidx.concurrent:concurrent-futures-ktx:1.3.0'
  androidTestImplementation 'androidx.test:runner:1.7.0'
  androidTestImplementation 'androidx.test.ext:junit:1.3.0'
  androidTestImplementation 'androidx.work:work-runtime:2.11.2'
  // Match the app's resolved Media3/Glide Guava; expose ListenableFuture to test compilation.
  androidTestImplementation 'com.google.guava:guava:33.3.1-android'
}
`;
    }
    return mod;
  });
};
