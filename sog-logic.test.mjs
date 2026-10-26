// node site/sog-logic.test.mjs — the page's pure logic, plus the shipped data checked
// against the rules that read it. Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as L from './sog-logic.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

const mk = (name, stars, lang, created, pushed, org, desc = '', topics = []) => [name, desc, stars, 0, lang, created, pushed, 0, topics, org];
// five, deliberately out of order (a two-element sort hides comparator bugs)
const repos = [
  mk('b/glove', 7000, 'C', '2014-08-01', '2024-01-01', 'b', 'Word vectors', ['nlp']),
  mk('a/dspy', 38000, 'Python', '2023-01-10', '2026-10-20', 'a', 'Programming, not prompting', ['llm']),
  mk('c/cs336', 4000, 'Python', '2026-03-01', '2026-06-01', 'c', 'Lectures'),
  mk('a/zeta', 7000, 'Python', '2026-10-25', '2026-10-25', 'a', 'Café tools'),
  mk('d/old', 10, 'Julia', '2010-01-01', '2012-01-01', 'd', ''),
];
const kinds = new Map([['a', 'lab'], ['b', 'lab'], ['c', 'course'], ['d', 'club']]);
const F = '2026-10-26';
const names = (l) => l.map((r) => r[0]);

eq('stars desc, ties by name', names(L.sortRepos(repos, 'stars')), ['a/dspy', 'a/zeta', 'b/glove', 'c/cs336', 'd/old']);
eq('active = most recently pushed', names(L.sortRepos(repos, 'active')), ['a/zeta', 'a/dspy', 'c/cs336', 'b/glove', 'd/old']);
ok('sort does not mutate', repos[0][0] === 'b/glove');
eq('kind filter', names(L.filterRepos(repos, kinds, { kind: 'course', fetched: F })), ['c/cs336']);
eq('language filter', names(L.filterRepos(repos, kinds, { lang: 'Julia', fetched: F })), ['d/old']);
eq('org filter', names(L.filterRepos(repos, kinds, { org: 'a', fetched: F })), ['a/dspy', 'a/zeta']);
eq('new = created within a year of the snapshot', names(L.filterRepos(repos, kinds, { sort: 'new', fetched: F })), ['c/cs336', 'a/zeta']);
ok('new is relative to the snapshot, not to today', L.isNew(mk('x', 1, '', '2026-01-01', '', 'a'), '2026-06-01') && !L.isNew(mk('x', 1, '', '2026-01-01', '', 'a'), '2027-06-01'));
ok('exactly 365 days is still new', L.isNew(mk('x', 1, '', '2025-10-26', '', 'a'), F));
ok('366 days is not', !L.isNew(mk('x', 1, '', '2025-10-25', '', 'a'), F));
ok('created after the snapshot is not new', !L.isNew(mk('x', 1, '', '2026-11-01', '', 'a'), F));
eq('search name+desc+topics', names(L.filterRepos(repos, kinds, { q: 'nlp', fetched: F })), ['b/glove']);
eq('search accent-blind', names(L.filterRepos(repos, kinds, { q: 'cafe', fetched: F })), ['a/zeta']);
eq('every word must match', names(L.filterRepos(repos, kinds, { q: 'python lectures', fetched: F })), ['c/cs336']);
eq('filters combine', names(L.filterRepos(repos, kinds, { kind: 'lab', lang: 'Python', q: 'prompting', fetched: F })), ['a/dspy']);
eq('fmt stars', [5, 999, 1000, 1250, 9999, 38797].map(L.fmtStars), ['5', '999', '1k', '1.3k', '10k', '39k']);
eq('ago', ['2026-10-26', '2026-10-25', '2026-10-01', '2026-04-26', '2024-10-26'].map((d) => L.ago(d, F)), ['today', 'yesterday', '25 days ago', '6 months ago', '2 years ago']);

