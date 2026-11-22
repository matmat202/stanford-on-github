/* Pure logic for Stanford on GitHub: filters, sorts, the "new this year" window, URL
 * state. No DOM; tested by site/sog-logic.test.mjs. A repo is the array build.py writes:
 *   [full_name, description, stars, forks, language, created, pushed, archived, topics, org, gain]
 * gain is stars gained since the data's gain_since fetch, or null where that is unknown.
 */
export const R = { NAME: 0, DESC: 1, STARS: 2, FORKS: 3, LANG: 4, CREATED: 5, PUSHED: 6, ARCHIVED: 7, TOPICS: 8, ORG: 9, GAIN: 10 };
// An open first issue, as build.py writes it (unassigned, in a listed, unarchived repo):
//   [repo full_name, number, title, labels, created, updated, comments]
export const I = { REPO: 0, NUM: 1, TITLE: 2, LABELS: 3, CREATED: 4, UPDATED: 5, COMMENTS: 6 };
export const KINDS = ['', 'lab', 'course', 'club'];
export const VIEWS = ['repos', 'issues'];
export const SORTS = ['stars', 'rising', 'new', 'active'];

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

const DAY = 86400000;
const t = (iso) => Date.parse(`${iso}T00:00:00Z`);
// "New" means created in the 365 days before the data was fetched — not before today,
// or the page would quietly empty itself as the snapshot ages.
export const isNew = (repo, fetched) => !!repo[R.CREATED] && t(fetched) - t(repo[R.CREATED]) <= 365 * DAY && t(repo[R.CREATED]) <= t(fetched);

// A search word in the plural also finds the singular: "robots" read 7 repos where "robot"
// read 69, "llms" 16 where "llm" read 61 (shipped data, 2026-11-13). The word is cut to a
// stem that both forms start with ("libraries" -> "librar"); -ss, -us and -is endings are
// not plurals ("class", "corpus", "analysis") and are left whole, as are the words in
// WHOLE, where the cut would change the meaning ("news" -> "new" matched 30 repos).
const WHOLE = new Set(['news', 'series', 'species', 'lens', 'gas', 'yes']);
export function stem(w) {
  if (WHOLE.has(w)) return w;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3);
  if (w.length >= 4 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

// A search word also finds its other forms: "planner" read 0 repos where "planning" read 24,
// "optimizer" 7 where "optimization" read 55, "retriever" 0 where "retrieval" read 8 (shipped
// data, 2026-11-21). The word is cut to a root ("parser" -> "pars", "optimization" -> "optim")
// and the root then matches only as the start of a whole word followed by one of the endings
// in TAIL, so "pars" finds "parse", "parsing" and "parsers" but not "sparse" or "comparison".
// -ion is cut before -ation ("generation" -> "generat"), or "general" would match. Roots under
// four letters are not used ("vision" -> "vis", "user" -> "us"). This only ever adds matches:
// the word itself still matches anywhere, as before.
const CUT = /(ization|isation|ion|ing|er|or|ed|ize|ise|e)$/;
const TAIL = '(?:iz|is)?(?:at)?(?:ion|or|ing|er|ed|al|e)?s?';
// [root, doubled]: doubled when the cut left a doubled consonant, undone ("planning" -> "plan").
function cut(w) {
  const m = /^[a-z0-9]+$/.test(w) && w.match(CUT);
  if (!m) return ['', false];
  const r = w.slice(0, -m[1].length);
  const dbl = /([b-df-hj-np-tv-z])\1$/.test(r);
  const out = dbl ? r.slice(0, -1) : r;
  return out.length >= 4 ? [out, dbl] : ['', false];
}
export const root = (w) => cut(w)[0];
// After an undone double only the endings that double are allowed, or "planner" -> "plan"
// would take "plane" (7 repos) through the -e ending.
function matcher(w) {
  const [r, dbl] = cut(w);
  if (!r) return (hay) => hay.includes(w);
  const tail = dbl ? `(?:${r.slice(-1)}?(?:ing|er|ed))?s?` : TAIL;
  const re = new RegExp(`(?<![a-z0-9])${r}${tail}(?![a-z0-9])`);
  return (hay) => hay.includes(w) || re.test(hay);
}
const terms = (q) => fold(q).split(/\s+/).filter(Boolean).map(stem).map(matcher);

// What tapping a topic tag searches for. Only 465 of 2,400 repos carry topics, so an
// exact-topic filter would be the narrow answer ('nlp': 12 tagged, 130 by search); the
// hyphen becomes a space so 'deep-learning' also finds "deep learning" in a description.
export const topicQuery = (topic) => String(topic ?? '').replace(/[-_]+/g, ' ').trim().slice(0, 80);

// orgName (login -> the group's display name) puts the name each row shows in "all from …"
// into the search: "intelligent systems" found none of sisl's 171 repos without it.
export function filterRepos(repos, orgKind, { kind = '', lang = '', org = '', q = '', sort = 'stars', fetched, orgName } = {}) {
  const words = terms(q);
  return repos.filter((r) => {
    if (kind && orgKind.get(r[R.ORG]) !== kind) return false;
    if (lang && r[R.LANG] !== lang) return false;
    if (org && r[R.ORG] !== org) return false;
    if (sort === 'new' && !isNew(r, fetched)) return false;
    // A repo whose earlier count is unknown cannot be ranked by gain, so it is left out
    // rather than sorted to the bottom, where it would read as "gained nothing".
    if (sort === 'rising' && !Number.isFinite(r[R.GAIN])) return false;
    if (!words.length) return true;
    const hay = fold(`${r[R.NAME]} ${r[R.DESC]} ${r[R.TOPICS].join(' ')} ${r[R.LANG]} ${orgName?.get(r[R.ORG]) ?? ''}`);
    return words.every((m) => m(hay));
  });
}

// Ties always break by name so the order is the same on every load.
export function sortRepos(list, sort = 'stars') {
  const byName = (a, b) => (a[R.NAME].toLowerCase() < b[R.NAME].toLowerCase() ? -1 : 1);
  const out = [...list];
  if (sort === 'rising') return out.sort((a, b) => (b[R.GAIN] ?? -Infinity) - (a[R.GAIN] ?? -Infinity) || b[R.STARS] - a[R.STARS] || byName(a, b));
  if (sort === 'active') return out.sort((a, b) => (a[R.PUSHED] < b[R.PUSHED] ? 1 : a[R.PUSHED] > b[R.PUSHED] ? -1 : 0) || b[R.STARS] - a[R.STARS] || byName(a, b));
  return out.sort((a, b) => b[R.STARS] - a[R.STARS] || byName(a, b));
}

// A repo is "quiet" when nobody has pushed to it in the 183 days before the snapshot:
// an issue there is open, but nobody may be around to review the pull request.
export const isQuiet = (repo, fetched) => !repo || !repo[R.PUSHED] || t(fetched) - t(repo[R.PUSHED]) > 183 * DAY;

// repoBy maps full_name -> repo row, so the repo-level filters (kind, language, org) and
// the search over the repo's own description apply to its issues too.
export function filterIssues(issues, repoBy, orgKind, { kind = '', lang = '', org = '', q = '', quiet = false, fetched, orgName } = {}) {
  const words = terms(q);
  return issues.filter((i) => {
    const r = repoBy.get(i[I.REPO]);
    if (!r) return false;
    if (!quiet && isQuiet(r, fetched)) return false;
    if (kind && orgKind.get(r[R.ORG]) !== kind) return false;
    if (lang && r[R.LANG] !== lang) return false;
    if (org && r[R.ORG] !== org) return false;
    if (!words.length) return true;
    const hay = fold(`${i[I.TITLE]} ${i[I.LABELS].join(' ')} ${r[R.NAME]} ${r[R.DESC]} ${r[R.TOPICS].join(' ')} ${r[R.LANG]} ${orgName?.get(r[R.ORG]) ?? ''}`);
    return words.every((m) => m(hay));
  });
}

// Most recently updated first; ties by repo name, then newest issue number.
export function sortIssues(list) {
  return [...list].sort((a, b) => (a[I.UPDATED] < b[I.UPDATED] ? 1 : a[I.UPDATED] > b[I.UPDATED] ? -1 : 0)
    || (a[I.REPO].toLowerCase() < b[I.REPO].toLowerCase() ? -1 : a[I.REPO].toLowerCase() > b[I.REPO].toLowerCase() ? 1 : 0)
    || b[I.NUM] - a[I.NUM]);
}

// "+1.2k", "+37", "0", "−4": a gain as a row shows it.
export function fmtGain(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 0) return `\u2212${fmtStars(-n)}`;
  return n ? `+${fmtStars(n)}` : '0';
}

