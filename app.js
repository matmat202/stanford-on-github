import { R, filterRepos, sortRepos, fmtStars, ago, isNew, encodeState, decodeState } from './sog-logic.js';

const $ = (id) => document.getElementById(id);
const PAGE = 50;
const KIND_LABEL = { '': 'Everything', lab: 'Labs & research', course: 'Courses', club: 'Clubs & students' };
let D = null;
let orgKind = new Map();
let orgName = new Map();
const state = { kind: '', lang: '', org: '', q: '', sort: 'stars', shown: PAGE };
const fmt = (n) => n.toLocaleString('en-US');

function row(r, i) {
  const li = document.createElement('li');
  const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = `${i + 1}`;
  const body = document.createElement('div');
  const a = document.createElement('a');
  a.className = 'nm'; a.href = `https://github.com/${r[R.NAME]}`; a.target = '_blank'; a.rel = 'noopener';
  const [o, n] = r[R.NAME].split('/');
  const os = document.createElement('span'); os.className = 'o'; os.textContent = `${o}/`;
  a.append(os, n);
  body.append(a);
  if (r[R.DESC]) { const d = document.createElement('div'); d.className = 'd'; d.textContent = r[R.DESC]; body.append(d); }
  const m = document.createElement('div'); m.className = 'm';
  const s = document.createElement('span'); s.className = 's'; s.textContent = `★ ${fmtStars(r[R.STARS])}`;
  s.title = `${fmt(r[R.STARS])} stars`;
  m.append(s);
  if (r[R.LANG]) { const l = document.createElement('span'); l.textContent = r[R.LANG]; m.append(l); }
  const p = document.createElement('span');
  p.textContent = state.sort === 'new' ? `created ${ago(r[R.CREATED], D.fetched)}` : `pushed ${ago(r[R.PUSHED], D.fetched)}`;
  m.append(p);
  if (r[R.ARCHIVED]) { const x = document.createElement('span'); x.className = 'arch'; x.textContent = 'archived'; m.append(x); }
  for (const t of r[R.TOPICS].slice(0, 3)) { const x = document.createElement('span'); x.className = 'tag'; x.textContent = t; m.append(x); }
  if (state.org !== r[R.ORG]) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.org = r[R.ORG];
    b.textContent = `all from ${orgName.get(r[R.ORG]) || r[R.ORG]}`;
    m.append(b);
  }
  body.append(m);
  li.append(rk, body);
  return li;
}

function draw() {
  const list = sortRepos(filterRepos(D.repos, orgKind, { ...state, fetched: D.fetched }), state.sort);
  const bits = [`${fmt(list.length)} ${list.length === 1 ? 'repo' : 'repos'}`];
  if (state.kind) bits.push(KIND_LABEL[state.kind].toLowerCase());
  if (state.lang) bits.push(state.lang);
  if (state.sort === 'new') bits.push(`created in the year to ${D.fetched}`);
  $('status').textContent = bits.join(' · ');
  const slot = $('orgSlot');
  slot.replaceChildren();
  if (state.org) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'orgchip';
    b.textContent = `${orgName.get(state.org) || state.org} ✕`;
    b.setAttribute('aria-label', `Stop filtering to ${orgName.get(state.org) || state.org}`);
    b.addEventListener('click', () => set({ org: '' }));
    slot.append(b);
  }
  const ol = $('repos');
  ol.replaceChildren();
  if (!list.length) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = 'Nothing matches. Try fewer words, another language, or Everything.';
    ol.append(li);
  }
  list.slice(0, state.shown).forEach((r, i) => ol.append(row(r, i)));
  const more = $('more');
  more.hidden = list.length <= state.shown;
  more.textContent = `Show more (${fmt(list.length - state.shown)} left)`;
}

function sync() {
  history.replaceState(null, '', location.pathname + encodeState(state));
  for (const b of document.querySelectorAll('#kinds button')) b.setAttribute('aria-pressed', String(b.dataset.k === state.kind));
  $('lang').value = state.lang;
  $('sort').value = state.sort;
  if ($('q').value !== state.q) $('q').value = state.q;
}

function set(patch) {
  Object.assign(state, patch, { shown: PAGE });
  sync(); draw();
  if ('org' in patch && patch.org) window.scrollTo({ top: $('kinds').offsetTop - 8 });
}

function drawTable() {
  const t = document.createElement('table');
  t.innerHTML = '<tr><th>Group</th><th>Kind</th><th class="r">Repos</th><th class="r">Stars</th></tr>';
  for (const o of D.orgs) {
    const tr = document.createElement('tr');
    const g = document.createElement('td');
    const b = document.createElement('button'); b.type = 'button'; b.dataset.org = o.login; b.textContent = o.name;
    g.append(b);
    if (o.name.toLowerCase() !== o.login.toLowerCase()) g.append(` (${o.login})`);
    const k = document.createElement('td'); k.textContent = KIND_LABEL[o.kind];
    const n = document.createElement('td'); n.className = 'r'; n.textContent = fmt(o.repos);
    const s = document.createElement('td'); s.className = 'r'; s.textContent = fmt(o.stars);
    tr.append(g, k, n, s); t.append(tr);
  }
  $('table').replaceChildren(t);
}

async function main() {
  try { D = await (await fetch('data/repos.json')).json(); }
  catch { $('sub').textContent = 'Could not load the data. Try reloading.'; return; }
  orgKind = new Map(D.orgs.map((o) => [o.login, o.kind]));
  orgName = new Map(D.orgs.map((o) => [o.login, o.name]));
  const newCount = D.repos.filter((r) => isNew(r, D.fetched)).length;
  $('sub').textContent = `${fmt(D.repos.length)} public repos from ${fmt(D.orgs.length)} Stanford labs, courses and student groups ` +
    `on GitHub, ranked by stars. ${fmt(newCount)} were created in the last year.`;
  $('fetched').textContent = D.fetched;
  const ul = $('kinds');
  for (const k of ['', 'lab', 'course', 'club']) {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = KIND_LABEL[k];
    b.addEventListener('click', () => set({ kind: k }));
    li.append(b); ul.append(li);
  }
  const lang = $('lang');
  lang.append(new Option('Any language', ''), ...D.languages.slice(0, 30).map((l) => new Option(l, l)));
  Object.assign(state, decodeState(location.search, { langs: new Set(D.languages.slice(0, 30)), orgs: new Set(orgKind.keys()) }));
  drawTable(); sync(); draw();
  lang.addEventListener('change', () => set({ lang: lang.value }));
  $('sort').addEventListener('change', () => set({ sort: $('sort').value }));
  let t;
  $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => set({ q: $('q').value.slice(0, 80) }), 150); });
  $('more').addEventListener('click', () => { state.shown += PAGE * 2; draw(); });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-org]');
    if (b) set({ org: b.dataset.org });
  });
}

main();
