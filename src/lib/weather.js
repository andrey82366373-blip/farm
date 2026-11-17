import { useEffect, useSyncExternalStore } from 'react';
import { db } from './db.js';
import { today, addDays } from './format.js';

// Прогноз погоды с Open-Meteo (бесплатно, без ключа). Всё хранится в
// настройках, поэтому без интернета показываем последний сохранённый.

export const WEATHER_DEFAULT = {
  place: 'Абакан',
  lat: 53.7156,
  lon: 91.4292,
  frost: -25, // обычный порог, °C
  frostSeason: -15, // во время окота и отёла
};

const URL_BASE = 'https://api.open-meteo.com/v1/forecast';
const FRESH_MS = 60 * 60 * 1000; // обновляем не чаще раза в час

export async function getWeatherSettings() {
  return { ...WEATHER_DEFAULT, ...((await db.settings.get('weatherSettings'))?.value || {}) };
}
export async function saveWeatherSettings(v) {
  const old = await getWeatherSettings();
  await db.settings.put({ key: 'weatherSettings', value: { ...old, ...v } });
  // место поменялось — старый прогноз больше не подходит
  if (v.lat !== undefined && (v.lat !== old.lat || v.lon !== old.lon)) {
    await db.settings.delete('weather');
    refreshWeather(true);
  }
}

// Ответ Open-Meteo → наш короткий вид.
export function parseForecast(json) {
  const d = json?.daily;
  if (!d?.time?.length) throw new Error('Пустой прогноз');
  return d.time.map((date, i) => ({
    date,
    min: d.temperature_2m_min?.[i] ?? null,
    max: d.temperature_2m_max?.[i] ?? null,
    code: d.weather_code?.[i] ?? d.weathercode?.[i] ?? null,
  }));
}

let state = { loading: false, error: null };
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());
const setState = (p) => { state = { ...state, ...p }; emit(); };

export async function refreshWeather(force = false) {
  if (state.loading) return;
  if (!navigator.onLine) { setState({ error: 'offline' }); return; }
  const cached = (await db.settings.get('weather'))?.value;
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return;
  const s = await getWeatherSettings();
  setState({ loading: true, error: null });
  try {
    const url = `${URL_BASE}?latitude=${s.lat}&longitude=${s.lon}&daily=temperature_2m_min,temperature_2m_max,weather_code&timezone=auto&forecast_days=5`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const days = parseForecast(await res.json());
    await db.settings.put({ key: 'weather', value: { fetchedAt: Date.now(), lat: s.lat, lon: s.lon, days } });
    setState({ loading: false, error: null });
  } catch (e) {
    setState({ loading: false, error: e?.name === 'AbortError' ? 'timeout' : 'failed' });
  }
}

// Обновляем при запуске, при появлении сети и когда приложение снова открыли.
export function useWeatherRefresh() {
  useEffect(() => {
    refreshWeather();
    const on = () => refreshWeather();
    const vis = () => { if (!document.hidden) refreshWeather(); };
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); };
  }, []);
}

export function useWeatherStatus() {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => state);
}

// Идёт ли сейчас окот или отёл. Берём даты сезонов, которые указал папа,
// а если их нет — считаем, что сезон идёт, если за последние 10 дней
// кто-то родился у овец или коров.
export function inBirthSeason(manualSeasons, recentBirths, at = today()) {
  const m = (manualSeasons || []).find((s) => (s.species === 'sheep' || s.species === 'cow') && s.from <= at && (!s.to || s.to >= at));
  if (m) return { on: true, species: m.species, manual: true };
  const from = addDays(at, -10);
  const b = (recentBirths || []).find((e) => e.date >= from && e.date <= at && (e.species === 'sheep' || e.species === 'cow'));
  return b ? { on: true, species: b.species, manual: false } : { on: false };
}

// Ночи ближайших трёх дней холоднее порога.
export function frostAlerts(weather, settings, season, at = today()) {
  if (!weather?.days) return { limit: settings.frost, nights: [] };
  const limit = season.on ? settings.frostSeason : settings.frost;
  const end = addDays(at, 3);
  const nights = weather.days.filter((d) => d.date >= at && d.date <= end && d.min !== null && d.min < limit);
  return { limit, nights };
}

// Коды погоды WMO → значок и подпись.
export function weatherKind(code) {
  if (code === null || code === undefined) return { icon: 'cloud', label: '' };
  if (code === 0) return { icon: 'sun', label: 'ясно' };
  if (code <= 2) return { icon: 'sunCloud', label: 'переменная облачность' };
  if (code === 3) return { icon: 'cloud', label: 'пасмурно' };
  if (code === 45 || code === 48) return { icon: 'cloud', label: 'туман' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: 'snow', label: 'снег' };
  if (code >= 95) return { icon: 'rain', label: 'гроза' };
  return { icon: 'rain', label: 'дождь' };
}

export function fmtTemp(t) {
  if (t === null || t === undefined) return '—';
  const r = Math.round(t);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}°`;
}
