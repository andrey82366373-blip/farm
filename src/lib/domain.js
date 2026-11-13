// Справочники хозяйства: виды, группы, правила взросления, подписи.
// Чтобы поменять названия групп или возраст перевода, правьте этот файл.

export const SPECIES = {
  sheep: {
    key: 'sheep', one: 'Овца', many: 'Овцы', gen: 'овец', icon: 'sheep',
    birthWord: 'Окот', newborn: 'lamb',
    babyLabel: { m: 'Баранчик', f: 'Ярочка' },
    groups: [
      { key: 'ewe', one: 'Овцематка', many: 'Овцематки', sex: 'f' },
      { key: 'ram', one: 'Баран', many: 'Бараны', sex: 'm' },
      { key: 'wether', one: 'Валух', many: 'Валухи', sex: 'm' },
      { key: 'yarka', one: 'Ярка', many: 'Ярки', sex: 'f' },
      { key: 'lamb', one: 'Ягнёнок', many: 'Ягнята', sex: null },
    ],
  },
  cow: {
    key: 'cow', one: 'Корова', many: 'Коровы', gen: 'коров', icon: 'cow',
    birthWord: 'Отёл', newborn: 'calf',
    babyLabel: { m: 'Бычок', f: 'Тёлочка' },
    groups: [
      { key: 'cow', one: 'Корова', many: 'Коровы', sex: 'f' },
      { key: 'netel', one: 'Нетель', many: 'Нетели', sex: 'f' },
      { key: 'heifer', one: 'Тёлка', many: 'Тёлки', sex: 'f' },
      { key: 'steer', one: 'Бычок', many: 'Бычки', sex: 'm' },
      { key: 'bull', one: 'Бык', many: 'Быки', sex: 'm' },
      { key: 'calf', one: 'Телёнок', many: 'Телята', sex: null },
    ],
  },
  horse: {
    key: 'horse', one: 'Лошадь', many: 'Лошади', gen: 'лошадей', icon: 'horse',
    birthWord: 'Выжеребка', newborn: 'foal',
    babyLabel: { m: 'Жеребчик', f: 'Кобылка' },
    groups: [
      { key: 'mare', one: 'Кобыла', many: 'Кобылы', sex: 'f' },
      { key: 'stallion', one: 'Жеребец', many: 'Жеребцы', sex: 'm' },
      { key: 'gelding', one: 'Мерин', many: 'Мерины', sex: 'm' },
      { key: 'foal', one: 'Жеребёнок', many: 'Жеребята', sex: null },
    ],
  },
};

export const SPECIES_LIST = [SPECIES.sheep, SPECIES.cow, SPECIES.horse];

export function groupOf(species, key) {
  return SPECIES[species]?.groups.find((g) => g.key === key);
}
export function groupName(species, key, form = 'one') {
  return groupOf(species, key)?.[form] ?? '—';
}

// Взросление: через сколько месяцев молодняк пора перевести и куда.
// options — варианты по полу; первый вариант предлагается по умолчанию.
export const MATURITY = [
  { species: 'sheep', from: 'lamb', months: 8, to: { f: ['yarka'], m: ['ram', 'wether'] } },
  { species: 'sheep', from: 'yarka', months: 20, to: { f: ['ewe'] }, afterBirth: true },
  { species: 'cow', from: 'calf', months: 6, to: { f: ['heifer'], m: ['steer'] } },
  { species: 'cow', from: 'heifer', months: null, to: { f: ['cow'] }, afterBirth: true },
  { species: 'cow', from: 'netel', months: null, to: { f: ['cow'] }, afterBirth: true },
  { species: 'cow', from: 'steer', months: 18, to: { m: ['bull'] } },
  { species: 'horse', from: 'foal', months: 12, to: { f: ['mare'], m: ['stallion', 'gelding'] } },
];

export const STATUS = {
  active: { label: 'На хозяйстве', short: 'на месте' },
  sold: { label: 'Продано', short: 'продано' },
  dead: { label: 'Пало', short: 'пало' },
  slaughtered: { label: 'Забито', short: 'забито' },
};

export const DEATH_CAUSES = [
  { key: 'cold', label: 'Холод' },
  { key: 'disease', label: 'Болезнь' },
  { key: 'other', label: 'Другое' },
];
export const STILLBORN = { key: 'stillborn', label: 'Мёртворождённый' };
export function causeLabel(key) {
  if (key === 'stillborn') return STILLBORN.label;
  return DEATH_CAUSES.find((c) => c.key === key)?.label ?? 'Другое';
}

export const VET_KINDS = [
  { key: 'vaccine', label: 'Прививка' },
  { key: 'treatment', label: 'Лечение' },
  { key: 'deworm', label: 'От глистов' },
  { key: 'other', label: 'Осмотр, другое' },
];
export function vetLabel(key) {
  return VET_KINDS.find((v) => v.key === key)?.label ?? 'Ветеринария';
}

export const EVENT_TYPES = {
  birth: { label: 'Рождение', icon: 'birth', tone: 'green' },
  purchase: { label: 'Покупка', icon: 'cart', tone: 'sky' },
  death: { label: 'Падёж', icon: 'death', tone: 'red' },
  slaughter: { label: 'Забой', icon: 'meat', tone: 'earth' },
  vet: { label: 'Ветеринария', icon: 'vet', tone: 'sky' },
  sale: { label: 'Продажа', icon: 'sale', tone: 'tag' },
  group: { label: 'Смена группы', icon: 'arrowUp', tone: 'green' },
  tag: { label: 'Бирка', icon: 'tag', tone: 'tag' },
  note: { label: 'Заметка', icon: 'note', tone: 'plain' },
};

export const FINANCE_CATEGORIES = {
  income: [
    { key: 'animals', label: 'Продажа животных' },
    { key: 'meat', label: 'Мясо' },
    { key: 'wool', label: 'Шерсть' },
    { key: 'milk', label: 'Молоко' },
    { key: 'other', label: 'Прочее' },
  ],
  expense: [
    { key: 'feed', label: 'Корма' },
    { key: 'vet', label: 'Ветеринар' },
    { key: 'animals', label: 'Покупка животных' },
    { key: 'other', label: 'Прочее' },
  ],
};

export function sexLabel(species, sex, group) {
  const g = groupOf(species, group);
  if (g && g.sex === null) return SPECIES[species].babyLabel[sex] ?? '';
  return sex === 'f' ? 'Самка' : sex === 'm' ? 'Самец' : '';
}

// Сортировка бирок как чисел: 7, 12, 105
export function tagCompare(a, b) {
  const ta = a.tag || '', tb = b.tag || '';
  if (!ta && !tb) return (a.id ?? 0) - (b.id ?? 0);
  if (!ta) return 1;
  if (!tb) return -1;
  const d = Number(ta) - Number(tb);
  return d !== 0 ? d : ta.localeCompare(tb);
}
