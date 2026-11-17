import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { SPECIES } from '../lib/domain.js';
import { today, addDays, fmtDate, daysBetween, plural } from '../lib/format.js';
import { WEATHER_DEFAULT, useWeatherRefresh, useWeatherStatus, refreshWeather, inBirthSeason, frostAlerts, weatherKind, fmtTemp } from '../lib/weather.js';
import Icon from './Icon.jsx';

const DAY_NAMES = ['Сегодня', 'Завтра'];
const WEEK = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function updatedText(ts) {
  if (!ts) return '';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 2) return 'обновлено только что';
  if (min < 60) return `обновлено ${min} мин. назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `обновлено ${h} ${plural(h, 'час', 'часа', 'часов')} назад`;
  const d = new Date(ts);
  return `обновлено ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} в ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Данные для предупреждения и виджета.
export function useWeatherData() {
  useWeatherRefresh();
  const status = useWeatherStatus();
  const weather = useLiveQuery(() => db.settings.get('weather').then((r) => r?.value ?? null), []);
  const settings = useLiveQuery(() => db.settings.get('weatherSettings').then((r) => ({ ...WEATHER_DEFAULT, ...(r?.value || {}) })), []);
  const seasons = useLiveQuery(() => db.settings.get('seasons').then((r) => r?.value || []), []);
  const births = useLiveQuery(async () => {
    const from = addDays(today(), -10);
    const evs = await db.events.where('date').aboveOrEqual(from).filter((e) => e.type === 'birth').toArray();
    const ids = evs.map((e) => e.animalId);
    const animals = await db.animals.bulkGet(ids);
    return evs.map((e, i) => ({ date: e.date, species: animals[i]?.species }));
  }, []);
  if (weather === undefined || !settings || !seasons || !births) return null;
  const season = inBirthSeason(seasons, births);
  const stale = weather && Date.now() - weather.fetchedAt > 3 * 3600 * 1000;
  return { weather, settings, season, status, stale, ...frostAlerts(weather, settings, season) };
}

// Заметное предупреждение о морозе на главном экране.
export function FrostAlert({ data }) {
  if (!data || !data.nights.length) return null;
  const { nights, limit, season, weather } = data;
  const coldest = nights.reduce((a, b) => (b.min < a.min ? b : a));
  const word = season.on ? SPECIES[season.species]?.birthWord.toLowerCase() : null;
  return (
    <div className={`banner frost ${season.on ? 'frost-season' : ''}`} role="alert">
      <Icon name="snow" />
      <div className="banner-body">
        <div className="banner-title">
          {season.on ? `Мороз во время ${word === 'окот' ? 'окота' : word === 'отёл' ? 'отёла' : 'родов'}!` : 'Сильный мороз'}
        </div>
        <div className="frost-nights">
          {nights.map((n) => (
            <div key={n.date} className="frost-night">
              <span>{nightLabel(n.date)}</span>
              <b>{fmtTemp(n.min)}</b>
            </div>
          ))}
        </div>
        <p>
          {season.on
            ? `Ночью до ${fmtTemp(coldest.min)}C. Новорождённых и маток с приплодом стоит держать в тепле.`
            : `Ночью до ${fmtTemp(coldest.min)}C, холоднее ${fmtTemp(limit)}C. Проверьте укрытие, воду и подстилку.`}
        </p>
        <p className="pill-note">Порог {fmtTemp(limit)}C{season.on ? ' (мягче, потому что идёт сезон родов)' : ''}, {updatedText(weather.fetchedAt)}.</p>
      </div>
    </div>
  );
}

function nightLabel(date) {
  const n = daysBetween(today(), date);
  if (n === 0) return 'Сегодня ночью';
  if (n === 1) return 'Завтра ночью';
  return `${fmtDate(date)} ночью`;
}

// Маленький виджет: погода на три дня.
export function WeatherWidget({ data }) {
  if (!data) return null;
  const { weather, settings, status, stale, limit } = data;
  const days = (weather?.days || []).filter((d) => d.date >= today()).slice(0, 3);
  if (!days.length) {
    return (
      <div className="card weather weather-empty">
        <Icon name="cloud" />
        <span className="row-main">
          <span className="row-title">Погода: {settings.place}</span>
          <span className="row-sub">
            {status.loading ? 'Загружаю прогноз…' : !navigator.onLine ? 'Нет интернета. Прогноз появится, когда телефон поймает сеть.' : 'Прогноз пока не загрузился.'}
          </span>
        </span>
        {navigator.onLine && !status.loading && <button className="icon-btn press" onClick={() => refreshWeather(true)} aria-label="Обновить прогноз"><Icon name="reset" /></button>}
      </div>
    );
  }
  return (
    <div className="card weather">
      <div className="weather-days">
        {days.map((d, i) => {
          const k = weatherKind(d.code);
          const n = daysBetween(today(), d.date);
          const cold = d.min !== null && d.min < limit;
          return (
            <div key={d.date} className={`wday ${cold ? 'cold' : ''}`}>
              <span className="wday-name">{n < 2 ? DAY_NAMES[n] : `${WEEK[new Date(d.date + 'T12:00').getDay()]}, ${Number(d.date.slice(8))}`}</span>
              <Icon name={k.icon} />
              <b>{fmtTemp(d.max)}</b>
              <span className="wday-night">ночью {fmtTemp(d.min)}</span>
            </div>
          );
        })}
      </div>
      <div className="weather-foot">
        <span>{settings.place}, {updatedText(weather.fetchedAt)}{!navigator.onLine ? ', нет интернета' : stale && status.error ? ', обновить не удалось' : ''}</span>
        {navigator.onLine && <button className="link press" onClick={() => refreshWeather(true)} disabled={status.loading}>{status.loading ? 'Обновляю…' : 'Обновить'}</button>}
      </div>
    </div>
  );
}
