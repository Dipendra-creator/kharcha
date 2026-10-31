import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Linking, View } from 'react-native';

import { ProgressBar } from '@/components/charts';
import { AppText } from '@/components/text';
import { Button, Card } from '@/components/ui';
import { useTheme, withAlpha } from '@/theme/theme';
import { spacing } from '@/theme/tokens';

import { RELEASES_PAGE } from './release';
import { canSelfUpdate, checkForUpdate, CURRENT_VERSION, installUpdate, useUpdate } from './updater';

const mb = (bytes: number) => `${Math.round(bytes / 1_048_576)} MB`;

/** Settings card: checks GitHub for a newer release and installs it in place. */
export function UpdateCard() {
  const { c } = useTheme();
  const state = useUpdate();

  // One automatic check per app session; the button checks again on demand.
  useEffect(() => {
    if (useUpdate.getState().status === 'idle') checkForUpdate();
  }, []);

  const release = 'release' in state ? state.release : null;
  const newer = release && state.status !== 'error' ? release : null;
  const title = newer ? `Version ${newer.version} is available` : `Kharcha ${CURRENT_VERSION}`;
  const line =
    state.status === 'checking'
      ? 'Checking for updates…'
      : state.status === 'current'
        ? "You're on the latest version."
        : state.status === 'error'
          ? state.message
          : state.status === 'downloading'
            ? `Downloading… ${Math.round(state.progress * 100)}%${newer?.apk ? ` of ${mb(newer.apk.size)}` : ''}`
            : state.status === 'ready'
              ? 'Downloaded. Tap Install if the installer closed. Your data stays as it is.'
              : newer
                ? newer.summary || `You have ${CURRENT_VERSION}.`
                : 'Updates come from GitHub Releases.';

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: newer ? withAlpha(c.accentGraphic, 0.16) : c.raised,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={newer ? 'cloud-download' : 'cloud-done-outline'} size={22} color={newer ? c.accentGraphic : c.textMuted} />
        </View>
        <View style={{ flex: 1 }} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${title}. ${line}`}>
          <AppText variant="body" weight="semibold">
            {title}
          </AppText>
          <AppText variant="caption" color={state.status === 'error' ? 'over' : 'textMuted'}>
            {line}
          </AppText>
        </View>
      </View>

      {state.status === 'downloading' ? <ProgressBar ratio={state.progress} color={c.accentGraphic} track={c.raised} /> : null}

      {release && state.status !== 'current' && state.status !== 'checking' ? (
        canSelfUpdate && release.apk ? (
          <Button
            title={state.status === 'ready' ? `Install ${release.version}` : `Download & install ${release.version}`}
            icon="download-outline"
            loading={state.status === 'downloading'}
            onPress={() => installUpdate(release)}
          />
        ) : (
          <Button title="Open release page" icon="open-outline" onPress={() => Linking.openURL(release.page)} />
        )
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Check for updates"
          icon="refresh"
          variant="secondary"
          size="sm"
          loading={state.status === 'checking'}
          disabled={state.status === 'downloading'}
          onPress={checkForUpdate}
          style={{ flex: 1 }}
        />
        <Button
          title="What's new"
          variant="ghost"
          size="sm"
          onPress={() => Linking.openURL(release?.page ?? RELEASES_PAGE)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}
