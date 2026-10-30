// Signs Android release builds with the Kharcha upload key when its Gradle
// properties are set (in ~/.gradle/gradle.properties, never in the repo):
//   KHARCHA_UPLOAD_STORE_FILE, KHARCHA_UPLOAD_STORE_PASSWORD,
//   KHARCHA_UPLOAD_KEY_ALIAS, KHARCHA_UPLOAD_KEY_PASSWORD
// Without them, release builds fall back to the debug key (installable, not publishable).
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (project.hasProperty('KHARCHA_UPLOAD_STORE_FILE')) {
                storeFile file(KHARCHA_UPLOAD_STORE_FILE)
                storePassword KHARCHA_UPLOAD_STORE_PASSWORD
                keyAlias KHARCHA_UPLOAD_KEY_ALIAS
                keyPassword KHARCHA_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('KHARCHA_UPLOAD_STORE_FILE')) return cfg;

    const signingStart = gradle.indexOf('signingConfigs {');
    const buildTypesStart = gradle.indexOf('buildTypes {');
    if (signingStart < 0 || buildTypesStart < 0) {
      throw new Error('with-release-signing: unexpected android/app/build.gradle layout');
    }
    gradle = gradle.replace('signingConfigs {', `signingConfigs {${RELEASE_CONFIG}`);

    // Only the release build type's signingConfig changes; debug keeps the debug key.
    const releaseStart = gradle.indexOf('release {', gradle.indexOf('buildTypes {'));
    const debugRef = gradle.indexOf('signingConfig signingConfigs.debug', releaseStart);
    gradle =
      gradle.slice(0, debugRef) +
      "signingConfig project.hasProperty('KHARCHA_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug" +
      gradle.slice(debugRef + 'signingConfig signingConfigs.debug'.length);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
