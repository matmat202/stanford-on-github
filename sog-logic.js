/* Pure logic for Stanford on GitHub: filters, sorts, the "new this year" window, URL
 * state. No DOM; tested by site/sog-logic.test.mjs. A repo is the array build.py writes:
 *   [full_name, description, stars, forks, language, created, pushed, archived, topics, org]
 */
export const R = { NAME: 0, DESC: 1, STARS: 2, FORKS: 3, LANG: 4, CREATED: 5, PUSHED: 6, ARCHIVED: 7, TOPICS: 8, ORG: 9 };
export const KINDS = ['', 'lab', 'course', 'club'];
export const SORTS = ['stars', 'new', 'active'];

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

const DAY = 86400000;
const t = (iso) => Date.parse(`${iso}T00:00:00Z`);
// "New" means created in the 365 days before the data was fetched — not before today,
// or the page would quietly empty itself as the snapshot ages.
export const isNew = (repo, fetched) => !!repo[R.CREATED] && t(fetched) - t(repo[R.CREATED]) <= 365 * DAY && t(repo[R.CREATED]) <= t(fetched);

export function filterRepos(repos, orgKind, { kind = '', lang = '', org = '', q = '', sort = 'stars', fetched } = {}) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return repos.filter((r) => {
    if (kind && orgKind.get(r[R.ORG]) !== kind) return false;
    if (lang && r[R.LANG] !== lang) return false;
    if (org && r[R.ORG] !== org) return false;
    if (sort === 'new' && !isNew(r, fetched)) return false;
    if (!words.length) return true;
    const hay = fold(`${r[R.NAME]} ${r[R.DESC]} ${r[R.TOPICS].join(' ')} ${r[R.LANG]}`);
    return words.every((w) => hay.includes(w));
  });
}

// Ties always break by name so the order is the same on every load.
export function sortRepos(list, sort = 'stars') {
  const byName = (a, b) => (a[R.NAME].toLowerCase() < b[R.NAME].toLowerCase() ? -1 : 1);
  const out = [...list];
  if (sort === 'active') return out.sort((a, b) => (a[R.PUSHED] < b[R.PUSHED] ? 1 : a[R.PUSHED] > b[R.PUSHED] ? -1 : 0) || b[R.STARS] - a[R.STARS] || byName(a, b));
  return out.sort((a, b) => b[R.STARS] - a[R.STARS] || byName(a, b));
}

export function fmtStars(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// "today", "3 days ago", "5 months ago", "2 years ago", relative to the snapshot date.
export function ago(iso, fetched) {
  if (!iso) return '';
  const d = Math.round((t(fetched) - t(iso)) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 45) return `${d} days ago`;
  const m = Math.round(d / 30.44);
  if (m < 18) return `${m} months ago`;
  return `${Math.round(d / 365.25)} years ago`;
}

export function encodeState(s) {
  const p = new URLSearchParams();
  for (const [k, def] of [['kind', ''], ['lang', ''], ['org', ''], ['q', ''], ['sort', 'stars']]) {
    const v = (s[k] || '').trim();
    if (v && v !== def) p.set(k, v);
  }
  const out = p.toString();
  return out ? `?${out}` : '';
}
export function decodeState(search, { langs, orgs }) {
  const p = new URLSearchParams(search || '');
  const pick = (k, ok) => { const v = p.get(k) || ''; return ok(v) ? v : ''; };
  return {
    kind: pick('kind', (v) => KINDS.includes(v)),
    lang: pick('lang', (v) => langs.has(v)),
    org: pick('org', (v) => orgs.has(v)),
    q: (p.get('q') || '').slice(0, 80),
    sort: pick('sort', (v) => SORTS.includes(v)) || 'stars',
  };
}
