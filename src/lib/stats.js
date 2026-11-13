import { daysBetween, MONTHS_SHORT, MONTHS_NOM } from './format.js';

// Подсчёты для статистики: всё считается на лету из журнала событий.

export function withSpecies(events, animalsById) {
  return events.map((e) => ({ ...e, species: animalsById.get(e.animalId)?.species }));
}

export function metrics(evs, { species, from, to }) {
  const m = { born: 0, stillborn: 0, died: 0, bought: 0, sold: 0, slaughtered: 0, causes: {} };
  for (const e of evs) {
    if (species && e.species !== species) continue;
    if (e.date < from || e.date > to) continue;
    switch (e.type) {
      case 'birth': m.born += 1; break;
      case 'purchase': m.bought += 1; break;
      case 'sale': m.sold += 1; break;
      case 'slaughter': m.slaughtered += 1; break;
      case 'death': {
        const c = e.data?.cause || 'other';
        if (c === 'stillborn') m.stillborn += 1;
        else m.died += 1;
        m.causes[c] = (m.causes[c] || 0) + 1;
        break;
      }
      default:
    }
  }
  return m;
}

// Окоты (отёлы): рождения одного вида, между которыми не больше 60 дней.
export function seasons(evs, animalsById, species, gap = 60) {
  const births = evs.filter((e) => e.type === 'birth' && e.species === species).sort((a, b) => (a.date < b.date ? -1 : 1));
  const deathCause = new Map(evs.filter((e) => e.type === 'death').map((e) => [e.animalId, e]));
  const out = [];
  let cur = null;
  for (const b of births) {
    if (!cur || daysBetween(cur.to, b.date) > gap) {
      cur = { from: b.date, to: b.date, items: [] };
      out.push(cur);
    }
    cur.to = b.date;
    cur.items.push(b);
  }
  return out.reverse().map((s) => {
    let stillborn = 0, diedAfter = 0;
    const mothers = new Set();
    const males = { m: 0, f: 0 };
    for (const b of s.items) {
      const a = animalsById.get(b.animalId);
      if (!a) continue;
      males[a.sex === 'm' ? 'm' : 'f'] += 1;
      if (a.motherId || a.motherTag) mothers.add(a.motherId ?? `t${a.motherTag}`);
      const d = deathCause.get(a.id);
      if (d) d.data?.cause === 'stillborn' ? (stillborn += 1) : (diedAfter += 1);
    }
    const born = s.items.length;
    return {
      ...s, born, stillborn, diedAfter, mothers: mothers.size, ...males,
      alive: born - stillborn - diedAfter,
      survival: born ? Math.round(((born - stillborn - diedAfter) / born) * 100) : 0,
    };
  });
}

export function seasonTitle(word, s) {
  const [y1, m1] = s.from.split('-').map(Number);
  const [y2, m2] = s.to.split('-').map(Number);
  if (y1 === y2 && m1 === m2) return `${word}: ${MONTHS_NOM[m1 - 1].toLowerCase()} ${y1}`;
  if (y1 === y2) return `${word}: ${MONTHS_SHORT[m1 - 1]}–${MONTHS_SHORT[m2 - 1]} ${y1}`;
  return `${word}: ${MONTHS_SHORT[m1 - 1]} ${y1} – ${MONTHS_SHORT[m2 - 1]} ${y2}`;
}

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}
export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function yearMonths(year) {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}