export function fmtStars(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

// The date "ago" is measured to: the visitor's today, never earlier than the snapshot.
// Measured to the snapshot alone, a push on the fetch day read "pushed today" for as long
// as the data went unrefreshed (on 2026-11-12, CoreNLP's 10-26 push). The filters keep the
// snapshot as their clock (isNew, isQuiet); only the words a visitor reads move.
export const asOf = (fetched, today) => (today && t(today) > t(fetched) ? today : fetched);
// "Data from 2026-10-26, 17 days ago." once the snapshot is two or more days old, else ''.
export function staleNote(fetched, today) {
  const d = Math.round((t(asOf(fetched, today)) - t(fetched)) / DAY);
  return d >= 2 ? `Data from ${fetched}, ${ago(fetched, today)}.` : '';
}

// "today", "3 days ago", "5 months ago", "2 years ago", relative to `fetched` (pass asOf).
export function ago(iso, fetched) {
  if (!iso) return '';
  const d = Math.round((t(fetched) - t(iso)) / DAY);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 45) return `${d} days ago`;
  // 45 days rounds to one month and 533-547 days to one year: "1 months ago" read on 20
  // shipped rows until 2026-10-27.
  const m = Math.round(d / 30.44);
  if (m < 18) return m === 1 ? '1 month ago' : `${m} months ago`;
  const y = Math.round(d / 365.25);
  return y === 1 ? '1 year ago' : `${y} years ago`;
}

export function encodeState(s) {
  const p = new URLSearchParams();
  for (const [k, def] of [['view', 'repos'], ['kind', ''], ['lang', ''], ['org', ''], ['q', ''], ['sort', 'stars']]) {
    const v = (s[k] || '').trim();
    if (v && v !== def) p.set(k, v);
  }
  if (s.quiet) p.set('quiet', '1');
  const out = p.toString();
  return out ? `?${out}` : '';
}
export function decodeState(search, { langs, orgs }) {
  const p = new URLSearchParams(search || '');
  const pick = (k, ok) => { const v = p.get(k) || ''; return ok(v) ? v : ''; };
  return {
    view: pick('view', (v) => VIEWS.includes(v)) || 'repos',
    quiet: p.get('quiet') === '1',
    kind: pick('kind', (v) => KINDS.includes(v)),
    lang: pick('lang', (v) => langs.has(v)),
    org: pick('org', (v) => orgs.has(v)),
    q: (p.get('q') || '').slice(0, 80),
    sort: pick('sort', (v) => SORTS.includes(v)) || 'stars',
  };
}
