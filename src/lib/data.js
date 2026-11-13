import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';
import { MATURITY, SPECIES, SPECIES_LIST, groupOf, tagCompare } from './domain.js';
import { addMonths, monthsBetween, today } from './format.js';

// Живые выборки: экран сам обновляется, когда данные меняются.
export const useAnimals = () => useLiveQuery(() => db.animals.toArray(), []);
export const useAnimal = (id) => useLiveQuery(() => db.animals.get(id), [id]);

export function activeOf(animals) {
  return (animals || []).filter((a) => a.status === 'active');
}

// Сколько голов каждого вида и группы сейчас на хозяйстве.
export function herdSummary(animals) {
  const res = { total: 0, species: {} };
  for (const s of SPECIES_LIST) {
    res.species[s.key] = { n: 0, groups: Object.fromEntries(s.groups.map((g) => [g.key, 0])) };
  }
  for (const a of activeOf(animals)) {
    const sp = res.species[a.species];
    if (!sp) continue;
    sp.n += 1;
    sp.groups[a.group] = (sp.groups[a.group] || 0) + 1;
    res.total += 1;
  }
  return res;
}

export function filterAnimals(animals, { species, group, status = 'active', q }) {
  let list = animals || [];
  if (status === 'active') list = list.filter((a) => a.status === 'active');
  else if (status === 'out') list = list.filter((a) => a.status !== 'active');
  if (species) list = list.filter((a) => a.species === species);
  if (group) list = list.filter((a) => a.group === group);
  if (q) {
    const exact = list.filter((a) => a.tag === q);
    const starts = list.filter((a) => a.tag !== q && a.tag.startsWith(q));
    const has = list.filter((a) => a.tag !== q && !a.tag.startsWith(q) && a.tag.includes(q));
    return [...exact, ...starts.sort(tagCompare), ...has.sort(tagCompare)];
  }
  return [...list].sort((a, b) => ((b.status === 'active') - (a.status === 'active')) || tagCompare(a, b));
}

// Кого пора перевести в другую группу (по возрасту или после первых родов).
export function maturityDue(animals, at = today()) {
  const list = animals || [];
  const mothers = new Set(list.filter((a) => a.motherId).map((a) => a.motherId));
  const due = [];
  for (const a of list) {
    if (a.status !== 'active') continue;
    if (a.snoozeUntil && a.snoozeUntil > at) continue;
    const rule = MATURITY.find((r) => r.species === a.species && r.from === a.group);
    if (!rule) continue;
    const options = rule.to[a.sex] || rule.to.f || [];
    if (!options.length) continue;
    let reason = null;
    if (rule.afterBirth && mothers.has(a.id)) reason = 'birth';
    else if (rule.months && a.birthDate && monthsBetween(a.birthDate, at) >= rule.months) reason = 'age';
    if (reason) due.push({ animal: a, rule, options, reason });
  }
  return due;
}

// Группируем напоминания: «Ягнята → Ярки: 9 голов».
export function maturityGroups(due) {
  const map = new Map();
  for (const d of due) {
    const key = `${d.animal.species}:${d.rule.from}:${d.options.join(',')}`;
    if (!map.has(key)) map.set(key, { key, species: d.animal.species, from: d.rule.from, options: d.options, items: [] });
    map.get(key).items.push(d);
  }
  return [...map.values()].map((g) => ({ ...g, items: g.items.sort((x, y) => tagCompare(x.animal, y.animal)) }));
}

export function maturityTitle(g) {
  const from = groupOf(g.species, g.from)?.many;
  const to = g.options.map((o) => groupOf(g.species, o)?.many.toLowerCase()).join(' или ');
  return `${from} → ${to}`;
}

export function snoozeDate() {
  return addMonths(today(), 1);
}

export { SPECIES };
