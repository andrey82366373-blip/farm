import { useSyncExternalStore } from 'react';
import { db } from './db.js';

// Сезонные темы: цвета шапки и фона и лёгкая анимация.
export const SEASONS = [
  { key: 'winter', label: 'Зима' },
  { key: 'spring', label: 'Весна' },
  { key: 'summer', label: 'Лето' },
  { key: 'autumn', label: 'Осень' },
];

// Время года по дате: декабрь–февраль зима, март–май весна и так далее.
export function seasonByDate(d = new Date()) {
  const m = d.getMonth();
  if (m === 11 || m < 2) return 'winter';
  if (m < 5) return 'spring';
  if (m < 8) return 'summer';
  return 'autumn';
}

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// theme: 'auto' или название сезона. anim: null — как в телефоне
// (выключена при «уменьшении движения»), true или false — выбор папы.
let state = { theme: 'auto', anim: null };
const listeners = new Set();

function snapshot() {
  return state;
}
export function currentSeason() {
  return state.theme === 'auto' ? seasonByDate() : state.theme;
}
export function animationOn() {
  return state.anim === null ? !reducedMotion() : state.anim;
}

function apply() {
  const key = currentSeason();
  document.documentElement.dataset.season = key;
  const sky = { winter: '#C5D6E8', spring: '#BDE6F1', summer: '#9FD4F5', autumn: '#F2D6A8' }[key];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sky);
}

export async function loadTheme() {
  try {
    const t = (await db.settings.get('theme'))?.value;
    const a = (await db.settings.get('anim'))?.value;
    state = { theme: SEASONS.some((s) => s.key === t) ? t : 'auto', anim: typeof a === 'boolean' ? a : null };
  } catch { /* останется «авто» */ }
  apply();
}

export async function setTheme(theme) {
  state = { ...state, theme };
  apply();
  listeners.forEach((f) => f());
  await db.settings.put({ key: 'theme', value: theme });
}
export async function setAnimation(on) {
  state = { ...state, anim: on };
  listeners.forEach((f) => f());
  await db.settings.put({ key: 'anim', value: on });
}

export function useTheme() {
  const s = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, snapshot);
  return { ...s, season: currentSeason(), animation: animationOn(), reducedMotion: reducedMotion() };
}
