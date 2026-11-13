import Dexie from 'dexie';
import { SPECIES, groupOf } from './domain.js';
import { today } from './format.js';

// Все данные лежат в памяти телефона (IndexedDB). Поле demo: 1 есть только
// у тестовых записей — по нему их можно удалить, не трогая настоящие.
export const db = new Dexie('farm');

db.version(1).stores({
  animals: '++id, species, status, tag, [species+tag], group, motherId, demo',
  photos: 'animalId',
  events: '++id, animalId, type, date, motherId, saleId, demo',
  sales: '++id, date, demo',
  finance: '++id, date, kind, category, saleId, demo',
  counts: '++id, date, demo',
  settings: 'key',
});

export const TABLES = ['animals', 'photos', 'events', 'sales', 'finance', 'counts', 'settings'];

// Просим браузер не стирать данные при нехватке места.
export async function askPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* не страшно */ }
}

/* ---------- Настройки ---------- */
export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}
export function setSetting(key, value) {
  return db.settings.put({ key, value });
}

/* ---------- Бирки ---------- */
export class FarmError extends Error {}

export function cleanTag(tag) {
  return String(tag ?? '').replace(/\D/g, '');
}

// Номер бирки уникален внутри вида среди животных на хозяйстве.
export async function findTagOwner(species, tag, exceptId) {
  const t = cleanTag(tag);
  if (!t) return null;
  const list = await db.animals.where({ species, tag: t }).toArray();
  return list.find((a) => a.status === 'active' && a.id !== exceptId) ?? null;
}
async function assertTagFree(species, tag, exceptId) {
  const owner = await findTagOwner(species, tag, exceptId);
  if (owner) {
    throw new FarmError(`Бирка ${owner.tag} уже есть у животного на хозяйстве (${SPECIES[species].one.toLowerCase()}). Проверьте номер.`);
  }
}
function assertUniqueInBatch(species, tags) {
  const seen = new Set();
  for (const t of tags.map(cleanTag).filter(Boolean)) {
    if (seen.has(t)) throw new FarmError(`Бирка ${t} указана дважды.`);
    seen.add(t);
  }
}

/* ---------- Животные ---------- */
function normalizeAnimal(a) {
  const g = groupOf(a.species, a.group);
  return {
    species: a.species,
    tag: cleanTag(a.tag),
    sex: g?.sex ?? a.sex ?? 'f',
    group: a.group,
    birthDate: a.birthDate || null,
    birthApprox: !!a.birthApprox,
    motherId: a.motherId ?? null,
    motherTag: cleanTag(a.motherTag) || null,
    color: (a.color || '').trim(),
    notes: (a.notes || '').trim(),
    hasPhoto: !!a.hasPhoto,
    status: a.status || 'active',
    outDate: a.outDate || null,
    createdAt: a.createdAt || Date.now(),
    ...(a.demo ? { demo: 1 } : {}),
  };
}

// Находит мать по номеру бирки (сначала среди тех, кто на хозяйстве).
export async function resolveMother(species, tag) {
  const t = cleanTag(tag);
  if (!t) return null;
  const list = await db.animals.where({ species, tag: t }).toArray();
  return list.find((a) => a.status === 'active') ?? list[0] ?? null;
}

export async function saveAnimal(data, photoBlob) {
  return db.transaction('rw', db.animals, db.photos, db.events, async () => {
    const a = normalizeAnimal(data);
    if (a.status === 'active') await assertTagFree(a.species, a.tag, data.id);
    if (a.motherTag && !a.motherId) {
      const m = await resolveMother(a.species, a.motherTag);
      if (m) a.motherId = m.id;
    }
    let id = data.id;
    if (id) {
      const old = await db.animals.get(id);
      Object.assign(a, { createdAt: old.createdAt, status: old.status, outDate: old.outDate });
      if (old.demo) a.demo = 1;
      if (old.group !== a.group) {
        await db.events.add(withDemo({ animalId: id, type: 'group', date: today(), data: { from: old.group, to: a.group } }, old));
      }
      if (old.tag !== a.tag && a.tag) {
        await db.events.add(withDemo({ animalId: id, type: 'tag', date: today(), data: { from: old.tag, to: a.tag } }, old));
      }
      await db.animals.put({ ...a, id });
    } else {
      id = await db.animals.add(a);
    }
    if (photoBlob === null) {
      await db.photos.delete(id);
      await db.animals.update(id, { hasPhoto: false });
    } else if (photoBlob) {
      await db.photos.put({ animalId: id, blob: photoBlob });
      await db.animals.update(id, { hasPhoto: true });
    }
    return id;
  });
}

