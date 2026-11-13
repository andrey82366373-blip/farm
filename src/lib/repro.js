import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';
import { GESTATION_DEFAULT, SPECIES, isBreeding } from './domain.js';
import { addDays, daysBetween, today } from './format.js';

// Сроки беременности из настроек (или по умолчанию).
export function useGestation() {
  const row = useLiveQuery(() => db.settings.get('gestation'), []);
  return { ...GESTATION_DEFAULT, ...(row?.value || {}) };
}

export function useMatingEvents() {
  return useLiveQuery(() => db.events.where('type').anyOf('mating', 'birth').toArray(), []);
}

// Для каждой самки: последнее покрытие, если после него ещё не было родов.
export function pregnancies(animals, events, gestation, at = today()) {
  const res = new Map();
  if (!animals || !events) return res;
  const byId = new Map(animals.map((a) => [a.id, a]));
  const lastBirth = new Map();
  for (const e of events) {
    if (e.type === 'birth' && e.motherId) {
      if (!lastBirth.has(e.motherId) || lastBirth.get(e.motherId) < e.date) lastBirth.set(e.motherId, e.date);
    }
  }
  for (const e of events) {
    if (e.type !== 'mating') continue;
    const prev = res.get(e.animalId);
    if (prev && prev.mating.date >= e.date) continue;
    res.set(e.animalId, { mating: e });
  }
  for (const [id, r] of res) {
    const a = byId.get(id);
    const born = lastBirth.get(id);
    if (!a || a.status !== 'active' || r.mating.data?.failed || (born && born >= r.mating.date)) {
      res.delete(id);
      continue;
    }
    const days = gestation[a.species] ?? GESTATION_DEFAULT[a.species];
    const due = addDays(r.mating.date, days);
    const passed = daysBetween(r.mating.date, at);
    Object.assign(r, { animal: a, due, daysLeft: daysBetween(at, due), progress: Math.max(0, Math.min(1, passed / days)) });
  }
  return res;
}

// Ближайшие роды для главного экрана: объединяем по виду и дате.
export function dueGroups(preg, withinDays = 45) {
  const list = [...preg.values()].filter((p) => p.daysLeft <= withinDays).sort((a, b) => (a.due < b.due ? -1 : 1));
  const groups = [];
  for (const p of list) {
    const g = groups.find((x) => x.species === p.animal.species && Math.abs(daysBetween(x.from, p.due)) <= 3);
    if (g) { g.items.push(p); g.to = p.due; } else groups.push({ species: p.animal.species, from: p.due, to: p.due, items: [p] });
  }
  return groups;
}

export function dueLabel(daysLeft) {
  if (daysLeft === 0) return 'сегодня';
  if (daysLeft > 0) return `${daysLeft} дн.`;
  return `${-daysLeft} дн. назад`;
}

export function birthWord(species) {
  return SPECIES[species]?.birthWord ?? 'Роды';
}

export { isBreeding };
