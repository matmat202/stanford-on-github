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
const ctx = { langs: new Set(['Python']), orgs: new Set(['a']) };
eq('state encodes, defaults omitted', L.encodeState({ kind: 'lab', lang: 'Python', org: '', q: ' llm ', sort: 'stars' }), '?kind=lab&lang=Python&q=llm');
eq('state round-trips', L.decodeState(L.encodeState({ kind: 'course', lang: 'Python', org: 'a', q: 'x y', sort: 'new' }), ctx), { kind: 'course', lang: 'Python', org: 'a', q: 'x y', sort: 'new' });
eq('unknown values fall back', L.decodeState('?kind=evil&lang=Cobol&org=zz&sort=bad', ctx), { kind: '', lang: '', org: '', q: '', sort: 'stars' });

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

console.log(`${fail ? 'FAILED' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
