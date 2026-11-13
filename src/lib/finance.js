import { FINANCE_CATEGORIES } from './domain.js';
import { addDays, daysBetween, today, parseISO, toISO } from './format.js';
import { feedCalc } from './feed.js';
import { monthRange, shiftMonth } from './stats.js';

export function catLabel(kind, key) {
  return FINANCE_CATEGORIES[kind]?.find((c) => c.key === key)?.label ?? 'Прочее';
}

export function totals(rows, from, to) {
  const t = { income: 0, expense: 0, byCat: { income: {}, expense: {} } };
  for (const r of rows) {
    if (r.date < from || r.date > to) continue;
    t[r.kind] += r.amount;
    t.byCat[r.kind][r.category] = (t.byCat[r.kind][r.category] || 0) + r.amount;
  }
  t.net = t.income - t.expense;
  return t;
}

// Сколько дней месяца попадает в отрезок [a, b] (даты включительно).
function overlap(ym, a, b) {
  const { from, to } = monthRange(ym);
  const s = from > a ? from : a;
  const e = to < b ? to : b;
  return s > e ? 0 : daysBetween(s, e) + 1;
}

// Прогноз трат по месяцам: корма (когда закончится запас и до даты «до»)
// плюс средние траты на ветеринара и прочее за последние полгода.
export function forecast({ finance, feeds, counts, until, months = 6, at = today() }) {
  const curYm = at.slice(0, 7);
  // среднее «прочих» расходов за 6 полных прошлых месяцев
  const from = monthRange(shiftMonth(curYm, -6)).from;
  const to = monthRange(shiftMonth(curYm, -1)).to;
  const other = finance
    .filter((r) => r.kind === 'expense' && (r.category === 'vet' || r.category === 'other') && r.date >= from && r.date <= to)
    .reduce((s, r) => s + r.amount, 0) / 6;

  const feedParts = feeds.map((f) => {
    const c = feedCalc(f, counts, until, at);
    const start = c.runOut && c.runOut > at ? addDays(c.runOut, 1) : at;
    return { f, c, start };
  });

  const out = [];
  for (let i = 0; i < months; i++) {
    const ym = shiftMonth(curYm, i);
    let feed = 0;
    const byFeed = {};
    for (const { f, c, start } of feedParts) {
      if (!c.daily || !f.price) continue;
      const days = overlap(ym, start, addDays(until, -1));
      const v = days * c.daily * f.price;
      if (v > 0) { feed += v; byFeed[f.name] = v; }
    }
    // текущий месяц: «прочее» только за оставшиеся дни
    const share = i === 0 ? (monthRange(ym).to === at ? 0 : (daysBetween(at, monthRange(ym).to) + 1) / Number(monthRange(ym).to.slice(8))) : 1;
    out.push({ ym, feed, byFeed, other: other * share, total: feed + other * share });
  }
  return { months: out, otherAvg: other, feedParts };
}

export function monthsAgo(n, at = today()) {
  const d = parseISO(at);
  d.setMonth(d.getMonth() - n);
  return toISO(d);
}
