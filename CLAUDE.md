# Kharcha: project rules

Kharcha is an offline daily-budget app: Expo SDK 58 + React Native in `mobile/` (Expo rules in `mobile/AGENTS.md`). It ships to phones as a signed APK on GitHub Releases, and the app updates itself from those releases.

## 1. Always on `main`

- Commit directly on `main` and push to `origin main`. Never create, switch to or push another branch, and never open a pull request.
- Pull first if `origin/main` has moved (`git pull --rebase origin main`).

## 2. Every change ships a release

A change to the app (feature, fix, refactor, dependency, config) is finished only when its APK is published on GitHub Releases. A commit on its own is not enough.

1. In `mobile/app.json`, bump `expo.version` (patch for fixes, minor for features) and increase `expo.android.versionCode` by 1. Android refuses an update whose versionCode isn't higher.
2. Run `npx tsc --noEmit`, `npx expo lint` and `npm test` in `mobile/`, and fix anything that fails.
3. Commit on `main` (version bump included).
4. Write the release notes to a file outside the repo (the scratchpad). The **first paragraph** is one or two plain sentences: the app's update card shows it. Then an `**Install:**` line, then what changed, grouped under short bold headings, written for the person using the phone.
5. `cd mobile && scripts/release.sh <notes.md>`. It runs the checks, builds the release APK, refuses one not signed with the Kharcha key, pushes `main`, and creates release `v<version>` with `kharcha-v<version>.apk` and its `.sha256`.
6. Report the release URL. If any step fails, fix it and run the script again. Never upload an APK by hand.

Changes that touch only `README.md`, `CLAUDE.md`, `docs/`, `.claude/` or `mobile/scripts/` are committed and pushed without a release.

A Stop hook (`.claude/hooks/release-check.sh`, wired in `.claude/settings.json`) enforces this. It won't let Claude finish a turn while app files under `mobile/` are uncommitted, unpushed, or changed since the last `v*` tag. If the work is unfinished or you're waiting on the user, say so and stop; the hook only reminds once per stop.

## 3. The APK must install on any Android phone

- Built for `arm64-v8a` and `armeabi-v7a` (every Android phone of the last decade), Android 7.0+ (minSdk 24).
- Signed with the Kharcha upload key from `~/.gradle/gradle.properties` (`KHARCHA_UPLOAD_*`, wired by `mobile/plugins/with-release-signing.js`). Certificate SHA-256 `f0:72:95:38:42:3c:1b:1e:49:8c:4a:d7:04:2a:dd:c0:9f:cc:58:64:f1:fe:3d:06:d8:6b:da:19:1b:86:c1:b9`. An APK with any other key can't update installed copies; the key never goes in the repo.
- iOS: there is no installable iPhone build (that needs an Apple developer account). Don't claim iOS releases.

## 4. Don't break self-update

`mobile/src/features/updates` reads `https://api.github.com/repos/Dipendra-creator/kharcha/releases/latest` and installs the attached APK.

- Keep the repo name, the tag format `v<version>` and the asset name `kharcha-v<version>.apk`.
- Publish real releases. Drafts and prereleases are invisible to `/releases/latest`.
- Keep `android.permission.REQUEST_INSTALL_PACKAGES` in `app.json`.

## 5. Scope

Kharcha has no server, AI, account or subscription tracking; these were removed in 0.4.0. Everything stays on the phone, and the only network call is the update check. Don't add any of these back unless asked.

`mobile/android` and `mobile/ios` are generated (Continuous Native Generation): change native behaviour through `app.json` and config plugins, never by editing those folders.