function withDemo(rec, src) {
  return src?.demo ? { ...rec, demo: 1 } : rec;
}

export async function deleteAnimal(id) {
  return db.transaction('rw', db.animals, db.photos, db.events, async () => {
    await db.events.where({ animalId: id }).delete();
    await db.photos.delete(id);
    await db.animals.where({ motherId: id }).modify({ motherId: null });
    await db.animals.delete(id);
  });
}

export async function assignTag(id, tag) {
  const a = await db.animals.get(id);
  const t = cleanTag(tag);
  if (!t) throw new FarmError('Введите номер бирки.');
  await assertTagFree(a.species, t, id);
  await db.transaction('rw', db.animals, db.events, async () => {
    await db.animals.update(id, { tag: t });
    await db.events.add(withDemo({ animalId: id, type: 'tag', date: today(), data: { from: a.tag || null, to: t } }, a));
  });
}

export async function changeGroup(ids, to, date = today()) {
  return db.transaction('rw', db.animals, db.events, async () => {
    for (const id of ids) {
      const a = await db.animals.get(id);
      if (!a || a.group === to) continue;
      const g = groupOf(a.species, to);
      await db.animals.update(id, { group: to, sex: g?.sex ?? a.sex, snoozeUntil: null });
      await db.events.add(withDemo({ animalId: id, type: 'group', date, data: { from: a.group, to } }, a));
    }
  });
}

export function snoozeMaturity(ids, until) {
  return db.animals.where('id').anyOf(ids).modify({ snoozeUntil: until });
}

/* ---------- События ---------- */

// Рождение: сразу несколько новорождённых от одной матери.
// babies: [{ sex, tag, color, stillborn }]
export async function recordBirth({ species, motherId, motherTag, date, babies, note }) {
  assertUniqueInBatch(species, babies.map((b) => b.tag));
  return db.transaction('rw', db.animals, db.events, async () => {
    const mother = motherId ? await db.animals.get(motherId) : null;
    const demo = mother?.demo ? { demo: 1 } : {};
    const ids = [];
    for (const b of babies) {
      if (!b.stillborn) await assertTagFree(species, b.tag);
      const id = await db.animals.add(normalizeAnimal({
        species, sex: b.sex, group: SPECIES[species].newborn, tag: b.stillborn ? '' : b.tag,
        birthDate: date, motherId: mother?.id ?? null, motherTag: mother?.tag ?? motherTag,
        color: b.color, status: b.stillborn ? 'dead' : 'active', outDate: b.stillborn ? date : null, ...demo,
      }));
      // у новорождённого пол хранится явно
      await db.animals.update(id, { sex: b.sex });
      await db.events.add({ animalId: id, type: 'birth', date, motherId: mother?.id ?? null, data: { litter: babies.length, note: note || '' }, ...demo });
      if (b.stillborn) {
        await db.events.add({ animalId: id, type: 'death', date, data: { cause: 'stillborn', note: '' }, ...demo });
      }
      ids.push(id);
    }
    return ids;
  });
}

// Покупка: несколько животных одной партией, расход попадает в финансы.
export async function recordPurchase({ species, group, date, seller, totalPrice, animals, note }) {
  assertUniqueInBatch(species, animals.map((a) => a.tag));
  return db.transaction('rw', db.animals, db.events, db.finance, async () => {
    const ids = [];
    const per = totalPrice ? totalPrice / animals.length : null;
    for (const x of animals) {
      await assertTagFree(species, x.tag);
      const id = await db.animals.add(normalizeAnimal({ ...x, species, group: x.group || group }));
      if (x.sex) await db.animals.update(id, { sex: x.sex });
      await db.events.add({ animalId: id, type: 'purchase', date, data: { seller: seller || '', price: per, note: note || '' } });
      ids.push(id);
    }
    if (totalPrice) {
      await db.finance.add({
        date, kind: 'expense', category: 'animals', amount: totalPrice,
        note: `Покупка: ${animals.length} гол. ${SPECIES[species].gen}${seller ? ', ' + seller : ''}`,
      });
    }
    return ids;
  });
}

