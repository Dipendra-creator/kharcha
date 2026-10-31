import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { compareVersions, LATEST_RELEASE_API, parseRelease, type GithubRelease, type Release } from './release';

export const CURRENT_VERSION = Constants.expoConfig?.version ?? '0.0.0';
/** Android installs a downloaded APK over the app; elsewhere the release page is offered instead. */
export const canSelfUpdate = Platform.OS === 'android';

const APK_TYPE = 'application/vnd.android.package-archive';
const updatesDir = () => new Directory(Paths.cache, 'updates');

export type UpdateState =
  | { status: 'idle' | 'checking' | 'current' }
  | { status: 'available'; release: Release }
  | { status: 'downloading'; release: Release; progress: number }
  /** Downloaded and handed to Android's installer; tapping again reopens it without downloading. */
  | { status: 'ready'; release: Release }
  | { status: 'error'; message: string; release: Release | null };

export const useUpdate = create<UpdateState>(() => ({ status: 'idle' }));
const set = (state: UpdateState) => useUpdate.setState(state, true);

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function clearDownloads(): void {
  try {
    const dir = updatesDir();
    if (dir.exists) dir.delete();
  } catch {
    // The OS clears the cache eventually.
  }
}

/** Asks GitHub for the latest release. Ignored while a check or download is running. */
export async function checkForUpdate(): Promise<void> {
  const { status } = useUpdate.getState();
  if (status === 'checking' || status === 'downloading') return;
  set({ status: 'checking' });
  try {
    const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } }).catch(() => {
      throw new Error("Couldn't reach GitHub. Check your connection and try again.");
    });
    if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting update checks. Try again in an hour.');
    if (!res.ok) throw new Error(`GitHub answered ${res.status}. Try again later.`);
    const release = parseRelease((await res.json()) as GithubRelease);
    if (compareVersions(release.version, CURRENT_VERSION) > 0) {
      set({ status: 'available', release });
    } else {
      set({ status: 'current' });
      if (canSelfUpdate) clearDownloads();
    }
  } catch (e) {
    set({ status: 'error', message: message(e), release: null });
  }
}

/**
 * Downloads the release's APK (reusing a finished download), checks it against
 * the SHA-256 GitHub publishes, and opens Android's installer. Android asks once
 * to allow installs from Kharcha, and only accepts an APK signed with the same
 * key as the installed app.
 */
export async function installUpdate(release: Release): Promise<void> {
  const apk = release.apk;
  if (!canSelfUpdate || !apk || useUpdate.getState().status === 'downloading') return;
  set({ status: 'downloading', release, progress: 0 });
  try {
    const dir = updatesDir();
    const file = new File(dir, `kharcha-v${release.version}.apk`);
    if (!file.exists || file.size !== apk.size) {
      if (dir.exists) dir.delete();
      dir.create();
      let shown = 0;
      await File.downloadFileAsync(apk.url, file, {
        onProgress: ({ bytesWritten }) => {
          // Whole percents only, so the screen isn't re-rendered for every chunk.
          const progress = Math.floor((bytesWritten / apk.size) * 100) / 100;
          if (progress <= shown) return;
          shown = progress;
          set({ status: 'downloading', release, progress });
        },
      });
      if (file.size !== apk.size) throw new Error('The download was cut short. Try again.');
    }
    if (apk.sha256 && (await file.digest('SHA-256')) !== apk.sha256) {
      file.delete();
      throw new Error("The download doesn't match the release. Try again.");
    }
    set({ status: 'ready', release });
    await file.preview({ mimeType: APK_TYPE });
  } catch (e) {
    set({ status: 'error', message: message(e), release });
  }
}
