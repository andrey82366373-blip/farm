import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, byDateDesc } from '../lib/db.js';
import { useAnimals } from '../lib/data.js';
import { fmtMonth } from '../lib/format.js';
import { go, useKeep } from '../lib/router.js';
import { Chips, Button, Empty } from '../components/ui.jsx';
import EventItem, { EventIcon, eventText } from '../components/EventItem.jsx';
import { Tag } from '../components/ui.jsx';
import { SPECIES, groupName } from '../lib/domain.js';
import { fmtDate, heads } from '../lib/format.js';
import Icon from '../components/Icon.jsx';

const FILTERS = [
  { value: null, label: 'Все' },
  { value: 'birth', label: 'Рождения' },
  { value: 'death', label: 'Падёж' },
  { value: 'vet', label: 'Ветеринар' },
  { value: 'sale', label: 'Продажи' },
  { value: 'purchase', label: 'Покупки' },
  { value: 'slaughter', label: 'Забой' },
  { value: 'group', label: 'Группы' },
  { value: 'note', label: 'Заметки' },
];

export default function Journal() {
  const animals = useAnimals();
  const events = useLiveQuery(() => db.events.toArray(), []);
  const [type, setType] = useKeep('journal.type', null);
  const [limit, setLimit] = useKeep('journal.limit', 80);
  const [open, setOpen] = useState(null);

  const byId = useMemo(() => new Map((animals || []).map((a) => [a.id, a])), [animals]);
  const list = useMemo(() => (events || []).filter((e) => !type || e.type === type).sort(byDateDesc), [events, type]);

  // Одинаковые события за один день (прививка всего стада, продажа партии)
  // показываем одной строкой, которая раскрывается.
  const grouped = useMemo(() => {
    const out = [];
    const idx = new Map();
    for (const e of list) {
      const k = `${e.date}|${e.type}|${e.saleId ?? ''}|${e.motherId ?? ''}|${JSON.stringify(e.data ?? {})}`;
      if (idx.has(k)) idx.get(k).items.push(e);
      else { const g = { key: k, items: [e] }; idx.set(k, g); out.push(g); }
    }
    return out;
  }, [list]);

  // делим ленту по месяцам
  const months = [];
  for (const g of grouped.slice(0, limit)) {
    const ym = g.items[0].date.slice(0, 7);
    if (!months.length || months[months.length - 1].ym !== ym) months.push({ ym, items: [] });
    months[months.length - 1].items.push(g);
  }

  return (
    <div className="screen">
      <div className="hero hero-small">
        <div className="hero-row">
          <h1>Журнал</h1>
          <Button kind="primary" icon="plus" size="sm" onClick={() => go('/event')}>Записать</Button>
        </div>
      </div>
      <main className="content">
        <button className="row press" onClick={() => go('/stats')}>
          <span className="row-ico"><Icon name="chart" /></span>
          <span className="row-main">
            <span className="row-title">Статистика</span>
            <span className="row-sub">Сколько родилось и пало за окот, месяц, год</span>
          </span>
        </button>
        <Chips options={FILTERS} value={type} onChange={(v) => { setType(v); setLimit(80); }} wrap={false} />
        {events && list.length === 0 && (
          <Empty icon="book" title="Записей пока нет" text="Здесь будут рождения, падёж, прививки, продажи и покупки.">
            <Button kind="primary" icon="plus" onClick={() => go('/event')}>Записать событие</Button>
          </Empty>
        )}
        {months.map((m) => (
          <section key={m.ym} className="section">
            <div className="section-head"><h2>{fmtMonth(m.ym)}</h2></div>
            <div className="timeline">
              {m.items.map((g) => (g.items.length === 1 ? (
                <EventItem key={g.key} e={g.items[0]} a={byId.get(g.items[0].animalId)} showAnimal onClick={() => go(`/animal/${g.items[0].animalId}`)} />
              ) : (
                <GroupItem key={g.key} g={g} byId={byId} open={open === g.key} onToggle={() => setOpen(open === g.key ? null : g.key)} />
              )))}
            </div>
          </section>
        ))}
        {grouped.length > limit && <Button block onClick={() => setLimit(limit + 150)}>Показать ещё ({grouped.length - limit})</Button>}
      </main>
    </div>
  );
}

function GroupItem({ g, byId, open, onToggle }) {
  const e = g.items[0];
  const animals = g.items.map((x) => byId.get(x.animalId)).filter(Boolean);
  const { title, sub } = eventText(e, animals[0]);
  const kinds = [...new Set(animals.map((a) => SPECIES[a.species].many.toLowerCase()))].join(', ');
  return (
    <div className={`ev ev-group ${open ? 'open' : ''}`}>
      <button className="ev-group-head press" onClick={onToggle} aria-expanded={open}>
        <EventIcon type={e.type} />
        <span className="ev-main">
          <span className="ev-title">{e.type === 'birth' ? 'Родились' : title}: {heads(g.items.length)}</span>
          <span className="ev-sub">{kinds}{sub ? `, ${sub}` : ''}</span>
          {!open && (
            <span className="picked-tags">
              {animals.slice(0, 10).map((a) => <Tag key={a.id} tag={a.tag} size="sm" />)}
              {animals.length > 10 && <span className="muted">и ещё {animals.length - 10}</span>}
            </span>
          )}
        </span>
        <span className="ev-date">{fmtDate(e.date)}</span>
      </button>
      {open && (
        <div className="ev-group-list">
          {animals.map((a) => (
            <button key={a.id} className="ev-group-row press" onClick={() => go(`/animal/${a.id}`)}>
              <Tag tag={a.tag} size="sm" />
              <span>{groupName(a.species, a.group)}</span>
              <Icon name="chevron" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
