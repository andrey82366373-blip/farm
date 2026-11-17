// Разбор голосовых фраз: числа словами → цифры, затем «что это за событие».
// Ничего не сохраняет: только готовит адрес формы с заполненными полями.
import { SPECIES } from './domain.js';

/* ---------- Числа словами ---------- */
const W = (re, v, kind) => ({ re: new RegExp(`^(?:${re})$`), v, kind });
const NUM_WORDS = [
  W('сто|сотая|сотый|сотой|сотого|сотую', 100, 'h'),
  W('двести|двухсот\\S*', 200, 'h'), W('триста|трехсот\\S*', 300, 'h'), W('четыреста|четырехсот\\S*', 400, 'h'),
  W('пятьсот|пятисот\\S*', 500, 'h'), W('шестьсот|шестисот\\S*', 600, 'h'), W('семьсот|семисот\\S*', 700, 'h'),
  W('восемьсот|восьмисот\\S*', 800, 'h'), W('девятьсот|девятисот\\S*', 900, 'h'),
  W('двадцать|двадцат\\S*', 20, 't'), W('тридцать|тридцат\\S*', 30, 't'), W('сорок|сорока|сороков\\S*', 40, 't'),
  W('пятьдесят|пятидесят\\S*', 50, 't'), W('шестьдесят|шестидесят\\S*', 60, 't'), W('семьдесят|семидесят\\S*', 70, 't'),
  W('восемьдесят|восьмидесят\\S*', 80, 't'), W('девяносто|девяност\\S*', 90, 't'),
  W('десять|десят(?:ый|ая|ой|ого|ую|ом)', 10, 'n'), W('одиннадцат\\S*', 11, 'n'), W('двенадцат\\S*', 12, 'n'),
  W('тринадцат\\S*', 13, 'n'), W('четырнадцат\\S*', 14, 'n'), W('пятнадцат\\S*', 15, 'n'), W('шестнадцат\\S*', 16, 'n'),
  W('семнадцат\\S*', 17, 'n'), W('восемнадцат\\S*', 18, 'n'), W('девятнадцат\\S*', 19, 'n'),
  W('ноль|нуль|нулев\\S*', 0, 'u'),
  W('один|одна|одно|одну|одного|одной|перв(?:ый|ая|ой|ое|ого|ую|ом)', 1, 'u'),
  W('два|две|двух|двум|втор(?:ой|ая|ое|ого|ую|ом)', 2, 'u'),
  W('три|трех|трем|трет(?:ий|ья|ье|ьей|ьего|ью|ьем)', 3, 'u'),
  W('четыре|четырех|четверт(?:ый|ая|ой|ого|ую|ом)', 4, 'u'),
  W('пять|пяти|пят(?:ый|ая|ой|ое|ого|ую|ом)', 5, 'u'),
  W('шесть|шести|шест(?:ой|ая|ое|ого|ую|ом)', 6, 'u'),
  W('семь|семи|седьм(?:ой|ая|ое|ого|ую|ом)', 7, 'u'),
  W('восемь|восьми|восьм(?:ой|ая|ое|ого|ую|ом)', 8, 'u'),
  W('девять|девяти|девят(?:ый|ая|ой|ое|ого|ую|ом)', 9, 'u'),
];
const THOUSAND = /^тысяч\S*$/;
const ORDER = { h: 3, t: 2, n: 1, u: 1 };

