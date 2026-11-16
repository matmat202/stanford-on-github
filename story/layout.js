/* Pure logic for "Most code goes quiet": story.json -> per-chapter particle slots. No DOM,
 * no GL, so node can test it (test/story.test.mjs).
 *
 * One dot is one real repo, the same dot in every chapter. Every column is the year the
 * repos in it were created, filled bottom-up in rows of `per` dots, so a column's height is
 * that year's count. Each chapter sorts its highlighted repos to the bottom of their column.
 * A layout is N slots of [x, y, colour, alpha] in plot space: x, y in 0..1, y up.
 * Every number the prose prints is computed by build_story.py, never from the dots. */

export const F = { month: 1, alive: 2, starred: 4, bulk: 8 };

export const yearsOf = (D) => Object.keys(D.years).map(Number).sort((a, b) => a - b);
export const year = (D, y) => {
  const r = D.years[y];
  if (!r) throw new Error(`no year ${y}`);
  return r;
};

/* The dots, in story.json's fixed order: `bin` is the column, `i` the repo's place in it. */
export function dots(D) {
  const Y = yearsOf(D), bin = new Map(Y.map((y, i) => [y, i])), seen = Y.map(() => 0);
  return D.dots.map(([y, f]) => {
    const b = bin.get(y);
    if (b === undefined) throw new Error(`dot in unknown year ${y}`);
    return { bin: b, i: seen[b]++, month: !!(f & F.month), alive: !!(f & F.alive), starred: !!(f & F.starred), bulk: !!(f & F.bulk) };
  });
}

/* Colours are palette indices (story.js): 0 ink, 1 red, 2 gold, 3 green, 4 slate, 5 grey. */
export const C = { ink: 0, red: 1, gold: 2, green: 3, slate: 4, grey: 5 };

/* A chapter: which repos sink to the bottom, and how every dot is coloured and lit. */
export const chapters = {
  count: { key: () => 0, colour: () => C.ink, alpha: () => 1 },
  month: { key: (d) => (d.month ? 0 : 1), colour: (d) => (d.month ? C.red : C.grey), alpha: () => 1 },
  // the bulk-made repos fade out; what is left is coloured as before
  bulk: { key: (d) => (d.bulk ? 2 : d.month ? 0 : 1), colour: (d) => (d.month ? C.red : C.grey), alpha: (d) => (d.bulk ? 0.12 : 1) },
  starred: { key: (d) => (d.starred ? 0 : 1), colour: (d) => (d.starred ? C.gold : C.grey), alpha: () => 1 },
  alive: { key: (d) => (d.alive ? 0 : 1), colour: (d) => (d.alive ? C.green : C.grey), alpha: () => 1 },
};

const mulberry = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* A free-floating field: the opening. */
export function field(ds) {
  const rnd = mulberry(7), slots = new Float32Array(ds.length * 4);
  ds.forEach((_, i) => slots.set([rnd(), rnd() * 0.9 + 0.05, C.ink, 0.8], i * 4));
  return { kind: 'field', slots };
}

/* The fewest dots a row (so the biggest dots) that still fit the tallest column under
 * `top`, with square cells in a plot of aspect a (width / height). */
export function perRow(maxN, K, a, top = 0.9) {
  const barW = (1 / K) * 0.8;
  for (let k = 1; k <= 200; k++) if (Math.ceil(maxN / k) * (barW / k) * a <= top) return k;
  throw new Error(`no row width fits ${maxN} dots`);
}

/* K year columns. Within a column the chapter's key orders the dots (ties keep story.json's
 * order), so a chapter's highlighted repos stack from the floor. */
export function columns(ds, K, a, ch = chapters.count) {
  const n = new Array(K).fill(0);
  for (const d of ds) n[d.bin]++;
  const per = perRow(Math.max(...n), K, a), colW = 1 / K, barW = colW * 0.8, cw = barW / per, ch_ = cw * a;
  const order = ds.map((d, idx) => idx).sort((p, q) => ds[p].bin - ds[q].bin || ch.key(ds[p]) - ch.key(ds[q]) || ds[p].i - ds[q].i);
  const slots = new Float32Array(ds.length * 4), place = new Array(K).fill(0);
  for (const idx of order) {
    const d = ds[idx], j = place[d.bin]++;
    const r = Math.floor(j / per), c = j % per;
    slots.set([d.bin * colW + (colW - barW) / 2 + (c + 0.5) * cw, (r + 0.5) * ch_, ch.colour(d), ch.alpha(d)], idx * 4);
  }
  return { kind: 'columns', slots, per, cell: cw, K };
}

/* "3 in 10": a share as the nearest x in 10. */
export const inTen = (p) => `${Math.round(p * 10)} in 10`;
