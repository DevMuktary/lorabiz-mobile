const fs = require('fs');
const path = require('path');

const ROOT_MOBILE = path.resolve(__dirname, '..');
const KEYSTORE_SRC = path.join(ROOT_MOBILE, 'release.keystore');
const ANDROID_APP_DIR = path.join(ROOT_MOBILE, 'android', 'app');
const KEYSTORE_DEST = path.join(ANDROID_APP_DIR, 'release.keystore');
const BUILD_GRADLE = path.join(ANDROID_APP_DIR, 'build.gradle');

console.log('=== CONFIGURING ANDROID RELEASE SIGNING ===');

// 1. Copy release.keystore into android/app/
if (fs.existsSync(KEYSTORE_SRC)) {
  fs.copyFileSync(KEYSTORE_SRC, KEYSTORE_DEST);
  console.log(`Copied release.keystore to ${KEYSTORE_DEST}`);
} else {
  console.error(`ERROR: release.keystore not found at ${KEYSTORE_SRC}!`);
  process.exit(1);
}

// 2. Patch build.gradle to use release.keystore for release build type
if (!fs.existsSync(BUILD_GRADLE)) {
  console.error(`ERROR: build.gradle not found at ${BUILD_GRADLE}!`);
  process.exit(1);
}

let gradleContent = fs.readFileSync(BUILD_GRADLE, 'utf8');

// Replace signingConfigs block with both debug and release configurations
const targetSigningConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('release.keystore')
            storePassword 'lorabizreleasekey'
            keyAlias 'lorabiz'
            keyPassword 'lorabizreleasekey'
        }
    }`;

gradleContent = gradleContent.replace(/signingConfigs\s*\{[\s\S]*?keyPassword 'android'\s*\}\s*\}/, targetSigningConfigs);

// Specifically replace signingConfig under release { ... }
const releaseOldMarker = 'release {\n            // Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug';
const releaseNewMarker = 'release {\n            signingConfig signingConfigs.release';

if (gradleContent.includes(releaseOldMarker)) {
  gradleContent = gradleContent.replace(releaseOldMarker, releaseNewMarker);
} else {
  // Regex fallback: only replace the signingConfig that appears inside the release block
  gradleContent = gradleContent.replace(
    /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release'
  );
}

fs.writeFileSync(BUILD_GRADLE, gradleContent, 'utf8');
console.log('Successfully updated android/app/build.gradle with Release Keystore configuration.');