// --- open first issues ---------------------------------------------------------------
// pushed dates: a/dspy 2026-10-20 (active), b/glove 2024-01-01 (quiet), c/cs336 2026-06-01
// (147 days: active), d/old 2012 (quiet). Five issues, out of order.
const repoBy = new Map(repos.map((r) => [r[0], r]));
const iss = [
  ['c/cs336', 4, 'Fix lecture 3 typo', ['good first issue'], '2026-09-01', '2026-09-02', 0],
  ['a/dspy', 10, 'Add a retry to ParallelEvaluate', ['help wanted'], '2026-01-01', '2026-10-10', 6],
  ['b/glove', 2, 'Port to Python 3', ['good first issue'], '2015-01-01', '2026-10-25', 1],
  ['a/dspy', 12, 'Docs: café example', ['good first issue', 'docs'], '2026-09-01', '2026-10-10', 0],
  ['zz/gone', 1, 'Repo not listed', ['help wanted'], '2026-10-01', '2026-10-26', 0],
];
const keys = (l) => l.map((i) => `${i[0]}#${i[1]}`);
ok('quiet = no push in 183 days before the snapshot', !L.isQuiet(repoBy.get('c/cs336'), F) && L.isQuiet(repoBy.get('b/glove'), F));
ok('183 days is not quiet, 184 is', !L.isQuiet(mk('x', 1, '', '', '2026-04-26', 'a'), F) && L.isQuiet(mk('x', 1, '', '', '2026-04-25', 'a'), F));
ok('quiet is relative to the snapshot', !L.isQuiet(repoBy.get('a/dspy'), '2026-11-01') && L.isQuiet(repoBy.get('a/dspy'), '2027-06-01'));
eq('issues: newest update first, ties by repo then newest number, quiet repos and unlisted repos hidden',
  keys(L.sortIssues(L.filterIssues(iss, repoBy, kinds, { fetched: F }))), ['a/dspy#12', 'a/dspy#10', 'c/cs336#4']);
eq('issues: quiet repos included on request', keys(L.sortIssues(L.filterIssues(iss, repoBy, kinds, { quiet: true, fetched: F }))),
  ['b/glove#2', 'a/dspy#12', 'a/dspy#10', 'c/cs336#4']);
ok('issue sort does not mutate', iss[0][1] === 4);
eq('issues: kind filter reads the repo org', keys(L.filterIssues(iss, repoBy, kinds, { kind: 'course', fetched: F })), ['c/cs336#4']);
eq('issues: language filter reads the repo', keys(L.filterIssues(iss, repoBy, kinds, { lang: 'Python', q: 'typo', fetched: F })), ['c/cs336#4']);
eq('issues: org filter', keys(L.filterIssues(iss, repoBy, kinds, { org: 'a', fetched: F })), ['a/dspy#10', 'a/dspy#12']);
eq('issues: search title, labels and the repo, every word, accent-blind',
  keys(L.filterIssues(iss, repoBy, kinds, { q: 'cafe docs', fetched: F })), ['a/dspy#12']);
eq('issues: search reaches the repo description', keys(L.filterIssues(iss, repoBy, kinds, { q: 'prompting retry', fetched: F })), ['a/dspy#10']);
eq('url state round-trips view and quiet', L.decodeState(L.encodeState({ view: 'issues', quiet: true, kind: 'lab', sort: 'stars' }), { langs: new Set(), orgs: new Set() }),
  { view: 'issues', quiet: true, kind: 'lab', lang: '', org: '', q: '', sort: 'stars' });
eq('default view is not written to the url', L.encodeState({ view: 'repos', quiet: false, sort: 'stars' }), '');
eq('a bad view falls back to repos', L.decodeState('?view=bogus', { langs: new Set(), orgs: new Set() }).view, 'repos');
const ctx = { langs: new Set(['Python']), orgs: new Set(['a']) };
eq('state encodes, defaults omitted', L.encodeState({ kind: 'lab', lang: 'Python', org: '', q: ' llm ', sort: 'stars' }), '?kind=lab&lang=Python&q=llm');
eq('state round-trips', L.decodeState(L.encodeState({ kind: 'course', lang: 'Python', org: 'a', q: 'x y', sort: 'new' }), ctx), { view: 'repos', quiet: false, kind: 'course', lang: 'Python', org: 'a', q: 'x y', sort: 'new' });
eq('unknown values fall back', L.decodeState('?kind=evil&lang=Cobol&org=zz&sort=bad', ctx), { view: 'repos', quiet: false, kind: '', lang: '', org: '', q: '', sort: 'stars' });