export function normalize(text) {
  return String(text || '').toLowerCase().replace(/ё/g, 'е').replace(/[,;]/g, ' , ').replace(/[«»"“”.!?:()]/g, ' ').replace(/(\d)\s+(\d{3})\b/g, '$1$2').replace(/\s+/g, ' ').trim();
}

// «сто пятой» → 105, «три тысячи» → 3000, «девяносто второй» → 92.
export function wordsToNumbers(text) {
  const words = normalize(text).split(' ').filter(Boolean);
  const out = [];
  let total = 0, cur = 0, inNum = false, last = 9;
  const flush = () => { if (inNum) out.push(String(total + cur)); total = 0; cur = 0; inNum = false; last = 9; };
  for (const w of words) {
    if (/^\d+([.,]\d+)?$/.test(w)) {
      // «3 тысячи» распознаётся цифрой и словом
      flush(); total = 0; cur = Number(w.replace(',', '.')); inNum = true; last = 0; continue;
    }
    if (THOUSAND.test(w) && inNum) { total += (cur || 1) * 1000; cur = 0; last = 4; continue; }
    if (THOUSAND.test(w)) { total = 1000; inNum = true; last = 4; continue; }
    const m = NUM_WORDS.find((x) => x.re.test(w));
    if (w === ',') { flush(); continue; }
    if (!m) { flush(); out.push(w); continue; }
    const ord = ORDER[m.kind];
    // «сто пять двадцать» — после меньшего разряда начинается новое число
    if (inNum && ord >= last && last !== 4) flush();
    cur += m.v; inNum = true; last = ord;
  }
  flush();
  return out.join(' ');
}

/* ---------- Поиск животных и групп в тексте ---------- */
const stem = (s, keep = 2) => { const w = normalize(s); return w.length > 5 ? w.slice(0, w.length - keep) : w.slice(0, Math.max(3, w.length - 1)); };

function groupMatchers() {
  const list = [];
  for (const sp of Object.values(SPECIES)) {
    for (const g of sp.groups) list.push({ species: sp.key, group: g.key, stems: [stem(g.one), stem(g.many)] });
    list.push({ species: sp.key, group: null, stems: [stem(sp.one), stem(sp.many)] });
  }
  // «ягнята», «телята» ловим по корню
  list.push({ species: 'sheep', group: 'lamb', stems: ['ягн'] }, { species: 'cow', group: 'calf', stems: ['тел', 'тельн'] }, { species: 'sheep', group: null, stems: ['овец', 'овечк'] });
  return list;
}
const GROUPS = groupMatchers();

export function findGroup(words, from = 0) {
  for (let i = from; i < words.length; i++) {
    const w = words[i];
    if (w.length < 3) continue;
    const hits = GROUPS
      .filter((x) => !(x.stems.includes('тел') && /^тел(о|ефон)/.test(w)))
      .map((x) => ({ ...x, len: Math.max(0, ...x.stems.filter((s) => s.length >= 3 && w.startsWith(s)).map((s) => s.length)) }))
      .filter((x) => x.len > 0);
    // самый длинный совпавший корень: «овцематок» — овцематки, а не овцы;
    // при равенстве («всем коровам») берём весь вид
    hits.sort((x, y) => y.len - x.len || (x.group === null ? -1 : 1) - (y.group === null ? -1 : 1));
    const g = hits[0];
    if (g) { const { len, ...rest } = g; void len; return { ...rest, index: i }; }
  }
  return null;
}

function speciesHint(t) {
  if (/(ягн|овц|овеч|баран|ярк|ярочк|окот|валух)/.test(t)) return 'sheep';
  if (/(тел[яеё]н|телк|теля|коров|бык|бычк|отел|нетел)/.test(t)) return 'cow';
  if (/(жереб|кобыл|лошад|конь|мерин)/.test(t)) return 'horse';
  return null;
}

// Числа и клички в тексте → животные на хозяйстве.
function findAnimals(words, animals, species, skip = new Set()) {
  const active = animals.filter((a) => a.status === 'active');
  const found = [], missing = [];
  words.forEach((w, i) => {
    if (skip.has(i)) return;
    if (/^\d+$/.test(w)) {
      let hits = active.filter((a) => a.tag === w || (a.name || '').trim() === w);
      if (species && hits.length > 1) hits = hits.filter((a) => a.species === species);
      if (hits.length === 0 && species) hits = [];
      if (hits.length >= 1) found.push(hits.find((a) => a.species === species) || hits[0]); else missing.push(w);
      return;
    }
    if (w.length < 3) return;
    const hit = active.find((a) => a.name && !/^\d+$/.test(a.name) && w.startsWith(stem(a.name, a.name.length > 4 ? 1 : 0)));
    if (hit) found.push(hit);
  });
  return { found: [...new Map(found.map((a) => [a.id, a])).values()], missing };
}

const label = (a) => (a.name || a.tag || 'без номера');

/* ---------- Главный разбор ---------- */
// Возвращает { kind, title, lines, route } — адрес формы с заполненными полями.
export function interpret(rawText, { animals = [], drugs = [], vehicles = [] } = {}) {
  const text = wordsToNumbers(rawText);
  const words = text.split(' ').filter(Boolean);
  const t = ` ${text} `;
  const q = new URLSearchParams();
  q.set('voice', String(rawText).trim());
  const lines = [];
  const has = (re) => re.test(t);
  const done = (kind, title, path) => ({ kind, title, lines, text, route: `${path}${path.includes('?') ? '&' : '?'}${q.toString()}` });
  const numIdx = () => words.map((w, i) => (/^\d+([.]\d+)?$/.test(w) ? i : -1)).filter((i) => i >= 0);

  // --- заправка ---
  if (has(/заправ|бензин|солярк|дизел|топлив|\sаи\s/)) {
    let type = null;
    const skip = new Set();
    if (has(/дизел|солярк|дт\s/)) type = 'Дизель';
    for (const i of numIdx()) {
      const v = Number(words[i]);
      if ([92, 95].includes(v) && (words[i - 1] === 'аи' || !type)) {
        const others = numIdx().filter((j) => j !== i);
        if (words[i - 1] === 'аи' || others.length > 0 || /^(втор|пят)/.test(normalize(rawText).split(' ').pop() || '')) { type = `АИ-${v}`; skip.add(i); }
      }
    }
    // «три тысячи девяносто второй» без паузы: сумма и марка слиплись
    if (!type) {
      for (const i of numIdx()) {
        const v = Number(words[i]);
        if (v > 1000 && [92, 95].includes(v % 1000)) { type = `АИ-${v % 1000}`; words[i] = String(v - (v % 1000)); }
      }
    }
    let liters = null, sum = null;
    for (const i of numIdx()) {
      if (skip.has(i)) continue;
      const next = words[i + 1] || '';
      if (next.startsWith('литр') || next === 'л') liters = Number(words[i]);
      else if (next.startsWith('руб') || next === 'р' || words[i - 1] === 'на') sum = Number(words[i]);
      else if (sum === null && liters === null) (Number(words[i]) >= 300 ? (sum = Number(words[i])) : (liters = Number(words[i])));
    }
    const vehicle = vehicles.find((v) => t.includes(stem(v, 1))) || (has(/трактор|мтз|т-?40|т-?25|белорус/) ? 'Трактор' : has(/машин|уаз|нив|газел|авто/) ? 'Машина' : null);
    if (type) { q.set('type', type); lines.push(`Топливо: ${type}`); }
    if (liters) { q.set('liters', String(liters)); lines.push(`Литры: ${liters}`); }
    if (sum) { q.set('sum', String(sum)); lines.push(`Сумма: ${sum} ₽`); }
    if (vehicle) { q.set('vehicle', vehicle); lines.push(`На что: ${vehicle.toLowerCase()}`); }
    if (!liters && !sum) lines.push('Сколько литров или на какую сумму, не понял');
    return done('fuel', 'Заправка', '/fuel/new');
  }

  // --- укол, прививка ---
  if (has(/укол|уколол|привив|прививк|вакцин|кололи|колол|обработ|глистогон/)) {
    const k = words.findIndex((w) => /^(укол|уколол|привив|прививк|вакцин|кололи|колол|обработ|глистогон)/.test(w));
    const stop = /^(?:всей|всем|вся|все|всех|группе|группа|групп\S*|у|для|на|от|по|и|в|сделал\S*|поставил\S*|сегодня|вчера|\d+)$/;
    let drug = '';
    // «прививка от ящура» → препарат «ящур»
    let from = k + 1;
    if (words[from] === 'от' && words[from + 1] && !findGroup([words[from + 1]])) from += 1;
    for (let i = from; i < words.length; i++) {
      if (stop.test(words[i]) || findGroup([words[i]])) break;
      drug = drug ? `${drug} ${words[i]}` : words[i];
      if (drug.split(' ').length >= 2) break;
    }
    if (drug) {
      const known = drugs.find((d) => normalize(d).startsWith(drug.slice(0, Math.min(4, drug.length))) || drug.startsWith(normalize(d).slice(0, 4)));
      if (!known && words[k + 1] === 'от') drug = drug.replace(/(а|ы|и)$/, '');
      drug = known || drug.charAt(0).toUpperCase() + drug.slice(1);
      q.set('drug', drug); lines.push(`Препарат: ${drug}`);
    } else lines.push('Название препарата не понял');
    if (has(/глист/)) q.set('kind', 'deworm');
    else if (has(/лечен|лечил/)) q.set('kind', 'treatment');
    const g = findGroup(words);
    const whole = has(/\s(всей|всем|вся|все|всех|целиком)\s/);
    if (g) {
      q.set('species', g.species); if (g.group) q.set('group', g.group);
      if (whole) q.set('all', '1');
      lines.push(`${whole ? 'Вся группа' : 'Группа'}: ${g.group ? SPECIES[g.species].groups.find((x) => x.key === g.group).many.toLowerCase() : SPECIES[g.species].many.toLowerCase()}`);
    }
    const { found, missing } = findAnimals(words, animals, g?.species ?? speciesHint(t));
    if (found.length) { q.set('ids', found.map((a) => a.id).join(',')); lines.push(`Животные: ${found.map(label).join(', ')}`); }
    if (missing.length) lines.push(`Не нашёл на хозяйстве: ${missing.join(', ')}`);
    return done('vet', 'Укол, прививка', '/event/vet');
  }

  // --- рождение ---
  if (has(/родил|родились|родила|родился|окот|окотил|отел|отелил|ожереб|принесл|двойн|тройн|двоен|троен/)) {
    let count = has(/тройн|троен|трое/) ? 3 : has(/двойн|двоен|двое/) ? 2 : null;
    const sp = speciesHint(t);
    const ui = words.findIndex((w) => w === 'у' || w === 'от');
    let mother = null;
    const skip = new Set();
    if (ui >= 0) {
      const w = words[ui + 1];
      if (w) {
        const hits = animals.filter((a) => a.status === 'active' && (a.tag === w || (a.name && w.startsWith(stem(a.name, a.name.length > 4 ? 1 : 0)))));
        mother = hits.find((a) => !sp || a.species === sp) || hits[0] || null;
        q.set('mother', mother ? (mother.name || mother.tag) : w);
        skip.add(ui + 1);
        lines.push(mother ? `Мать: ${label(mother)}` : `Мать: ${w} (на хозяйстве не нашёл)`);
      }
    }
    if (!mother && ui < 0) {
      const { found } = findAnimals(words, animals, sp);
      const f = found.filter((a) => a.sex !== 'm');
      if (f.length === 1) { mother = f[0]; q.set('mother', mother.name || mother.tag); lines.push(`Мать: ${label(mother)}`); words.forEach((w, i) => { if (w === mother.tag) skip.add(i); }); }
    }
    if (count === null) {
      const n = numIdx().find((i) => !skip.has(i) && Number(words[i]) <= 4 && Number(words[i]) > 0);
      count = n !== undefined ? Number(words[n]) : 1;
    }
    const species = mother?.species || sp || 'sheep';
    q.set('species', species); q.set('n', String(count));
    lines.push(`${SPECIES[species].birthWord}: ${count === 2 ? 'двойня' : count === 3 ? 'тройня' : count === 1 ? 'один' : count}`);
    const male = /(баранчик|бычок|бычк|жеребчик|мальчик)/.test(t), female = /(ярочк|телочк|кобылк|девочк)/.test(t);
    if (male !== female) { q.set('sex', male ? 'm' : 'f'); lines.push(male ? 'Все самцы' : 'Все самки'); }
    if (!mother && ui < 0) lines.push('Мать не назвали, укажите в форме');
    return done('birth', 'Родились', '/birth');
  }

  // --- падёж, забой, продажа, покрытие ---
  const forIds = [
    { re: /(^|\s)(пал|пала|пало|пали|падеж|сдох|сдохла|издох|погиб|погибла|умер|умерла|подох)/, kind: 'death', title: 'Падёж', path: '/event/death' },
    { re: /забил|забили|забой|зарезал|закололи/, kind: 'slaughter', title: 'Забой', path: '/event/slaughter' },
    { re: /продал|продали|продажа|продаю/, kind: 'sale', title: 'Продажа', path: '/sale/new' },
    { re: /покрыл|покрыта|случк|случил|осемен/, kind: 'mating', title: 'Покрытие', path: '/event/mating' },
  ];
  const ev = forIds.find((x) => x.re.test(t));
  if (ev) {
    const { found, missing } = findAnimals(words, animals, speciesHint(t));
    if (found.length) { q.set('ids', found.map((a) => a.id).join(',')); lines.push(`Животные: ${found.map(label).join(', ')}`); }
    if (missing.length) lines.push(`Не нашёл на хозяйстве: ${missing.join(', ')}. Выберите в списке`);
    if (!found.length && !missing.length) lines.push('Номер не назвали, выберите в списке');
    if (ev.kind === 'death') {
      const cause = has(/холод|мороз|замерз|переохлад|простыл/) ? 'cold' : has(/болез|болел|болен|понос|забол|хвор/) ? 'disease' : null;
      if (cause) { q.set('cause', cause); lines.push(`Причина: ${cause === 'cold' ? 'холод' : 'болезнь'}`); }
    }
    return done(ev.kind, ev.title, ev.path);
  }

  if (has(/пересчет|посчита|считать/)) return done('count', 'Пересчёт', '/count');

  // --- просто номер или кличка: открыть карточку ---
  const { found } = findAnimals(words, animals, speciesHint(t));
  if (found.length === 1) { lines.push(`Животное: ${label(found[0])}`); return { kind: 'animal', title: 'Карточка животного', lines, text, route: `/animal/${found[0].id}` }; }
  return { kind: 'unknown', title: 'Не понял', lines, text, route: null };
}

export const VOICE_EXAMPLES = [
  { group: 'Рождение', items: ['Родилась двойня у сто пятой', 'Окот у сто двенадцатой, тройня', 'Отелилась Зорька, бычок'] },
  { group: 'Падёж и забой', items: ['Пал ягнёнок двести двенадцать от холода', 'Пала овца сто семь, болезнь', 'Забили баранчика триста три'] },
  { group: 'Уколы', items: ['Укол ивомек всей группе овцематок', 'Прививка от ящура всем коровам', 'Укол альбендазол сто первой и сто второй'] },
  { group: 'Заправка', items: ['Заправился на три тысячи, девяносто второй', 'Дизель сорок литров в трактор', 'Заправка двадцать пять литров девяносто пятый'] },
  { group: 'Другое', items: ['Продал сто пятнадцать и сто шестнадцать', 'Покрыта Зорька', 'Пересчёт', 'Сто пятая (откроет карточку)'] },
];
