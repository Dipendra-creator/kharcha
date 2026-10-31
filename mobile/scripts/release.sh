#!/usr/bin/env bash
# Ships the version in app.json: checks → signed APK → push main → GitHub release.
# The in-app updater (src/features/updates) reads these releases, so keep the
# tag (v<version>) and the asset name (kharcha-v<version>.apk) exactly as they are.
#
# Usage, from mobile/ with everything committed on main:
#   scripts/release.sh <release-notes.md>
set -euo pipefail

cd "$(dirname "$0")/.."

# Certificate of the Kharcha upload key. Android only installs an update signed with the same key.
RELEASE_CERT_SHA256=f0729538423c1b1e498c4ad7042addc09fcc5864f1fe3d06d86bda191b86c1b9
ABIS=arm64-v8a,armeabi-v7a
export ANDROID_HOME=${ANDROID_HOME:-$HOME/Library/Android/sdk}

die() {
  echo "release: $*" >&2
  exit 1
}
step() { printf '\n› %s\n' "$*"; }

NOTES=${1:-}
[[ -n $NOTES && -f $NOTES ]] || die "usage: scripts/release.sh <release-notes.md>"

VERSION=$(node -p "require('./app.json').expo.version")
TAG="v$VERSION"
APK_NAME="kharcha-$TAG.apk"

step "Preflight for $TAG"
[[ $(git branch --show-current) == main ]] || die "releases ship from main"
[[ -z $(git status --porcelain) ]] || die "commit everything first (git status is not clean)"
git fetch -q origin main
git merge-base --is-ancestor origin/main HEAD || die "origin/main has commits this branch doesn't; pull first"
gh release view "$TAG" >/dev/null 2>&1 && die "$TAG is already released; bump version and android.versionCode in app.json"
LATEST=$(gh release view --json tagName -q .tagName 2>/dev/null || true)
if [[ -n $LATEST && $(printf '%s\n%s\n' "${LATEST#v}" "$VERSION" | sort -V | tail -1) != "$VERSION" ]]; then
  die "$TAG is not newer than the latest release $LATEST"
fi

step "Checks"
npx tsc --noEmit
npx expo lint
npx jest --silent

step "Building $APK_NAME ($ABIS)"
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$ABIS")
APK=android/app/build/outputs/apk/release/app-release.apk

step "Verifying the signature"
APKSIGNER=$(ls -d "$ANDROID_HOME"/build-tools/*/apksigner | sort -V | tail -1)
CERT=$("$APKSIGNER" verify --print-certs "$APK" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')
[[ $CERT == "$RELEASE_CERT_SHA256" ]] ||
  die "APK is signed with ${CERT:-nothing}, not the Kharcha release key (KHARCHA_UPLOAD_* in ~/.gradle/gradle.properties)"

DIST=dist/release
rm -rf "$DIST"
mkdir -p "$DIST"
cp "$APK" "$DIST/$APK_NAME"
(cd "$DIST" && shasum -a 256 "$APK_NAME" >"$APK_NAME.sha256")
{
  cat "$NOTES"
  printf '\nSigned with the Kharcha release key. Certificate SHA-256: `%s`\n' "$(sed 's/../&:/g; s/:$//' <<<"$RELEASE_CERT_SHA256")"
} >"$DIST/notes.md"

step "Publishing $TAG"
git push origin main
gh release create "$TAG" "$DIST/$APK_NAME" "$DIST/$APK_NAME.sha256" \
  --target "$(git rev-parse HEAD)" \
  --title "Kharcha $TAG (Android)" \
  --notes-file "$DIST/notes.md" \
  --latest
echo
gh release view "$TAG" --json url -q .url
