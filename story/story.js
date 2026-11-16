/* The scrolling story: each <section class="step"> names a layout in data-kind; as the
 * reader scrolls from one step to the next, every dot flies from the old layout to the
 * new one. Numbers in the prose are not typed in: a <b data-fact="..."> is filled from
 * story.json, so the text cannot drift from the chart. Modelled on name-years/story. */
import { yearsOf, year, dots, chapters, field, columns } from './layout.js';
import { createPoints } from './gl.js';

// 0 ink, 1 last push in month one (red), 2 starred (gold), 3 pushed lately (green), 4 slate, 5 grey
const PAL = [[0.11, 0.1, 0.09], [0.7, 0.13, 0.11], [0.85, 0.62, 0.18], [0.24, 0.5, 0.33], [0.17, 0.33, 0.52], [0.8, 0.78, 0.74]];

/* Shares: whole percent from 10% up, one decimal below it ("4.4%"). */
export const pct = (v) => (v >= 0.095 ? `${Math.round(v * 100)}%` : `${(v * 100).toFixed(1)}%`);
const fmt = (n) => n.toLocaleString('en-US');
/* The eleven years with about 200 repos or more whose repos are all a year old or more. */
export const SPAN = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* "month" -> "30%". Unknown kinds throw: a typo must not render as blank. */
export function fact(D, spec) {
  const [kind, a] = spec.split(':');
  const X = D.control, S = D.stars;
  switch (kind) {
    case 'n': return fmt(D.n);
    case 'orgs': return fmt(D.orgs);
    case 'last': return String(yearsOf(D).at(-1));
    case 'fetched': { const [y, m, d] = D.fetched.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; }
    case 'mature': return fmt(D.mature.n);
    case 'month': return pct(D.mature.month);
    case 'count': return fmt(year(D, Number(a)).n);
    case 'ymonth': return pct(year(D, Number(a)).month);
    // the lowest and highest yearly share over the mature years (SPAN)
    case 'ymin': return pct(Math.min(...SPAN.map((y) => year(D, y).month)));
    case 'ymax': return pct(Math.max(...SPAN.map((y) => year(D, y).month)));
    case 'spanfrom': return String(SPAN[0]);
    case 'spanto': return String(SPAN.at(-1));
    case 'bulkn': return fmt(X.bulk_n);
    case 'nobulk': return pct(X.nobulk);
    case 'nobig': return pct(X.nobig);
    case 'orgw': return pct(X.orgweighted);
    case 'orgn': return fmt(X.org_n);
    case 'kind': return pct(X.kind[a]);
    case 'zero': return pct(S.zero);
    case 'zeron': return fmt(S.zero_n);
    case 'starred': return pct(S.starred);
    case 'fifty': return pct(S.fifty);
    case 'fiftyn': return fmt(S.fifty_n);
    case 'oldfrom': return String(D.old.from);
    case 'oldto': return String(D.old.to);
    case 'oldn': return fmt(D.old.n);
    case 'oldalive': return pct(D.old.alive);
    case 'yalive': return pct(year(D, Number(a)).alive);
    default: throw new Error(`unknown fact ${spec}`);
  }
}

/* data-kind -> layout */
export function layoutFor(step, ds, K, aspect) {
  const k = step.dataset.kind;
  if (k === 'field') return field(ds);
  if (!chapters[k]) throw new Error(`unknown layout ${k}`);
  return columns(ds, K, aspect, chapters[k]);
}

/* What the axis labels say on each kind of step: [value per year column, css class, unit line]. */
export function axisFor(kind, D, y) {
  const r = year(D, y), p0 = (v) => (v * 100 >= 9.5 ? String(Math.round(v * 100)) : (v * 100).toFixed(1));
  switch (kind) {
    case 'count': return [fmt(r.n), 'ink', 'repos created that year (forks left out)'];
    case 'month': return [p0(r.month), '', '% never pushed again after their first 30 days'];
    case 'bulk': return [p0(r.nobulk), '', '% never pushed again after month one, leaving out repos made 5+ a day by one org'];
    case 'starred': return [p0(r.starred), 'gold', '% with 3 or more stars'];
    case 'alive': return [p0(r.alive), 'green', `% pushed in the six months to ${fact(D, 'fetched')}`];
    default: return null;
  }
}

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const el of document.querySelectorAll('[data-fact]')) el.textContent = fact(D, el.dataset.fact);
  const Y = yearsOf(D), K = Y.length;
  const ds = dots(D);

  const steps = [...document.querySelectorAll('.step')];
  const canvas = document.getElementById('gl');
  const plot = document.getElementById('plot');
  const axes = document.getElementById('axes');

  let layouts = [];
  const relayout = () => {
    const a = plot.clientWidth / Math.max(1, plot.clientHeight);
    layouts = steps.map((s) => layoutFor(s, ds, K, a));
    window.__story = { dots: ds.length, layouts: layouts.map((l) => ({ kind: l.kind, per: l.per })) };
  };
  relayout();

  const pts = createPoints(canvas, ds.length, PAL);
  if (!pts) { document.body.classList.add('nogl'); return; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  let shown = -1;
  const resize = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    relayout();
    shown = -1;
  };
  resize();
  addEventListener('resize', resize);

  // the step whose top has crossed mid-viewport is "from", and t runs 0 -> 1 as the next
  // step's top rises from the bottom to the middle
  const progress = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    const next = steps[i + 1];
    if (!next) return { i, t: 0 };
    const top = next.getBoundingClientRect().top;
    return { i, t: Math.min(1, Math.max(0, 1 - (top - line) / (innerHeight - line))) };
  };

  const drawAxes = (lay, step) => {
    const html = [];
    if (lay.kind === 'columns') {
      const narrow = plot.clientWidth < 600, kind = step.dataset.kind;
      let unit = '';
      Y.forEach((y, i) => {
        const x = ((i + 0.5) / K) * 100;
        const label = i === 0 ? `≤'${String(y).slice(2)}` : narrow ? `'${String(y).slice(2)}` : String(y);
        html.push(`<span class="tick" style="left:${x}%">${label}</span>`);
        const ax = axisFor(kind, D, y);
        if (!ax) return;
        const [v, cls, u] = ax;
        unit = u;
        html.push(`<span class="val ${cls}" style="left:${x}%">${v}</span>`);
      });
      if (unit) html.push(`<span class="unit">${unit}</span>`);
    }
    axes.innerHTML = html.join('');
  };

  const t0 = performance.now();
  const frame = () => {
    const { i, t } = progress();
    const j = Math.min(i + 1, steps.length - 1);
    const A = layouts[i], Bl = layouts[j];
    pts.set(A.slots, Bl.slots);
    const cur = t > 0.5 ? j : i;
    if (cur !== shown) {
      shown = cur;
      drawAxes(layouts[cur], steps[cur]);
      document.body.dataset.step = cur;
    }
    axes.style.opacity = String(Math.abs(t - 0.5) * 2);
    const r = plot.getBoundingClientRect();
    const sz = (l) => (l.kind === 'columns' ? Math.max(2, l.cell * r.width * 0.86) : Math.max(3, r.width / 150));
    const size = sz(A) + (sz(Bl) - sz(A)) * t;
    pts.draw({ t, time: (performance.now() - t0) / 1000, size, rect: [r.left, r.top, r.width, r.height], dpr });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
