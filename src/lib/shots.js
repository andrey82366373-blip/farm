import { vetLabel } from './domain.js';
import { addDays, today } from './format.js';

// Уколы и прививки хранятся как события «ветеринария» (type: 'vet').
// В data лежит: kind, drug, dose, note, nextDate.

export const drugKey = (e) => (e.data?.drug || '').trim().toLowerCase();
export const drugName = (e) => (e.data?.drug || '').trim() || vetLabel(e.data?.kind);

// Названия препаратов для подсказок: сначала те, что вводили недавно.
export function drugSuggestions(vetEvents) {
  const last = new Map();
  for (const e of vetEvents || []) {
    const name = (e.data?.drug || '').trim();
    if (!name) continue;
    const k = name.toLowerCase();
    if (!last.has(k) || last.get(k).date < e.date) last.set(k, { name, date: e.date, dose: e.data?.dose || '', kind: e.data?.kind });
  }
  return [...last.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Сводка по препаратам: когда и скольким ставили.
export function drugSummary(vetEvents, animalsById) {
  const map = new Map();
  for (const e of vetEvents || []) {
    const k = drugKey(e) || `kind:${e.data?.kind}`;
    if (!map.has(k)) map.set(k, { key: k, name: drugName(e), sessions: new Map(), heads: 0 });
    const d = map.get(k);
    if (!d.sessions.has(e.date)) d.sessions.set(e.date, { date: e.date, ids: [], species: {}, dose: e.data?.dose || '', nextDate: e.data?.nextDate || null });
    const s = d.sessions.get(e.date);
    s.ids.push(e.animalId);
    const sp = animalsById.get(e.animalId)?.species;
    if (sp) s.species[sp] = (s.species[sp] || 0) + 1;
    d.heads += 1;
  }
  return [...map.values()]
    .map((d) => ({ ...d, sessions: [...d.sessions.values()].sort((a, b) => (a.date < b.date ? 1 : -1)) }))
    .sort((a, b) => (a.sessions[0].date < b.sessions[0].date ? 1 : -1));
}

// Напоминания о следующем уколе: кому пора, если после назначенного срока
// этот препарат ещё не ставили.
export function shotReminders(vetEvents, animalsById, dismissed = [], at = today()) {
  const lastByAnimalDrug = new Map();
  for (const e of vetEvents || []) {
    const k = `${e.animalId}|${drugKey(e)}`;
    if (!lastByAnimalDrug.has(k) || lastByAnimalDrug.get(k) < e.date) lastByAnimalDrug.set(k, e.date);
  }
  const groups = new Map();
  for (const e of vetEvents || []) {
    const next = e.data?.nextDate;
    if (!next || next > addDays(at, 14)) continue;
    const a = animalsById.get(e.animalId);
    if (!a || a.status !== 'active') continue;
    if (lastByAnimalDrug.get(`${e.animalId}|${drugKey(e)}`) > e.date) continue; // уже ставили позже
    const key = `${drugKey(e)}|${next}`;
    if (dismissed.includes(key)) continue;
    if (!groups.has(key)) groups.set(key, { key, drug: drugName(e), kind: e.data?.kind, dose: e.data?.dose || '', nextDate: next, ids: [] });
    groups.get(key).ids.push(e.animalId);
  }
  return [...groups.values()].sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
}