// --- the shipped data -------------------------------------------------------------------
const here = fileURLToPath(new URL('.', import.meta.url));
const D = JSON.parse(readFileSync(here + 'data/repos.json', 'utf8'));
const orgKind = new Map(D.orgs.map((o) => [o.login, o.kind]));
ok('thousands of repos', D.repos.length > 1500, D.repos.length);
ok('every repo meets the star floor', D.repos.every((r) => r[2] >= D.counts.min_stars));
ok('every repo has a known org of a known kind', D.repos.every((r) => orgKind.has(r[9]) && ['lab', 'course', 'club'].includes(orgKind.get(r[9]))));
ok('every repo belongs to the org in its name', D.repos.every((r) => r[0].split('/')[0].toLowerCase() === r[9].toLowerCase()));
ok('names are unique', new Set(D.repos.map((r) => r[0].toLowerCase())).size === D.repos.length);
ok('shipped order is by stars', D.repos.every((r, i) => i === 0 || D.repos[i - 1][2] >= r[2]));
ok('org stars add up', D.orgs.every((o) => o.stars === D.repos.filter((r) => r[9] === o.login).reduce((a, r) => a + r[2], 0)));
ok('dates are ISO days', D.repos.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[5]) && /^\d{4}-\d{2}-\d{2}$/.test(r[6])));
// Positive controls: the ones a Stanford CS student would look for first.
const has = (n) => D.repos.some((r) => r[0].toLowerCase() === n);
ok('DSPy is there', has('stanfordnlp/dspy'));
ok('Stanford Alpaca is there (tatsu-lab, verified by hand)', has('tatsu-lab/stanford_alpaca'));
ok('CS336 is a course', orgKind.get('stanford-cs336') === 'course');
ok('the HIVDB team is not a club', orgKind.get('hivdb') === 'lab');
ok('TreeHacks is a club', orgKind.get('TreeHacks') === 'club');
ok('Google PAIR is not here', !orgKind.has('PAIR-code'));
ok('the new-this-year view is not empty', D.repos.some((r) => L.isNew(r, D.fetched)));

// Open first issues: in a listed, unarchived repo, newest update first, and never one
// that the raw extract says is already assigned (checked where the extract exists,
// i.e. in the working tree, not in the staged copy).
const shownBy = new Map(D.repos.map((r) => [r[0], r]));
ok('there are open first issues', D.issues.length > 50, D.issues.length);
ok('the default issue view is not empty', L.filterIssues(D.issues, shownBy, orgKind, { fetched: D.issues_fetched }).length > 20);
ok('every issue is in a listed, unarchived repo', D.issues.every((i) => shownBy.has(i[0]) && !shownBy.get(i[0])[7]));
ok('issues ship newest update first', D.issues.every((i, k) => k === 0 || D.issues[k - 1][5] >= i[5]));
ok('issue keys are unique', new Set(D.issues.map((i) => `${i[0]}#${i[1]}`)).size === D.issues.length);
ok('issue dates are ISO days', D.issues.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i[4]) && /^\d{4}-\d{2}-\d{2}$/.test(i[5])));
ok('issue count is what the counts say', D.counts.issues === D.issues.length);
let raw = null;
try { raw = JSON.parse(readFileSync(here + '../data/issues.raw.json', 'utf8')); } catch { /* staged copy: no extract */ }
if (raw) {
  const assigned = new Set(raw.items.filter((i) => i.assignees).map((i) => `${i.repo.toLowerCase()}#${i.number}`));
  ok('the extract has assigned issues to drop (positive control)', assigned.size > 0);
  ok('no assigned issue ships', D.issues.every((i) => !assigned.has(`${i[0].toLowerCase()}#${i[1]}`)));
}

console.log(`${fail ? 'FAILED' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
