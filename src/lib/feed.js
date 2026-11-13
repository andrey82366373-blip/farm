import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';
import { SPECIES_LIST } from './domain.js';
import { today, addDays, daysBetween, plural } from './format.js';

// Единицы корма и сколько килограммов в одной (можно поменять в карточке корма).
export const UNITS = [
  { key: 'т', label: 'тонны', kg: 1000, fixed: true, forms: ['т', 'т', 'т'], per: 'тонну' },
  { key: 'рулон', label: 'рулоны', kg: 250, forms: ['рулон', 'рулона', 'рулонов'], per: 'рулон' },
  { key: 'тюк', label: 'тюки', kg: 20, forms: ['тюк', 'тюка', 'тюков'], per: 'тюк' },
  { key: 'мешок', label: 'мешки', kg: 40, forms: ['мешок', 'мешка', 'мешков'], per: 'мешок' },
  { key: 'кг', label: 'кг', kg: 1, fixed: true, forms: ['кг', 'кг', 'кг'], per: 'кг' },
];
export const unitOf = (k) => UNITS.find((u) => u.key === k) ?? UNITS[2];

export const DEFAULT_FEEDS = [
  { name: 'Сено', kind: 'hay', unit: 'тюк', unitKg: 20, price: 250, norms: { sheep: 2, cow: 10, horse: 8 } },
  { name: 'Зерно', kind: 'grain', unit: 'мешок', unitKg: 40, price: 900, norms: { sheep: 0.3, cow: 2, horse: 2 } },
];

// Создаём сено и зерно при первом открытии раздела.
// Проверка и запись в одной транзакции, чтобы не создать корма дважды.
let ensuring = null;
export function ensureFeeds() {
  ensuring ||= db.transaction('rw', db.feeds, db.settings, async () => {
    if ((await db.feeds.count()) > 0) return;
    if (await db.settings.get('feedsCreated')) return; // папа сам удалил все корма
    await db.feeds.bulkAdd(DEFAULT_FEEDS.map((f) => ({ ...f, stock: 0, stockDate: today() })));
    await db.settings.put({ key: 'feedsCreated', value: true });
  }).finally(() => { ensuring = null; });
  return ensuring;
}

// До какой даты считаем корма: по умолчанию до 15 мая (выход на пастбище).
export function defaultUntil(at = today()) {
  const y = Number(at.slice(0, 4));
  const may = `${y}-05-15`;
  return at < may ? may : `${y + 1}-05-15`;
}
export function useFeedUntil() {
  const row = useLiveQuery(() => db.settings.get('feedUntil'), []);
  const v = row?.value;
  return v && v > today() ? v : defaultUntil();
}

export function headcount(animals) {
  const c = Object.fromEntries(SPECIES_LIST.map((s) => [s.key, 0]));
  for (const a of animals || []) if (a.status === 'active' && c[a.species] !== undefined) c[a.species] += 1;
  return c;
}

// Главный расчёт по одному корму.
export function feedCalc(f, counts, until, at = today()) {
  const unitKg = unitOf(f.unit).fixed ? unitOf(f.unit).kg : (Number(f.unitKg) || unitOf(f.unit).kg);
  const dailyKg = SPECIES_LIST.reduce((s, sp) => s + (counts[sp.key] || 0) * (Number(f.norms?.[sp.key]) || 0), 0);
  const daily = dailyKg / unitKg;
  const since = Math.max(0, daysBetween(f.stockDate || at, at));
  const stock = Math.max(0, (Number(f.stock) || 0) - daily * since);
  const daysLeft = daily > 0 ? stock / daily : Infinity;
  const toUntil = Math.max(0, daysBetween(at, until));
  const need = Math.max(0, daily * toUntil - stock);
  return {
    unitKg, dailyKg, daily, stock, daysLeft, toUntil, need,
    runOut: Number.isFinite(daysLeft) ? addDays(at, Math.floor(daysLeft)) : null,
    needCost: need * (Number(f.price) || 0),
    costTillUntil: daily * toUntil * (Number(f.price) || 0),
  };
}

export function fmtUnits(n, unit) {
  if (!Number.isFinite(n)) return '—';
  const v = unit === 'т' ? Math.round(n * 100) / 100 : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  const f = unitOf(unit).forms;
  const word = Number.isInteger(v) ? plural(v, f[0], f[1], f[2]) : f[1];
  return `${v.toLocaleString('ru-RU')} ${word}`;
}

/* ---------- Изменения запасов ---------- */
export async function feedArrived(f, { date, amount, price, toFinance }) {
  const counts = headcount(await db.animals.toArray());
  const c = feedCalc(f, counts, date, date);
  return db.transaction('rw', db.feeds, db.feedLog, db.finance, async () => {
    const total = amount * (price || 0);
    await db.feeds.update(f.id, { stock: c.stock + amount, stockDate: date, ...(price ? { price } : {}) });
    await db.feedLog.add({ feedId: f.id, date, type: 'in', amount, price: price || null, total: total || null, ...(f.demo ? { demo: 1 } : {}) });
    if (toFinance && total > 0) {
      await db.finance.add({ date, kind: 'expense', category: 'feed', amount: total, note: `${f.name}: ${fmtUnits(amount, f.unit)}`, ...(f.demo ? { demo: 1 } : {}) });
    }
  });
}

export async function feedSetStock(f, { date, amount }) {
  return db.transaction('rw', db.feeds, db.feedLog, async () => {
    await db.feeds.update(f.id, { stock: amount, stockDate: date });
    await db.feedLog.add({ feedId: f.id, date, type: 'set', amount, ...(f.demo ? { demo: 1 } : {}) });
  });
}

export async function deleteFeed(id) {
  return db.transaction('rw', db.feeds, db.feedLog, async () => {
    await db.feedLog.where({ feedId: id }).delete();
    await db.feeds.delete(id);
  });
}
