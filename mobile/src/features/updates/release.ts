/** Kharcha ships through GitHub Releases: tag `v<version>` with a signed `kharcha-v<version>.apk` attached. */
const REPO = 'Dipendra-creator/kharcha';
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export type Release = {
  version: string;
  /** First paragraph of the release notes, without Markdown. */
  summary: string;
  page: string;
  apk: { url: string; size: number; sha256: string | null } | null;
};

/** The parts of GitHub's release payload Kharcha reads. */
export type GithubRelease = {
  tag_name: string;
  html_url: string;
  body?: string | null;
  assets?: { name: string; browser_download_url: string; size: number; digest?: string | null }[];
};

const parts = (v: string) => v.trim().replace(/^v/i, '').split('.').map((n) => Number.parseInt(n, 10) || 0);

/** Compares dotted versions numerically ("0.10.0" is newer than "0.9.3"): negative, 0 or positive. */
export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

const SUMMARY_MAX = 280;

function summarise(body: string): string {
  const first = body.trim().split(/\n\s*\n/)[0] ?? '';
  const plain = first
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > SUMMARY_MAX ? `${plain.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : plain;
}

export function parseRelease(r: GithubRelease): Release {
  const asset = r.assets?.find((a) => a.name.endsWith('.apk'));
  const digest = asset?.digest?.toLowerCase();
  return {
    version: r.tag_name.replace(/^v/i, ''),
    summary: summarise(r.body ?? ''),
    page: r.html_url,
    apk: asset
      ? { url: asset.browser_download_url, size: asset.size, sha256: digest?.startsWith('sha256:') ? digest.slice(7) : null }
      : null,
  };
}
