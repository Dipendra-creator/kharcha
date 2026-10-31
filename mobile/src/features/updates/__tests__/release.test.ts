import { compareVersions, parseRelease } from '../release';

describe('compareVersions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('0.10.0', '0.9.3')).toBeGreaterThan(0);
    expect(compareVersions('v0.4.0', '0.4.0')).toBe(0);
    expect(compareVersions('0.4', '0.4.0')).toBe(0);
    expect(compareVersions('0.3.0', '0.4.0')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0);
  });
});

describe('parseRelease', () => {
  const asset = (name: string, digest?: string) => ({
    name,
    browser_download_url: `https://github.com/x/releases/download/v0.4.0/${name}`,
    size: 96_544_763,
    digest,
  });

  it('finds the APK, its SHA-256 and a plain summary', () => {
    const release = parseRelease({
      tag_name: 'v0.4.0',
      html_url: 'https://github.com/x/releases/tag/v0.4.0',
      body: 'Kharcha **updates itself** now — see [Settings](https://x).\n\n**Install:** download `kharcha-v0.4.0.apk`.',
      assets: [asset('kharcha-v0.4.0.apk.sha256'), asset('kharcha-v0.4.0.apk', 'sha256:ABC123')],
    });
    expect(release).toEqual({
      version: '0.4.0',
      summary: 'Kharcha updates itself now — see Settings.',
      page: 'https://github.com/x/releases/tag/v0.4.0',
      apk: { url: 'https://github.com/x/releases/download/v0.4.0/kharcha-v0.4.0.apk', size: 96_544_763, sha256: 'abc123' },
    });
  });

  it('copes with a release without an APK, notes or digest', () => {
    expect(parseRelease({ tag_name: '0.5.0', html_url: 'u', body: null, assets: [] })).toMatchObject({ version: '0.5.0', summary: '', apk: null });
    expect(parseRelease({ tag_name: 'v1', html_url: 'u', assets: [asset('k.apk')] }).apk?.sha256).toBeNull();
  });
});
