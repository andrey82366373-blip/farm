import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { useAnimals, herdSummary, filterAnimals, maturityDue, maturityGroups, maturityTitle } from '../lib/data.js';
import { SPECIES, SPECIES_LIST } from '../lib/domain.js';
import { fmtDate, fmtDateLong, heads, today, daysBetween, toISO, plural } from '../lib/format.js';
import { go } from '../lib/router.js';
import { SearchBox, SpeciesIcon, Section, Button } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import AnimalRow from '../components/AnimalRow.jsx';
import MaturitySheet from '../components/MaturitySheet.jsx';
import { backupDue, shareOrDownload } from '../lib/backup.js';
import { setSetting } from '../lib/db.js';
import { useUi } from '../components/ui.jsx';
import { shotReminders } from '../lib/shots.js';
import { useWeatherData, FrostAlert, WeatherWidget } from '../components/Weather.jsx';
import { useGestation, useMatingEvents, pregnancies, dueGroups, dueLabel } from '../lib/repro.js';
import { useFeedUntil, headcount, feedCalc, fmtUnits } from '../lib/feed.js';

export default function Home() {
  const animals = useAnimals();
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackupAt').then((r) => r?.value ?? null), []);
  const hasDemo = useLiveQuery(() => db.animals.where('demo').equals(1).count(), []);
  const snooze = useLiveQuery(() => db.settings.get('backupSnoozeUntil').then((r) => r?.value ?? 0), []);
  const { notify } = useUi();
  const weatherData = useWeatherData();
  const [q, setQ] = useState('');
  const [mat, setMat] = useState(null);

  const sum = useMemo(() => herdSummary(animals), [animals]);
  const found = useMemo(() => (q ? filterAnimals(animals, { q, status: 'all' }).slice(0, 6) : []), [animals, q]);
  const matGroups = useMemo(() => maturityGroups(maturityDue(animals)), [animals]);
  const gestation = useGestation();
  const matingEvents = useMatingEvents();
  const vet = useLiveQuery(() => db.events.where('type').equals('vet').toArray(), []);
  const shotOff = useLiveQuery(() => db.settings.get('shotDismissed').then((r) => r?.value || []), []);
  const feeds = useLiveQuery(() => db.feeds.toArray(), []);
  const feedUntil = useFeedUntil();
  const due = useMemo(() => dueGroups(pregnancies(animals, matingEvents, gestation)), [animals, matingEvents, gestation]);

  if (!animals) return <div className="screen" />;
  const empty = animals.length === 0;
  const needBackup = backupDue(animals.length, lastBackup, snooze);
  const backupDays = lastBackup ? daysBetween(toISO(new Date(lastBackup)), today()) : null;
  const shareNow = async () => {
    try {
      const r = await shareOrDownload();
      if (r === 'shared') notify('Копия отправлена');
      if (r === 'downloaded') notify('Копия сохранена в «Загрузки»');
    } catch { notify('Не получилось сделать копию', 'error'); }
  };

  const todos = [];
  // корма заканчиваются меньше чем через 2 недели (и нужны дальше)
  const counts = headcount(animals);
  for (const f of feeds || []) {
    const c = feedCalc(f, counts, feedUntil);
    if (!c.daily || c.daysLeft >= 14 || c.daysLeft >= c.toUntil) continue;
    const d = Math.floor(c.daysLeft);
    todos.push({
      key: `feed-${f.id}`, when: d <= 0 ? 'кончился' : `${d} дн.`, cls: 'now', what: `${f.name} заканчивается`,
      who: `осталось ≈ ${fmtUnits(c.stock, f.unit)}, нужно докупить`, onClick: () => go('/feed'),
    });
  }
  const byId = new Map(animals.map((a) => [a.id, a]));
  for (const r of shotReminders(vet, byId, shotOff || [])) {
    const n = daysBetween(today(), r.nextDate);
    todos.push({
      key: `shot-${r.key}`, when: n < 0 ? 'пора' : n === 0 ? 'сегодня' : n === 1 ? 'завтра' : `${n} дн.`, cls: n <= 3 ? 'now' : 'soon',
      what: `Повторить: ${r.drug}`, who: `${heads(r.ids.length)}${n < 0 ? `, срок был ${fmtDate(r.nextDate)}` : `, ${fmtDate(r.nextDate)}`}`,
      onClick: () => go(`/event/vet?drug=${encodeURIComponent(r.drug)}&dose=${encodeURIComponent(r.dose)}&kind=${r.kind || 'vaccine'}&target=${r.ids.join(',')}`),
    });
  }
  for (const g of due) {
    const first = g.items[0];
    const one = g.items.length === 1;
    todos.push({
      key: `due-${g.species}-${g.from}`, when: dueLabel(first.daysLeft), cls: first.daysLeft <= 7 ? 'now' : 'soon',
      what: one ? `${SPECIES[g.species].birthWord}: ${first.animal.name || (first.animal.tag ? 'бирка ' + first.animal.tag : 'без номера')}` : `${SPECIES[g.species].birthWord}: ${heads(g.items.length)}`,
      who: first.daysLeft < 0 ? `ждали ${fmtDate(first.due)}, проверьте` : g.from === g.to ? `ожидается ${fmtDate(g.from)}` : `ожидается ${fmtDate(g.from)} – ${fmtDate(g.to)}`,
      onClick: () => go(one ? `/animal/${first.animal.id}` : '/calendar'),
    });
  }
  for (const g of matGroups) {
    todos.push({
      key: g.key, when: heads(g.items.length).replace(' ', ' '), cls: 'soon', what: 'Пора перевести',
      who: maturityTitle(g), onClick: () => setMat(g),
    });
  }

  return (
    <div className="screen">
      <div className="hero">
        <div className="hero-date">{fmtDateLong(today())}</div>
        <h1>Моё хозяйство</h1>
        <SearchBox value={q} onChange={setQ} onEnter={() => found.length === 1 && go(`/animal/${found[0].id}`)} />
      </div>

      <main className="content">
        {q && (
          <Section title={found.length ? 'Нашлось' : `«${q}» не нашлось`}>
            <div className="list">
              {found.map((a) => <AnimalRow key={a.id} a={a} onClick={() => go(`/animal/${a.id}`)} />)}
            </div>
            {!found.length && <Button icon="plus" onClick={() => go(/^\d+$/.test(q) ? `/animal/new?tag=${q}` : `/animal/new?species=cow&name=${encodeURIComponent(q)}`)}>Добавить: {q}</Button>}
          </Section>
        )}

        <FrostAlert data={weatherData} />

        {needBackup && (
          <div className="banner banner-backup" role="alert">
            <Icon name="shield" />
            <div className="banner-body">
              <div className="banner-title">Пора сделать копию данных</div>
              <p>{backupDays === null ? 'Копии ещё не было.' : `Последняя копия была ${backupDays} ${plural(backupDays, 'день', 'дня', 'дней')} назад.`} Если телефон сломается, записи можно вернуть только из копии.</p>
              <Button kind="dark" size="lg" icon="share" block onClick={shareNow}>Поделиться копией</Button>
              <Button kind="ghost" onClick={() => setSetting('backupSnoozeUntil', Date.now() + 24 * 3600 * 1000)}>Напомнить завтра</Button>
            </div>
          </div>
        )}

        {hasDemo > 0 && (
          <div className="banner banner-demo">
            <Icon name="flask" />
            <div className="banner-body">
              <div className="banner-title">Загружены тестовые данные</div>
              <p>Это пример для проверки. Перед настоящей работой удалите его.</p>
              <Button size="sm" onClick={() => go('/demo')}>Удалить тестовые данные</Button>
            </div>
          </div>
        )}

        {empty ? (
          <div className="card welcome">
            <h2>Добро пожаловать!</h2>
            <p>Здесь будет всё поголовье по биркам. Начните с первого животного или загрузите пример, чтобы посмотреть, как всё работает.</p>
            <Button kind="primary" size="lg" icon="plus" block onClick={() => go('/animal/new')}>Добавить животное</Button>
            <Button icon="flask" block onClick={() => go('/demo')}>Загрузить тестовые данные</Button>
            <Button icon="upload" block onClick={() => go('/backup')}>Восстановить из копии</Button>
          </div>
        ) : (
          <>
            <WeatherWidget data={weatherData} />
            <div className="total-line"><span>На хозяйстве сейчас</span><b>{heads(sum.total)}</b></div>
            <div className="list">
              {SPECIES_LIST.map((s) => {
                const sp = sum.species[s.key];
                if (!sp.n && sum.total) return null;
                return (
                  <button key={s.key} className="card herd-card press" onClick={() => go(`/animals?species=${s.key}`)}>
                    <div className="herd-top">
                      <SpeciesIcon species={s.key} />
                      <div className="herd-name">{s.many}</div>
                      <div className="herd-n">{sp.n}</div>
                    </div>
                    <div className="herd-groups">
                      {s.groups.filter((g) => sp.groups[g.key]).map((g) => (
                        <span key={g.key}>{g.many}<b>{sp.groups[g.key]}</b></span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {!empty && (
          <div className="actions">
            <button className="action action-main press" onClick={() => go('/count')}>
              <Icon name="tally" />
              <span>Пересчёт<small>посчитать в поле</small></span>
            </button>
            <button className="action press" onClick={() => go('/birth')}><Icon name="birth" />Родились</button>
            <button className="action press" onClick={() => go('/event/vet')}><Icon name="vet" />Укол</button>
            <button className="action press" onClick={() => go('/sale/new')}><Icon name="sale" />Продажа</button>
            <button className="action press" onClick={() => go('/fuel/new')}><Icon name="fuel" />Заправка</button>
            <button className="action action-wide press" onClick={() => go('/event')}><Icon name="note" />Записать событие</button>
          </div>
        )}

        {todos.length > 0 && (
          <Section title="Скоро">
            <div className="list">
              {todos.map((t) => (
                <button key={t.key} className="card todo press" onClick={t.onClick}>
                  <span className={`todo-when ${t.cls}`}>{t.when}</span>
                  <span>
                    <span className="todo-what">{t.what}</span>
                    <span className="todo-who" style={{ display: 'block' }}>{t.who}</span>
                  </span>
                  <Icon name="chevron" />
                </button>
              ))}
            </div>
          </Section>
        )}
      </main>
      {mat && <MaturitySheet group={matGroups.find((g) => g.key === mat.key) ?? null} onClose={() => setMat(null)} />}
    </div>
  );
}
