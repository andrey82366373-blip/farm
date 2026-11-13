// Даты храним строкой 'ГГГГ-ММ-ДД' — так их легко сравнивать и переносить.

export function today() {
  return toISO(new Date());
}
export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export function addMonths(iso, n) {
  const d = parseISO(iso);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function monthsBetween(a, b) {
  const da = parseISO(a), db = parseISO(b);
  let m = (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
  if (db.getDate() < da.getDate()) m -= 1;
  return m;
}

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function fmtDate(iso, { year = 'auto' } = {}) {
  if (!iso) return '—';
  const d = parseISO(iso);
  const showYear = year === true || (year === 'auto' && d.getFullYear() !== new Date().getFullYear());
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${showYear ? ' ' + d.getFullYear() : ''}`;
}
export function fmtDateLong(iso) {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function fmtMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_NOM[m - 1]} ${y}`;
}
export function relDay(iso) {
  const n = daysBetween(today(), iso);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  if (n > 0) return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  return `${-n} ${plural(-n, 'день', 'дня', 'дней')} назад`;
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const heads = (n) => `${n} ${plural(n, 'голова', 'головы', 'голов')}`;

export function fmtAge(birthDate, approx, at = today()) {
  if (!birthDate) return '';
  const m = monthsBetween(birthDate, at);
  const pre = approx ? '≈ ' : '';
  if (m < 1) {
    const d = Math.max(0, daysBetween(birthDate, at));
    return `${pre}${d} ${plural(d, 'день', 'дня', 'дней')}`;
  }
  const y = Math.floor(m / 12), mm = m % 12;
  const parts = [];
  if (y) parts.push(`${y} ${plural(y, 'год', 'года', 'лет')}`);
  if (mm) parts.push(`${mm} мес.`);
  return pre + parts.join(' ');
}

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
export const fmtRub = (n) => `${rub.format(Math.round(n || 0))} ₽`;
export const fmtNum = (n) => num.format(n || 0);

export function parseNum(s) {
  if (s === '' || s == null) return null;
  const n = Number(String(s).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