// Выбытие (падёж или забой): животное уходит из поголовья, история остаётся.
export async function recordOut(ids, { type, date, cause, weight, note }) {
  const status = type === 'death' ? 'dead' : 'slaughtered';
  return db.transaction('rw', db.animals, db.events, async () => {
    for (const id of ids) {
      const a = await db.animals.get(id);
      await db.animals.update(id, { status, outDate: date });
      await db.events.add(withDemo({ animalId: id, type, date, data: { cause: cause || null, weight: weight ?? null, note: note || '' } }, a));
    }
  });
}

// Вернуть на хозяйство (если падёж или забой записали по ошибке).
export async function undoOut(id) {
  return db.transaction('rw', db.animals, db.events, async () => {
    const evs = await db.events.where({ animalId: id }).toArray();
    const last = evs.filter((e) => e.type === 'death' || e.type === 'slaughter').sort(byDateDesc)[0];
    if (last) await db.events.delete(last.id);
    await db.animals.update(id, { status: 'active', outDate: null });
  });
}

export async function recordVet(ids, { date, kind, drug, note }) {
  return db.transaction('rw', db.animals, db.events, async () => {
    for (const id of ids) {
      const a = await db.animals.get(id);
      await db.events.add(withDemo({ animalId: id, type: 'vet', date, data: { kind, drug: drug || '', note: note || '' } }, a));
    }
  });
}

export async function addNote(id, { date, note }) {
  const a = await db.animals.get(id);
  return db.events.add(withDemo({ animalId: id, type: 'note', date, data: { note } }, a));
}

export function deleteEvent(id) {
  return db.events.delete(id);
}

export function byDateDesc(a, b) {
  return a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id ?? 0) - (a.id ?? 0);
}

/* ---------- Продажи ---------- */
// mode: 'head' — цена за голову, 'kg' — цена за килограмм (нужен вес).
export function saleTotal({ mode, price, weight, count }) {
  if (!price) return 0;
  return mode === 'kg' ? price * (weight || 0) : price * count;
}

export async function recordSale({ ids, date, buyer, mode, price, weight, note }) {
  if (!ids.length) throw new FarmError('Не выбрано ни одного животного.');
  if (mode === 'kg' && !weight) throw new FarmError('Для цены за килограмм укажите общий вес.');
  return db.transaction('rw', db.animals, db.events, db.sales, db.finance, async () => {
    const animals = await db.animals.bulkGet(ids);
    const demo = animals.every((a) => a.demo) ? { demo: 1 } : {};
    const total = saleTotal({ mode, price, weight, count: ids.length });
    const species = [...new Set(animals.map((a) => a.species))];
    const saleId = await db.sales.add({
      date, buyer: buyer || '', mode, price, weight: weight || null, total, count: ids.length,
      animalIds: ids, species, note: note || '', ...demo,
    });
    for (const a of animals) {
      await db.animals.update(a.id, { status: 'sold', outDate: date });
      await db.events.add({ animalId: a.id, type: 'sale', date, saleId, data: { buyer: buyer || '' }, ...demo });
    }
    await db.finance.add({
      date, kind: 'income', category: 'animals', amount: total, saleId,
      note: `Продажа: ${ids.length} гол.${buyer ? ', ' + buyer : ''}`, ...demo,
    });
    return saleId;
  });
}

// Отменить продажу: животные возвращаются на хозяйство, доход убирается.
export async function deleteSale(saleId) {
  return db.transaction('rw', db.animals, db.events, db.sales, db.finance, async () => {
    const s = await db.sales.get(saleId);
    if (!s) return;
    for (const id of s.animalIds) {
      const a = await db.animals.get(id);
      if (a && a.status === 'sold') await db.animals.update(id, { status: 'active', outDate: null });
    }
    await db.events.where({ saleId }).delete();
    await db.finance.where({ saleId }).delete();
    await db.sales.delete(saleId);
  });
}

/* ---------- Пересчёты ---------- */
export function saveCount(rec) {
  return db.counts.add(rec);
}
export function deleteCount(id) {
  return db.counts.delete(id);
}
