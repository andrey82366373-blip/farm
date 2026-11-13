import { db } from './db.js';
import { today, addDays } from './format.js';

// Тестовое хозяйство для проверки. У всех записей стоит demo: 1,
// поэтому их можно удалить одной кнопкой, не задев настоящие данные.

function rng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

export async function demoCount() {
  return db.animals.where('demo').equals(1).count();
}

export async function loadDemo() {
  const real = await db.animals.filter((a) => !a.demo).count();
  if (real > 0) throw new Error('Тестовые данные можно загрузить только в пустое приложение. Сейчас в нём уже есть ваши животные.');
  if (await demoCount()) throw new Error('Тестовые данные уже загружены.');

  const r = rng(7);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const T = today();
  const y = Number(T.slice(0, 4));
  const D = { demo: 1 };
  const colors = ['белая', 'белая, чёрная морда', 'серая', 'рыжеватая', 'белая, пятно на ухе', 'тёмная', ''];

  await db.transaction('rw', db.animals, db.events, db.sales, db.finance, db.counts, async () => {
    const A = async (x) => db.animals.add({
      tag: '', sex: 'f', birthDate: null, birthApprox: false, motherId: null, motherTag: null, color: '', notes: '',
      hasPhoto: false, status: 'active', outDate: null, createdAt: Date.now(), ...x, ...D,
    });
    const E = (x) => db.events.add({ data: {}, ...x, ...D });

    /* ---------- Овцы ---------- */
    const rams = [];
    rams.push(await A({ species: 'sheep', tag: '1', sex: 'm', group: 'ram', birthDate: `${y - 4}-03-01`, birthApprox: true, color: 'крупный, рога' }));
    rams.push(await A({ species: 'sheep', tag: '2', sex: 'm', group: 'ram', birthDate: `${y - 2}-02-20`, color: 'белый' }));
    await A({ species: 'sheep', tag: '3', sex: 'm', group: 'wether', birthDate: `${y - 3}-03-15`, birthApprox: true });

    const ewes = [];
    for (let i = 0; i < 40; i++) {
      const age = 2 + Math.floor(r() * 5);
      const id = await A({
        species: 'sheep', tag: String(101 + i), group: 'ewe', birthDate: `${y - age}-0${2 + Math.floor(r() * 3)}-${10 + Math.floor(r() * 15)}`,
        birthApprox: r() < 0.4, color: pick(colors), notes: i === 7 ? 'Хромает на заднюю ногу, следить' : '',
      });
      ewes.push({ id, tag: String(101 + i) });
    }
    // две овцематки куплены в прошлом году
    for (const e of ewes.slice(38)) {
      await E({ animalId: e.id, type: 'purchase', date: `${y - 1}-09-12`, data: { seller: 'Петров А. С.', price: 12000 } });
    }
    await db.finance.add({ date: `${y - 1}-09-12`, kind: 'expense', category: 'animals', amount: 24000, note: 'Покупка: 2 гол. овец, Петров А. С.', ...D });

    let lambTag = 301;
    // окот прошлого года: ярочки остались (сейчас ярки), баранчиков продали
    const lastYearMales = [];
    for (let i = 0; i < 14; i++) {
      const m = ewes[i];
      const date = addDays(`${y - 1}-02-25`, Math.floor(r() * 30));
      const sex = i < 6 ? 'f' : 'm';
      const id = await A({ species: 'sheep', tag: i < 6 ? String(201 + i) : String(250 + i), sex, group: sex === 'f' ? 'yarka' : 'lamb', birthDate: date, motherId: m.id, motherTag: m.tag, color: pick(colors) });
      await E({ animalId: id, type: 'birth', date, motherId: m.id, data: { litter: 1 } });
      if (sex === 'm') lastYearMales.push(id);
    }
    // продажа баранчиков прошлой осенью
    {
      const date = `${y - 1}-10-18`;
      const weight = 36 * lastYearMales.length;
      const total = 280 * weight;
      const saleId = await db.sales.add({ date, buyer: 'Ахмедов Р.', mode: 'kg', price: 280, weight, total, count: lastYearMales.length, animalIds: lastYearMales, species: ['sheep'], note: '', ...D });
      for (const id of lastYearMales) {
        await db.animals.update(id, { status: 'sold', outDate: date });
        await E({ animalId: id, type: 'sale', date, saleId, data: { buyer: 'Ахмедов Р.' } });
      }
      await db.finance.add({ date, kind: 'income', category: 'animals', amount: total, saleId, note: `Продажа: ${lastYearMales.length} гол., Ахмедов Р.`, ...D });
    }

    // одна овцематка пала зимой
    await db.animals.update(ewes[20].id, { status: 'dead', outDate: `${y}-01-17` });
    await E({ animalId: ewes[20].id, type: 'death', date: `${y}-01-17`, data: { cause: 'disease', note: 'Не ела три дня' } });

    // окот этого года: февраль–март
    const lambs = [];
    let stillborn = 0;
    for (let i = 0; i < 30; i++) {
      const m = ewes[(i * 7 + 3) % 38];
      if (m.id === ewes[20].id) continue;
      const date = addDays(`${y}-02-08`, Math.floor(r() * 42));
      const litter = r() < 0.45 ? 2 : 1;
      for (let k = 0; k < litter; k++) {
        const sex = r() < 0.5 ? 'm' : 'f';
        const dead = stillborn < 3 && r() < 0.06;
        const untagged = !dead && r() < 0.12;
        const id = await A({
          species: 'sheep', tag: dead || untagged ? '' : String(lambTag++), sex, group: 'lamb', birthDate: date,
          motherId: m.id, motherTag: m.tag, color: pick(colors), status: dead ? 'dead' : 'active', outDate: dead ? date : null,
        });
        await E({ animalId: id, type: 'birth', date, motherId: m.id, data: { litter, note: '' } });
        if (dead) { stillborn++; await E({ animalId: id, type: 'death', date, data: { cause: 'stillborn', note: '' } }); }
        else lambs.push({ id, sex, date, tagged: !untagged });
      }
    }
    // падёж ягнят после рождения
    const lost = [[lambs[4], 'cold', 'Ночью ударил мороз'], [lambs[11], 'cold', ''], [lambs[19], 'disease', 'Понос']];
    for (const [l, cause, note] of lost) {
      const date = addDays(l.date, 3 + Math.floor(r() * 10));
      await db.animals.update(l.id, { status: 'dead', outDate: date });
      await E({ animalId: l.id, type: 'death', date, data: { cause, note } });
    }
    const alive = lambs.filter((l) => !lost.some(([x]) => x.id === l.id));
    const males = alive.filter((l) => l.sex === 'm' && l.tagged);

    // забой трёх баранчиков в сентябре
    for (const l of males.slice(0, 3)) {
      await db.animals.update(l.id, { status: 'slaughtered', outDate: `${y}-09-20` });
      await E({ animalId: l.id, type: 'slaughter', date: `${y}-09-20`, data: { weight: 18 + Math.round(r() * 6), note: 'Для себя' } });
    }
    // продажа баранчиков в октябре
    const sold = males.slice(3, 15).map((l) => l.id);
    {
      const date = `${y}-10-24`;
      const weight = 41 * sold.length;
      const total = 320 * weight;
      const saleId = await db.sales.add({ date, buyer: 'Ахмедов Р.', mode: 'kg', price: 320, weight, total, count: sold.length, animalIds: sold, species: ['sheep'], note: 'Забрал сам', ...D });
      for (const id of sold) {
        await db.animals.update(id, { status: 'sold', outDate: date });
        await E({ animalId: id, type: 'sale', date, saleId, data: { buyer: 'Ахмедов Р.' } });
      }
      await db.finance.add({ date, kind: 'income', category: 'animals', amount: total, saleId, note: `Продажа: ${sold.length} гол., Ахмедов Р.`, ...D });
    }

    // прививки и обработки
    const sheepNow = await db.animals.where({ species: 'sheep' }).filter((a) => a.demo && a.status === 'active').toArray();
    for (const a of sheepNow.filter((x) => x.group === 'ewe' || x.group === 'ram')) {
      await E({ animalId: a.id, type: 'vet', date: `${y}-01-28`, data: { kind: 'vaccine', drug: 'Вакцина от клостридиозов', note: 'Перед окотом' } });
    }
    for (const a of sheepNow) {
      await E({ animalId: a.id, type: 'vet', date: `${y}-09-05`, data: { kind: 'deworm', drug: 'Альбендазол', note: '' } });
    }
    await db.finance.add({ date: `${y}-09-05`, kind: 'expense', category: 'vet', amount: 4300, note: 'От глистов: всё стадо', ...D });
    await E({ animalId: ewes[7].id, type: 'vet', date: `${y}-06-14`, data: { kind: 'treatment', drug: 'Окситетрациклин', note: 'Копытная гниль, 5 дней' } });

    /* ---------- Коровы ---------- */
    await A({ species: 'cow', tag: '1', sex: 'm', group: 'bull', birthDate: `${y - 5}-04-10`, birthApprox: true, color: 'чёрно-пёстрый' });
    const cows = [];
    for (let i = 0; i < 7; i++) {
      const id = await A({ species: 'cow', tag: String(11 + i), group: 'cow', birthDate: `${y - 3 - (i % 5)}-0${3 + (i % 5)}-12`, birthApprox: i % 3 === 0, color: pick(['рыжая', 'чёрно-пёстрая', 'бурая', 'рыжая, белая звезда']) });
      cows.push({ id, tag: String(11 + i) });
    }
    await A({ species: 'cow', tag: '21', group: 'heifer', birthDate: `${y - 1}-04-02`, motherId: cows[0].id, motherTag: '11', color: 'рыжая' });
    await A({ species: 'cow', tag: '22', group: 'heifer', birthDate: `${y - 1}-05-19`, motherId: cows[2].id, motherTag: '13', color: 'бурая' });
    await A({ species: 'cow', tag: '23', group: 'netel', birthDate: `${y - 2}-04-25`, motherId: cows[3].id, motherTag: '14', color: 'чёрно-пёстрая', notes: 'Покрыта в феврале' });
    await A({ species: 'cow', tag: '41', sex: 'm', group: 'steer', birthDate: `${y - 1}-03-08`, motherId: cows[1].id, motherTag: '12', color: 'рыжий' });
    // отёл этого года
    let calfTag = 31;
    for (const [i, date, sex] of [[0, `${y}-03-11`, 'f'], [1, `${y}-03-29`, 'm'], [2, `${y}-04-16`, 'm'], [4, `${y}-05-02`, 'f'], [5, `${y}-05-21`, 'm']]) {
      const id = await A({ species: 'cow', tag: String(calfTag++), sex, group: 'calf', birthDate: date, motherId: cows[i].id, motherTag: cows[i].tag, color: pick(['рыжий', 'бурый', 'чёрно-пёстрый']) });
      await E({ animalId: id, type: 'birth', date, motherId: cows[i].id, data: { litter: 1 } });
      if (i === 4) {
        await db.animals.update(id, { status: 'dead', outDate: `${y}-05-30` });
        await E({ animalId: id, type: 'death', date: `${y}-05-30`, data: { cause: 'disease', note: 'Диспепсия' } });
      }
    }
    // старую корову продали
    {
      const date = `${y}-09-12`;
      await db.animals.update(cows[6].id, { notes: 'Старая, плохо доилась' });
      const saleId = await db.sales.add({ date, buyer: 'Мясокомбинат «Заречный»', mode: 'head', price: 85000, weight: null, total: 85000, count: 1, animalIds: [cows[6].id], species: ['cow'], note: '', ...D });
      await db.animals.update(cows[6].id, { status: 'sold', outDate: date });
      await E({ animalId: cows[6].id, type: 'sale', date, saleId, data: { buyer: 'Мясокомбинат «Заречный»' } });
      await db.finance.add({ date, kind: 'income', category: 'animals', amount: 85000, saleId, note: 'Продажа: 1 гол., Мясокомбинат «Заречный»', ...D });
    }
    const cowsNow = await db.animals.where({ species: 'cow' }).filter((a) => a.demo && a.status === 'active').toArray();
    for (const a of cowsNow) {
      await E({ animalId: a.id, type: 'vet', date: `${y}-04-03`, data: { kind: 'vaccine', drug: 'Ящур', note: 'Плановая' } });
    }

    /* ---------- Лошади ---------- */
    const mare = await A({ species: 'horse', tag: '1', group: 'mare', birthDate: `${y - 9}-05-01`, birthApprox: true, color: 'гнедая', notes: 'Спокойная, ходит под седлом' });
    const mare2 = await A({ species: 'horse', tag: '2', group: 'mare', birthDate: `${y - 6}-04-20`, color: 'рыжая' });
    await A({ species: 'horse', tag: '3', sex: 'm', group: 'stallion', birthDate: `${y - 7}-06-10`, birthApprox: true, color: 'вороной' });
    {
      const date = `${y}-05-14`;
      const id = await A({ species: 'horse', tag: '4', sex: 'f', group: 'foal', birthDate: date, motherId: mare, motherTag: '1', color: 'гнедая' });
      await E({ animalId: id, type: 'birth', date, motherId: mare, data: { litter: 1 } });
    }

    /* ---------- Покрытия: ожидаемые роды для календаря ---------- */
    const M = (animalId, date, data = {}) => E({ animalId, type: 'mating', date, data: { sire: '', note: '', ...data } });
    const ewesActive = await db.animals.where({ species: 'sheep' }).filter((a) => a.demo && a.status === 'active' && a.group === 'ewe').toArray();
    for (const a of ewesActive.slice(0, 30)) await M(a.id, addDays(T, -24), { sire: '1' });
    await M(ewesActive[32].id, addDays(T, -152), { sire: '2', note: 'Покрыта раньше остальных' });
    await M(cows[3].id, addDays(T, 12 - 283), { sire: '1' });
    const netel = await db.animals.where({ species: 'cow', tag: '23' }).first();
    await M(netel.id, addDays(T, 17 - 283), { note: 'Искусственное осеменение' });
    await M(cows[5].id, addDays(T, -95), { sire: '1' });
    await M(mare, addDays(T, -165), { sire: '3' });
    await M(mare2, addDays(T, -200), { sire: '3', failed: true });

    /* ---------- Прочие деньги и пересчёты ---------- */
    await db.finance.bulkAdd([
      { date: `${y}-08-20`, kind: 'expense', category: 'feed', amount: 96000, note: 'Сено, 40 рулонов', ...D },
      { date: `${y}-10-02`, kind: 'expense', category: 'feed', amount: 38000, note: 'Ячмень, 2 т', ...D },
      { date: `${y}-06-25`, kind: 'income', category: 'wool', amount: 14500, note: 'Шерсть после стрижки', ...D },
    ]);
    const ewesNow = await db.animals.where({ species: 'sheep' }).filter((a) => a.demo && a.status === 'active' && a.group === 'ewe').toArray();
    await db.counts.add({ date: addDays(T, -12), at: Date.now() - 12 * 864e5, species: 'sheep', group: 'ewe', expected: ewesNow.length, counted: ewesNow.length, marked: false, seenIds: [], missingIds: [], ...D });
    const miss = ewesNow[ewesNow.length - 3];
    await db.counts.add({
      date: addDays(T, -2), at: Date.now() - 2 * 864e5, species: 'sheep', group: 'ewe', expected: ewesNow.length, counted: ewesNow.length - 1,
      marked: true, seenIds: ewesNow.filter((a) => a.id !== miss.id).map((a) => a.id), missingIds: [miss.id], ...D,
    });
  });
}

// Удаляет всё, что относится к тестовым животным, и ничего больше.
export async function removeDemo() {
  await db.transaction('rw', db.animals, db.photos, db.events, db.sales, db.finance, db.counts, async () => {
    const ids = new Set(await db.animals.where('demo').equals(1).primaryKeys());
    const sales = await db.sales.filter((s) => s.demo || s.animalIds.some((id) => ids.has(id))).toArray();
    const saleIds = new Set(sales.map((s) => s.id));
    await db.events.filter((e) => e.demo || ids.has(e.animalId) || saleIds.has(e.saleId)).delete();
    await db.finance.filter((f) => f.demo || saleIds.has(f.saleId)).delete();
    await db.sales.bulkDelete([...saleIds]);
    await db.counts.filter((c) => c.demo).delete();
    await db.photos.bulkDelete([...ids]);
    await db.animals.bulkDelete([...ids]);
  });
}
