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
import { backupDue } from '../lib/backup.js';
import { useGestation, useMatingEvents, pregnancies, dueGroups, dueLabel } from '../lib/repro.js';

export default function Home() {
  const animals = useAnimals();
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackupAt').then((r) => r?.value ?? null), []);
  const hasDemo = useLiveQuery(() => db.animals.where('demo').equals(1).count(), []);
  const [q, setQ] = useState('');
  const [mat, setMat] = useState(null);

  const sum = useMemo(() => herdSummary(animals), [animals]);
  const found = useMemo(() => (q ? filterAnimals(animals, { q, status: 'all' }).slice(0, 6) : []), [animals, q]);
  const matGroups = useMemo(() => maturityGroups(maturityDue(animals)), [animals]);
  const gestation = useGestation();
  const matingEvents = useMatingEvents();
  const due = useMemo(() => dueGroups(pregnancies(animals, matingEvents, gestation)), [animals, matingEvents, gestation]);

  if (!animals) return <div className="screen" />;
  const empty = animals.length === 0;
  const needBackup = backupDue(animals.length, lastBackup);

  const todos = [];
  if (needBackup) {
    const days = lastBackup ? daysBetween(toISO(new Date(lastBackup)), today()) : null;
    todos.push({
      key: 'backup', when: 'сегодня', cls: 'now', what: 'Сделать копию данных',
      who: days === null ? 'Копии ещё не было' : `Последняя ${days} ${plural(days, 'день', 'дня', 'дней')} назад`,
      onClick: () => go('/backup'),
    });
  }
  for (const g of due) {
    const first = g.items[0];
    const one = g.items.length === 1;
    todos.push({
      key: `due-${g.species}-${g.from}`, when: dueLabel(first.daysLeft), cls: first.daysLeft <= 7 ? 'now' : 'soon',
      what: one ? `${SPECIES[g.species].birthWord}: бирка ${first.animal.tag || 'без номера'}` : `${SPECIES[g.species].birthWord}: ${heads(g.items.length)}`,
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
          <Section title={found.length ? 'Нашлось' : `Бирки ${q} нет`}>
            <div className="list">
              {found.map((a) => <AnimalRow key={a.id} a={a} onClick={() => go(`/animal/${a.id}`)} />)}
            </div>
            {!found.length && <Button icon="plus" onClick={() => go(`/animal/new?tag=${q}`)}>Добавить животное с биркой {q}</Button>}
          </Section>
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
            <button className="action press" onClick={() => go('/sale/new')}><Icon name="sale" />Продажа</button>
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
